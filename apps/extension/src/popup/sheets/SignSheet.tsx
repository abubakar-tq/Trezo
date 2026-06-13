import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { resolveApproval, rejectApproval } from "../lib/approvalBridge";
import { AuthService } from "../../auth/authService";
import { WalletResolver } from "../../pairing/walletResolver";
import { WebAuthnService } from "../../passkey/webauthnService";
import { isDeviceLinkedOnChain } from "../../pairing/deviceLink";
import { getPublicClient } from "../../core/clients";
import { getNetwork } from "../../core/networks";
import { hashMessage, hexToString } from "viem";
import { Logo } from "../ui/Logo";
import { Sheet } from "../ui/Sheet";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { Button } from "../ui/Button";

interface SignSheetProps {
  req: { id: string; origin: string; chainId: number; message: string };
}

export function SignSheet({ req }: SignSheetProps) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Decode message for display (best-effort hex → utf-8)
  const text = (() => {
    try { return hexToString(req.message as `0x${string}`); } catch { return req.message; }
  })();

  const chainName = (() => {
    try { return getNetwork(req.chainId).name; } catch { return `Chain ${req.chainId}`; }
  })();

  async function sign() {
    setBusy(true);
    setErr(null);
    try {
      // 1. Resolve wallet for this chain
      const user = await AuthService.getUser();
      if (!user) throw new Error("Not signed in");
      const wallet = await WalletResolver.getForChain(user.id, req.chainId);
      if (!wallet) throw new Error(`No account on ${chainName}`);

      // 2. Guard: device must be linked on this chain
      const meta = await WebAuthnService.getStored();
      if (!meta) {
        await rejectApproval(req.id, `No passkey found. Open Trezo to pair this device on ${chainName}.`);
        window.close();
        return;
      }
      const linked = await isDeviceLinkedOnChain(req.chainId, wallet.address, meta.credentialIdRaw as `0x${string}`);
      if (!linked) {
        await rejectApproval(req.id, `This device isn't linked on ${chainName}. Open Trezo to link it.`);
        window.close();
        return;
      }

      // 3. EIP-191 digest → passkey sign → EIP-1271 envelope
      const digest = hashMessage({ raw: req.message as `0x${string}` });
      const sig = await WebAuthnService.sign(digest);
      const encoded = WebAuthnService.encodeForContract(sig);

      // 4. Optional on-chain isValidSignature sanity check (warning only)
      try {
        const client = getPublicClient(req.chainId);
        const res = await client.readContract({
          address: wallet.address,
          abi: [{ name: "isValidSignature", type: "function", stateMutability: "view",
            inputs: [{ type: "bytes32" }, { type: "bytes" }], outputs: [{ type: "bytes4" }] }],
          functionName: "isValidSignature",
          args: [digest, encoded],
        });
        if (res !== "0x1626ba7e") {
          console.warn("[trezo] isValidSignature returned unexpected value:", res);
        }
      } catch (e) {
        console.warn("[trezo] isValidSignature check skipped:", e);
      }

      await resolveApproval(req.id, encoded);
      window.close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Sign failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet>
      {/* Title row */}
      <div className="flex items-center justify-between mb-[12px]">
        <div className="flex items-center gap-[9px]">
          <Logo size={26} />
          <b className="text-[15px] font-semibold tracking-tight">Sign message</b>
        </div>
        <Chip label={chainName} />
      </div>

      {/* Origin row */}
      <div className="flex items-center gap-[7px] mb-[11px] text-[12.5px]" style={{ color: "var(--text-2)" }}>
        <span
          className="w-4 h-4 rounded-[5px] flex-none"
          style={{ background: "linear-gradient(135deg,#06B6D4,#7C3AED)" }}
        />
        {req.origin}
      </div>

      {/* Message card */}
      <Card className="mb-[12px]">
        <span className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[7px]" style={{ color: "var(--text-3)" }}>
          Message
        </span>
        <pre
          className="font-mono text-[11.5px] leading-[1.6] whitespace-pre-wrap break-all overflow-auto"
          style={{ maxHeight: 160, color: "var(--text)" }}
        >
          {text}
        </pre>
      </Card>

      {/* Windows Hello bio tag */}
      <div
        className="flex items-center gap-[9px] rounded-[12px] px-3 py-[10px] text-[12px] mb-[12px]"
        style={{
          background: "var(--muted-surface)",
          border: "1px solid rgba(124,58,237,.07)",
          color: "var(--text-2)",
        }}
      >
        <span
          className="w-[18px] h-[18px] rounded-[6px] grid place-items-center flex-none"
          style={{ background: "var(--accent-soft)" }}
        >
          <Fingerprint size={12} style={{ color: "var(--accent)" }} strokeWidth={1.9} />
        </span>
        Verified with Windows Hello on this device
      </div>

      {err && <p className="text-[12px] mb-3" style={{ color: "var(--danger)" }}>{err}</p>}

      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          loading={busy}
          disabled={busy}
          onClick={() => { void sign(); }}
        >
          {busy ? "Waiting for Windows Hello…" : "Sign with passkey"}
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => { void rejectApproval(req.id, "User rejected").then(() => window.close()); }}
        >
          Reject
        </Button>
      </div>
    </Sheet>
  );
}
