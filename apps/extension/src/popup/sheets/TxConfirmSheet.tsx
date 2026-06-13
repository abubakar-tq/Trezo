import { useState } from "react";
import { Zap, CheckCircle2 } from "lucide-react";
import { resolveApproval, rejectApproval } from "../lib/approvalBridge";
import { AuthService } from "../../auth/authService";
import { WalletResolver } from "../../pairing/walletResolver";
import { WebAuthnService } from "../../passkey/webauthnService";
import { isDeviceLinkedOnChain } from "../../pairing/deviceLink";
import { getNetwork } from "../../core/networks";
import { prepareDappTx, submitDappTx, waitForTx } from "../../core/smartAccountExecution";
import { supabase } from "../../auth/supabaseClient";
import { addPendingTx } from "../../data/pendingTxs";
import type { Hex } from "viem";
import { Logo } from "../ui/Logo";
import { Sheet } from "../ui/Sheet";
import { Card } from "../ui/Card";
import { KV } from "../ui/KV";
import { Chip } from "../ui/Chip";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

interface TxConfirmSheetProps {
  req: {
    id: string;
    origin: string;
    chainId: number;
    tx: { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` };
  };
}

type Stage = "idle" | "building" | "passkey" | "submitting";

type TxResult =
  | { phase: "submitted"; userOpHash: Hex }
  | { phase: "confirmed"; userOpHash: Hex; txHash: string | undefined; success: boolean }
  | { phase: "error"; userOpHash: Hex; message: string };

// For device-link guard failures we show a message + close button
type DeviceGuardState = { message: string } | null;

// Best-effort: record a confirmed send to wallet_transactions so it shows in Activity.
async function recordSendToActivity({
  userId,
  walletAddress,
  chainId,
  toAddress,
  valueHex,
  dataHex,
  txHash,
  userOpHash,
}: {
  userId: string;
  walletAddress: string;
  chainId: number;
  toAddress: string;
  valueHex: string | undefined;
  dataHex: string | undefined;
  txHash: string | undefined;
  userOpHash: string;
}): Promise<void> {
  try {
    const value = valueHex ? BigInt(valueHex) : 0n;
    const isErc20 = dataHex && dataHex !== "0x" && dataHex.startsWith("0xa9059cbb"); // transfer(address,uint256) selector
    const tokenSymbol = isErc20 ? null : "ETH"; // best-effort; ERC-20 symbol not decoded here
    const amountEth = !isErc20 && value > 0n ? (Number(value) / 1e18).toFixed(6) : null;

    await supabase.from("wallet_transactions").insert({
      user_id: userId,
      wallet_address: walletAddress.toLowerCase(),
      chain_id: chainId,
      type: "transfer",
      status: "confirmed",
      direction: "outgoing",
      token_symbol: tokenSymbol,
      amount_display: amountEth,
      to_address: toAddress.toLowerCase(),
      transaction_hash: txHash ?? null,
      user_op_hash: userOpHash,
      paymaster_used: true,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // Best-effort — never block UX
    console.warn("[TxConfirmSheet] recordSendToActivity failed (non-fatal):", e);
  }
}

export function TxConfirmSheet({ req }: TxConfirmSheetProps) {
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<TxResult | null>(null);
  const [deviceGuard, setDeviceGuard] = useState<DeviceGuardState>(null);

  const chainName = (() => {
    try { return getNetwork(req.chainId).name; } catch { return `Chain ${req.chainId}`; }
  })();

  const value = req.tx.value ? BigInt(req.tx.value) : 0n;
  const valueEth = (Number(value) / 1e18).toFixed(6);
  const dataPrefix = req.tx.data && req.tx.data !== "0x"
    ? req.tx.data.slice(0, 10) + (req.tx.data.length > 10 ? "…" : "")
    : "(none)";

  const erc20Sel = "0xa9059cbb";
  const isErc20Tx = req.tx.data && req.tx.data.startsWith(erc20Sel) && req.tx.data.length >= 74;
  const displayTo = isErc20Tx ? `0x${req.tx.data!.slice(34, 74)}` : req.tx.to;
  const toLabel = isErc20Tx ? "ERC-20 recipient" : "To";

  function explorerLink(userOpHash: Hex, txHash: string | undefined): string {
    if (txHash) {
      try {
        const net = getNetwork(req.chainId);
        return `${net.blockExplorerUrl}/tx/${txHash}`;
      } catch {
        // fall through to jiffyscan
      }
    }
    const network = req.chainId === 11155111 ? "sepolia" : "base-sepolia";
    return `https://jiffyscan.xyz/userOpHash/${userOpHash}?network=${network}`;
  }

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      // 1. Resolve user + wallet
      const user = await AuthService.getUser();
      if (!user) throw new Error("Not signed in");
      const wallet = await WalletResolver.getForChain(user.id, req.chainId);
      if (!wallet) throw new Error(`No account on ${chainName}`);

      // 2. Passkey metadata
      const meta = await WebAuthnService.getStored();
      if (!meta) {
        const msg = `No passkey found. Open Trezo to pair this device on ${chainName}.`;
        await rejectApproval(req.id, msg);
        setDeviceGuard({ message: msg });
        return;
      }

      // 3. Device-link guard
      const linked = await isDeviceLinkedOnChain(
        req.chainId,
        wallet.address,
        meta.credentialIdRaw as `0x${string}`,
      );
      if (!linked) {
        const msg = `This device isn't linked on ${chainName}. Open Trezo to link it.`;
        await rejectApproval(req.id, msg);
        setDeviceGuard({ message: msg });
        return;
      }

      // 4. Build UserOp (bundler + paymaster resolved from chainId)
      setStage("building");
      const prepared = await prepareDappTx({
        chainId: req.chainId,
        account: wallet.address,
        passkeyIdRaw: meta.credentialIdRaw as `0x${string}`,
        to: req.tx.to,
        value,
        data: (req.tx.data ?? "0x") as `0x${string}`,
      });

      // 5. Windows Hello sign
      setStage("passkey");
      const sig = await WebAuthnService.sign(prepared.userOpHash);

      // 6. Submit
      setStage("submitting");
      const hash = await submitDappTx(req.chainId, prepared, sig);

      // 7. Resolve the dApp promise immediately with the hash, then show result
      await resolveApproval(req.id, hash);
      setResult({ phase: "submitted", userOpHash: hash });

      // For ERC-20 transfers (transfer(address,uint256) selector 0xa9059cbb),
      // req.tx.to is the token contract. Decode the actual recipient from calldata.
      const erc20Selector = "0xa9059cbb";
      const isErc20 = req.tx.data && req.tx.data.startsWith(erc20Selector) && req.tx.data.length >= 74;
      const pendingToAddress: `0x${string}` = isErc20
        ? `0x${req.tx.data!.slice(34, 74)}` as `0x${string}` // first 32-byte arg, last 20 bytes = address
        : req.tx.to;

      void addPendingTx({
        userOpHash: hash,
        chainId: req.chainId,
        toAddress: pendingToAddress,
        valueHex: req.tx.value,
        submittedAt: Date.now(),
      });

      // 8b. Best-effort: record send immediately so Activity shows it even if user closes the window
      if (req.origin === "Trezo Wallet") {
        const userEarly = await AuthService.getUser().catch(() => null);
        const walletEarly = userEarly ? await WalletResolver.getForChain(userEarly.id, req.chainId).catch(() => null) : null;
        if (userEarly && walletEarly) {
          void recordSendToActivity({
            userId: userEarly.id,
            walletAddress: walletEarly.address,
            chainId: req.chainId,
            toAddress: pendingToAddress,
            valueHex: req.tx.value,
            dataHex: req.tx.data,
            txHash: undefined,
            userOpHash: hash,
          });
        }
      }

      // 8. Poll for receipt
      try {
        const receipt = await waitForTx(req.chainId, hash);
        // UserOperationReceipt: top-level `success` boolean, `receipt.transactionHash` for on-chain hash
        const txHash = receipt.receipt?.transactionHash as string | undefined;
        setResult({
          phase: "confirmed",
          userOpHash: hash,
          txHash,
          success: receipt.success,
        });
      } catch (pollErr) {
        setResult({
          phase: "error",
          userOpHash: hash,
          message: pollErr instanceof Error ? pollErr.message : "Timed out waiting for receipt",
        });
      }
    } catch (e) {
      const isUserCancelled = e instanceof Error &&
        (e.name === "NotAllowedError" || e.name === "AbortError" || e.message.toLowerCase().includes("cancel"));
      const message = isUserCancelled
        ? "Passkey verification was cancelled. Close and try again from the dApp."
        : (e instanceof Error ? e.message : "Transaction failed");
      setErr(message);
      setStage("idle");
      // If we haven't resolved yet, reject the dApp request so it settles
      try {
        await rejectApproval(req.id, message);
      } catch {
        // may already be settled
      }
    } finally {
      setBusy(false);
    }
  }

  const stageLabel: Record<Stage, string> = {
    idle: "Confirm & send",
    building: "Building UserOp…",
    passkey: "Waiting for Windows Hello…",
    submitting: "Submitting…",
  };

  // ── Device-guard error ──────────────────────────────────────────────────
  if (deviceGuard) {
    return (
      <Sheet>
        <div className="flex items-center gap-[9px] mb-[13px]">
          <Logo size={26} />
          <b className="text-[15px] font-semibold tracking-tight">Transaction blocked</b>
        </div>
        <p className="text-[12.5px] mb-4" style={{ color: "var(--warning)" }}>{deviceGuard.message}</p>
        <Button variant="ghost" onClick={() => window.close()}>Close</Button>
      </Sheet>
    );
  }

  // ── Result views ────────────────────────────────────────────────────────
  if (result) {
    const truncated = result.userOpHash.slice(0, 10) + "…" + result.userOpHash.slice(-8);

    // Submitted — waiting for receipt
    if (result.phase === "submitted") {
      return (
        <Sheet>
          <div className="flex flex-col items-center text-center mt-4">
            <div className="mb-3">
              <Spinner size={36} />
            </div>
            <h2 className="text-[17px] font-semibold tracking-tight mb-[6px]">Submitted</h2>
            <p className="text-[12.5px] mb-4" style={{ color: "var(--text-2)" }}>
              Waiting for confirmation on {chainName}…
            </p>
            <Card className="w-full text-left mb-4">
              <span className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[6px]" style={{ color: "var(--text-3)" }}>
                UserOp
              </span>
              <code className="addr text-[11.5px]">{truncated}</code>
            </Card>
            <Button variant="ghost" onClick={() => window.close()}>Close</Button>
          </div>
        </Sheet>
      );
    }

    // Confirmed or reverted
    if (result.phase === "confirmed") {
      const link = explorerLink(result.userOpHash, result.txHash);
      return (
        <Sheet>
          <div className="flex flex-col items-center text-center mt-4">
            {/* Check circle */}
            <div
              className="w-[46px] h-[46px] rounded-full grid place-items-center mb-[11px]"
              style={{ background: result.success ? "var(--success-soft)" : "var(--danger-soft)" }}
            >
              <CheckCircle2
                size={22}
                strokeWidth={2.6}
                style={{ color: result.success ? "var(--success)" : "var(--danger)" }}
              />
            </div>
            <h2 className="text-[17px] font-semibold tracking-tight mb-[6px]">
              {result.success ? "Confirmed" : "Reverted"}
            </h2>
            <p className="text-[12.5px] mb-4" style={{ color: "var(--text-2)" }}>
              {result.success
                ? `Landed on ${chainName}, paid by the paymaster.`
                : `Transaction reverted on ${chainName}.`}
            </p>
            <Card className="w-full text-left mb-4">
              <span className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[6px]" style={{ color: "var(--text-3)" }}>
                Transaction
              </span>
              <code className="addr text-[11.5px]">{truncated}</code>
              <div className="h-px my-[11px]" style={{ background: "rgba(124,58,237,.07)" }} />
              <a
                href={link}
                target="_blank"
                rel="noreferrer"
                className="text-[12.5px] font-medium"
                style={{ color: "var(--accent-2)", textDecoration: "none" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
              >
                View on {result.txHash ? "Etherscan" : "JiffyScan"} ↗
              </a>
            </Card>
            <Button variant="ghost" onClick={() => window.close()}>Close</Button>
          </div>
        </Sheet>
      );
    }

    // Poll error — submitted but receipt unknown
    return (
      <Sheet>
        <div className="flex flex-col items-center text-center mt-4">
          <div
            className="w-[46px] h-[46px] rounded-full grid place-items-center mb-[11px]"
            style={{ background: "var(--warning-soft)" }}
          >
            <CheckCircle2 size={22} strokeWidth={2.6} style={{ color: "var(--warning)" }} />
          </div>
          <h2 className="text-[17px] font-semibold tracking-tight mb-[6px]">Submitted</h2>
          <p className="text-[12.5px] mb-2" style={{ color: "var(--text-2)" }}>
            Submitted — but could not confirm receipt:
          </p>
          <p className="text-[12px] mb-4" style={{ color: "var(--danger)" }}>{result.message}</p>
          <Card className="w-full text-left mb-4">
            <span className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[6px]" style={{ color: "var(--text-3)" }}>
              UserOp
            </span>
            <code className="addr text-[11.5px]">{truncated}</code>
            <div className="h-px my-[11px]" style={{ background: "rgba(124,58,237,.07)" }} />
            <a
              href={explorerLink(result.userOpHash, undefined)}
              target="_blank"
              rel="noreferrer"
              className="text-[12.5px] font-medium"
              style={{ color: "var(--accent-2)", textDecoration: "none" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
            >
              View on JiffyScan ↗
            </a>
          </Card>
          <Button variant="ghost" onClick={() => window.close()}>Close</Button>
        </div>
      </Sheet>
    );
  }

  // ── Normal confirm UI ───────────────────────────────────────────────────
  const isInternalSend = req.origin === "Trezo Wallet";

  return (
    <Sheet>
      {/* Title row */}
      <div className="flex items-center justify-between mb-[12px]">
        <div className="flex items-center gap-[9px]">
          <Logo size={26} />
          <b className="text-[15px] font-semibold tracking-tight">
            {isInternalSend ? "Confirm send" : "Confirm transaction"}
          </b>
        </div>
        <Chip label={chainName} />
      </div>

      {/* Origin row — only for dApp requests */}
      {!isInternalSend && (
        <div className="flex items-center gap-[7px] mb-[11px] text-[12.5px]" style={{ color: "var(--text-2)" }}>
          <span
            className="w-4 h-4 rounded-[5px] flex-none"
            style={{ background: "linear-gradient(135deg,#06B6D4,#7C3AED)" }}
          />
          {req.origin}
        </div>
      )}

      {/* "What happens" preview card */}
      <Card className="mb-[11px]">
        <span className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[8px]" style={{ color: "var(--text-3)" }}>
          What happens
        </span>
        <KV label={toLabel} value={
          <span className="font-mono text-[11px]">
            {displayTo.slice(0, 6)}…{displayTo.slice(-4)}
          </span>
        } />
        <KV label="Value" value={`${valueEth} ETH`} />
        <KV label="Data" value={
          <span className="font-mono">{dataPrefix}</span>
        } last />
      </Card>

      {/* Gas sponsored line */}
      <div className="flex items-center justify-between px-[2px] mb-[12px]">
        <span className="inline-flex items-center gap-[6px] text-[12px] font-semibold" style={{ color: "var(--success)" }}>
          <Zap size={13} strokeWidth={1.9} />
          Gas sponsored
        </span>
        <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>no ETH needed</span>
      </div>

      {/* Stage indicator while busy */}
      {busy && (
        <div className="flex items-center gap-2 mb-3" style={{ color: "var(--text-2)" }}>
          <Spinner size={13} />
          <span className="text-[12px]">{stageLabel[stage]}</span>
        </div>
      )}

      {err && (
        <>
          <p className="text-[12px] mb-3" style={{ color: "var(--danger)" }}>{err}</p>
          <Button variant="ghost" onClick={() => window.close()}>Close</Button>
        </>
      )}

      {!err && (
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            loading={busy}
            disabled={busy}
            onClick={() => { void confirm(); }}
          >
            {busy ? stageLabel[stage] : "Confirm & send"}
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              if (!busy) {
                void rejectApproval(req.id, "User rejected").then(() => window.close());
              }
            }}
          >
            Reject
          </Button>
        </div>
      )}
    </Sheet>
  );
}
