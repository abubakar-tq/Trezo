import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { parseEther, parseUnits, encodeFunctionData, isAddress } from "viem";
import { AuthService } from "../../auth/authService";
import { WalletResolver } from "../../pairing/walletResolver";
import { isDeviceLinkedOnChain } from "../../pairing/deviceLink";
import { WebAuthnService } from "../../passkey/webauthnService";
import { getActiveChainId } from "../../core/activeChain";
import { getNetwork } from "../../core/networks";
import type { ExtChainId } from "../../core/networks";
import { getWalletTokens } from "../../data/balances";
import type { TokenItem, WalletBalances } from "../../data/balances";
import { Logo } from "../ui/Logo";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { TokenIcon } from "../ui/TokenIcon";

// Minimal ERC-20 transfer ABI
const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface SendScreenProps {
  onBack: () => void;
  defaultTokenSymbol?: string;
}

type SendState = "form" | "sending" | "success" | "error";

function formatAmount(n: number, decimals = 4): string {
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

export function SendScreen({ onBack, defaultTokenSymbol }: SendScreenProps) {
  const [chainId, setChainId] = useState<ExtChainId | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [linkedError, setLinkedError] = useState<string | null>(null);

  // Form fields
  const [recipient, setRecipient] = useState("");
  const [selectedToken, setSelectedToken] = useState<TokenItem | null>(null);
  const [amount, setAmount] = useState("");
  const [showTokenPicker, setShowTokenPicker] = useState(false);

  // Send state
  const [sendState, setSendState] = useState<SendState>("form");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Validation
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLinkedError(null);
    try {
      const user = await AuthService.getUser();
      if (!user) throw new Error("Not signed in");
      const cid = await getActiveChainId();
      setChainId(cid);
      const wallet = await WalletResolver.getForChain(user.id, cid);
      if (!wallet) throw new Error("No account on this chain");
      if (!wallet.isDeployed) throw new Error("Account not deployed — set up in the Trezo mobile app first");
      setWalletAddress(wallet.address);

      // Device link check
      const meta = await WebAuthnService.getStored();
      if (!meta) {
        setLinkedError("No passkey found. Pair this device in the Trezo mobile app before sending.");
        return;
      }
      const linked = await isDeviceLinkedOnChain(cid, wallet.address, meta.credentialIdRaw as `0x${string}`);
      if (!linked) {
        setLinkedError(`This device isn't linked on this chain. Link it in the Trezo mobile app.`);
        return;
      }

      // Load tokens — pre-select the token the user came from (if any)
      const bal = await getWalletTokens(wallet.address as `0x${string}`, cid);
      setBalances(bal);
      if (bal.tokens.length > 0) {
        const match = defaultTokenSymbol
          ? bal.tokens.find((t) => t.symbol.toLowerCase() === defaultTokenSymbol.toLowerCase())
          : undefined;
        setSelectedToken(match ?? bal.tokens[0]);
      }
    } catch (e) {
      setLinkedError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [defaultTokenSymbol]);

  useEffect(() => { void load(); }, [load]);

  const chainName = chainId ? (() => {
    try { return getNetwork(chainId).name; } catch { return `Chain ${chainId}`; }
  })() : "…";
  const chainShort = chainName.replace("Ethereum ", "").replace(" Testnet", "");

  function validateRecipient(val: string): boolean {
    if (!val.trim()) { setRecipientError("Recipient address is required"); return false; }
    if (!isAddress(val.trim())) { setRecipientError("Not a valid 0x address"); return false; }
    setRecipientError(null);
    return true;
  }

  function validateAmount(val: string, token: TokenItem | null): boolean {
    if (!val.trim()) { setAmountError("Amount is required"); return false; }
    if (/[eE]/.test(val.trim())) { setAmountError("Use decimal notation (e.g. 1000, not 1e3)"); return false; }
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) { setAmountError("Enter a valid amount > 0"); return false; }
    if (token && num > token.amount) { setAmountError(`Insufficient balance (max ${formatAmount(token.amount)} ${token.symbol})`); return false; }
    setAmountError(null);
    return true;
  }

  function setMax() {
    if (!selectedToken) return;
    setAmount(selectedToken.amount.toString());
  }

  async function send() {
    const recOk = validateRecipient(recipient);
    const amtOk = validateAmount(amount, selectedToken);
    if (!recOk || !amtOk || !selectedToken || !chainId || !walletAddress) return;

    setSendState("sending");
    setSendError(null);

    try {
      const recipientAddr = recipient.trim() as `0x${string}`;
      let tx: { to: `0x${string}`; value: `0x${string}`; data: `0x${string}` };

      if (selectedToken.native) {
        // Native ETH transfer
        const value = parseEther(amount);
        tx = {
          to: recipientAddr,
          value: `0x${value.toString(16)}` as `0x${string}`,
          data: "0x",
        };
      } else {
        // ERC-20 transfer
        const tokenAmount = parseUnits(amount, selectedToken.decimals);
        const data = encodeFunctionData({
          abi: ERC20_TRANSFER_ABI,
          functionName: "transfer",
          args: [recipientAddr, tokenAmount],
        });
        tx = {
          to: selectedToken.address as `0x${string}`,
          value: "0x0",
          data,
        };
      }

      // Route through the approval window (background opens TxConfirmSheet)
      const timeout = new Promise<{ error: string }>((resolve) =>
        setTimeout(() => resolve({ error: "Approval timed out. Please try again." }), 120_000)
      );
      const result = await Promise.race([
        new Promise<{ hash: string } | { error: string }>((resolve) => {
          const id = `send-${Date.now()}`;
          chrome.runtime.sendMessage(
            {
              type: "trezo-internal-tx",
              id,
              chainId,
              tx,
            },
            (resp: unknown) => {
              if (chrome.runtime.lastError) {
                resolve({ error: chrome.runtime.lastError.message ?? "Runtime error" });
              } else if (resp && typeof resp === "object" && "hash" in resp) {
                resolve({ hash: (resp as { hash: string }).hash });
              } else if (resp && typeof resp === "object" && "error" in resp) {
                resolve({ error: (resp as { error: string }).error });
              } else {
                resolve({ error: "Unexpected response from background" });
              }
            },
          );
        }),
        timeout,
      ]);

      if ("error" in result) {
        setSendError(result.error);
        setSendState("error");
      } else {
        setTxHash(result.hash);
        setSendState("success");
      }
    } catch (e) {
      const rawErr = e instanceof Error ? e.message : "Send failed";
      const friendlyErr = rawErr.includes("AA21") ? "Account not funded for gas (AA21). Your sponsor may be unavailable." :
        rawErr.includes("AA25") ? "Nonce error — please retry (AA25)." :
        rawErr.includes("AA33") ? "Signature verification failed (AA33). Ensure your passkey is linked on this chain." :
        rawErr.includes("insufficient funds") ? "Insufficient balance for this transfer." :
        rawErr.includes("revert") ? "Transaction reverted on-chain. Check your inputs." :
        rawErr;
      setSendError(friendlyErr);
      setSendState("error");
    }
  }

  const explorerLink = txHash && chainId ? (() => {
    try {
      return `${getNetwork(chainId).blockExplorerUrl}/tx/${txHash}`;
    } catch {
      const net = chainId === 11155111 ? "sepolia" : "base-sepolia";
      return `https://jiffyscan.xyz/userOpHash/${txHash}?network=${net}`;
    }
  })() : null;

  return (
    <div
      className="flex flex-col min-h-screen font-sans"
      style={{ background: "var(--surface)", color: "var(--text)" }}
    >
      <div className="flex-1 p-4 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-[18px]">
          <div className="flex items-center gap-[9px]">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center w-[34px] h-[34px] rounded-[10px] cursor-pointer transition-all duration-[180ms] border-0"
              style={{ background: "rgba(244,241,234,.03)", border: "1px solid rgba(124,58,237,.13)", color: "var(--text-2)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)";
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,.13)";
              }}
              aria-label="Back"
            >
              <ArrowLeft size={16} strokeWidth={1.9} />
            </button>
            <Logo size={26} />
            <b className="text-[15px] font-semibold tracking-tight">Send</b>
          </div>
          {chainId && <Chip label={chainShort} />}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center gap-2 mt-8 justify-center" style={{ color: "var(--text-2)" }}>
            <Spinner size={14} />
            <span className="text-[13px]">Loading…</span>
          </div>
        )}

        {/* Device link error */}
        {!loading && linkedError && (
          <div className="flex flex-col gap-3">
            <div
              className="rounded-[13px] p-3 text-[12.5px]"
              style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.18)", color: "#F59E0B" }}
            >
              {linkedError}
            </div>
            <Button variant="ghost" onClick={onBack}>Back</Button>
          </div>
        )}

        {/* Success state */}
        {sendState === "success" && (
          <div className="flex flex-col gap-3">
            <div
              className="rounded-[13px] p-4 flex flex-col items-center gap-2 text-center"
              style={{ background: "rgba(52,211,153,.08)", border: "1px solid rgba(52,211,153,.2)" }}
            >
              <div
                className="w-[46px] h-[46px] rounded-full grid place-items-center"
                style={{ background: "rgba(52,211,153,.13)" }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: "#34D399" }}>
                Sent!
              </h2>
              <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
                Your transaction was submitted. Check Activity for confirmation.
              </p>
            </div>
            {explorerLink && txHash && (
              <Card>
                <span className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[6px]" style={{ color: "var(--text-3)" }}>
                  Transaction
                </span>
                <code className="text-[11.5px] break-all" style={{ fontFamily: "var(--mono)", color: "var(--text)" }}>
                  {txHash.slice(0, 10)}…{txHash.slice(-8)}
                </code>
                <div className="h-px my-[10px]" style={{ background: "rgba(124,58,237,.07)" }} />
                <a
                  href={explorerLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12.5px] font-medium"
                  style={{ color: "var(--accent-2)", textDecoration: "none" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = "none"; }}
                >
                  View on explorer ↗
                </a>
              </Card>
            )}
            <Button variant="ghost" onClick={onBack}>Back to wallet</Button>
          </div>
        )}

        {/* Error state */}
        {sendState === "error" && (
          <div className="flex flex-col gap-3">
            <div
              className="rounded-[13px] p-3 text-[12.5px]"
              style={{ background: "rgba(232,101,79,.08)", border: "1px solid rgba(232,101,79,.18)", color: "#E8654F" }}
            >
              {sendError ?? "Transaction failed"}
            </div>
            <Button variant="primary" onClick={() => { setSendState("form"); setSendError(null); }}>
              Try again
            </Button>
            <Button variant="ghost" onClick={onBack}>Back</Button>
          </div>
        )}

        {/* Form */}
        {!loading && !linkedError && (sendState === "form" || sendState === "sending") && (
          <div className="flex flex-col gap-3">
            {/* Recipient */}
            <div className="flex flex-col gap-[6px]">
              <label className="text-[11px] tracking-[.07em] uppercase font-semibold" style={{ color: "var(--text-3)" }}>
                Recipient
              </label>
              <Input
                placeholder="0x… recipient address"
                value={recipient}
                onChange={(e) => { setRecipient(e.target.value); if (recipientError) validateRecipient(e.target.value); }}
                onBlur={() => validateRecipient(recipient)}
              />
              {recipientError && (
                <span className="text-[11.5px]" style={{ color: "#E8654F" }}>{recipientError}</span>
              )}
            </div>

            {balances !== null && balances.tokens.length === 0 && (
              <div
                className="rounded-[13px] p-3 text-[12.5px]"
                style={{ background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.18)", color: "#F59E0B" }}
              >
                No tokens found on this chain. Fund your wallet before sending.
              </div>
            )}

            {/* Asset picker */}
            <div className="flex flex-col gap-[6px]">
              <label className="text-[11px] tracking-[.07em] uppercase font-semibold" style={{ color: "var(--text-3)" }}>
                Asset
              </label>

              {/* Trigger */}
              <button
                type="button"
                onClick={() => setShowTokenPicker((v) => !v)}
                className="flex items-center gap-2 px-[15px] py-3 rounded-chip cursor-pointer transition-all duration-[180ms] border-0"
                style={{
                  background: "rgba(12,10,16,.85)",
                  border: "1px solid rgba(124,58,237,.16)",
                  color: "var(--text)",
                }}
              >
                {selectedToken ? (
                  <>
                    <TokenIcon symbol={selectedToken.symbol} size={22} />
                    <span className="flex-1 text-left text-sm font-medium">
                      {selectedToken.symbol} — {formatAmount(selectedToken.amount)} available
                    </span>
                  </>
                ) : (
                  <span className="flex-1 text-left text-sm" style={{ color: "var(--text-3)" }}>Select asset…</span>
                )}
                <ChevronDown size={14} strokeWidth={1.9} style={{ color: "var(--text-2)" }} />
              </button>

              {/* Dropdown */}
              {showTokenPicker && balances && (
                <Card className="flex flex-col gap-0 p-0 overflow-hidden">
                  {balances.tokens.map((token, idx) => {
                    const isLast = idx === balances.tokens.length - 1;
                    return (
                      <button
                        key={token.address}
                        type="button"
                        onClick={() => { setSelectedToken(token); setShowTokenPicker(false); setAmount(""); }}
                        className="flex items-center gap-2 px-[14px] py-[11px] cursor-pointer transition-all duration-[150ms] border-0"
                        style={{
                          background: selectedToken?.address === token.address ? "rgba(124,58,237,.1)" : "transparent",
                          borderBottom: isLast ? "none" : "1px solid rgba(124,58,237,.07)",
                          color: "var(--text)",
                          textAlign: "left",
                        }}
                        onMouseEnter={(e) => {
                          if (selectedToken?.address !== token.address)
                            (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,.06)";
                        }}
                        onMouseLeave={(e) => {
                          if (selectedToken?.address !== token.address)
                            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                        }}
                      >
                        <TokenIcon symbol={token.symbol} size={22} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{token.symbol}</div>
                          <div className="text-[11.5px]" style={{ color: "var(--text-2)" }}>{token.name}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[12.5px] font-semibold font-mono">{formatAmount(token.amount)}</div>
                        </div>
                      </button>
                    );
                  })}
                </Card>
              )}
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-[6px]">
              <label className="text-[11px] tracking-[.07em] uppercase font-semibold" style={{ color: "var(--text-3)" }}>
                Amount
              </label>
              <div className="relative flex items-center">
                <Input
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="any"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); if (amountError) validateAmount(e.target.value, selectedToken); }}
                  onBlur={() => validateAmount(amount, selectedToken)}
                  className="pr-[68px]"
                />
                <button
                  type="button"
                  onClick={setMax}
                  className="absolute right-[11px] px-[10px] py-[5px] rounded-[8px] text-[11px] font-semibold cursor-pointer border-0 transition-all duration-[150ms]"
                  style={{ background: "rgba(124,58,237,.2)", color: "var(--accent)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,.3)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,.2)"; }}
                >
                  Max
                </button>
              </div>
              {amountError && (
                <span className="text-[11.5px]" style={{ color: "#E8654F" }}>{amountError}</span>
              )}
              {selectedToken && (
                <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
                  Available: {formatAmount(selectedToken.amount)} {selectedToken.symbol}
                </span>
              )}
            </div>

            {/* Gas sponsored note */}
            <div
              className="flex items-center gap-[7px] px-[12px] py-[10px] rounded-[12px]"
              style={{ background: "rgba(52,211,153,.05)", border: "1px solid rgba(52,211,153,.12)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span className="text-[12px] font-semibold" style={{ color: "#34D399" }}>Gas sponsored</span>
              <span className="text-[12px]" style={{ color: "var(--text-3)" }}>· no ETH needed for fees</span>
            </div>

            {/* Submit */}
            <Button
              variant="primary"
              loading={sendState === "sending"}
              disabled={sendState === "sending" || !selectedToken || balances?.tokens.length === 0}
              onClick={() => { void send(); }}
            >
              {sendState === "sending" ? "Waiting for approval…" : "Review & Send"}
            </Button>
            <Button variant="ghost" disabled={false} onClick={onBack}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
