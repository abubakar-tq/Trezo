import { useEffect, useState } from "react";
import { ArrowLeft, Copy, CheckCheck } from "lucide-react";
import { AuthService } from "../../auth/authService";
import { WalletResolver } from "../../pairing/walletResolver";
import { getActiveChainId } from "../../core/activeChain";
import { getNetwork } from "../../core/networks";
import type { ExtChainId } from "../../core/networks";
import { Logo } from "../ui/Logo";
import { Card } from "../ui/Card";
import { Chip } from "../ui/Chip";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

import * as QRCode from "qrcode";

interface ReceiveScreenProps {
  onBack: () => void;
}

export function ReceiveScreen({ onBack }: ReceiveScreenProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<ExtChainId | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const user = await AuthService.getUser();
        if (!user) throw new Error("Not signed in");
        const cid = await getActiveChainId();
        if (cancelled) return;
        setChainId(cid);
        const wallet = await WalletResolver.getForChain(user.id, cid);
        if (cancelled) return;
        if (!wallet) throw new Error("No account on this chain");
        setAddress(wallet.address);

        // Generate SVG QR code
        QRCode.toString(
          wallet.address,
          { type: "svg", margin: 1, color: { dark: "#F4F1EA", light: "#00000000" } },
          (err, svg) => {
            if (cancelled) return;
            if (err) {
              console.warn("[ReceiveScreen] QR error", err);
            } else {
              setQrSvg(svg);
            }
          },
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard denied
    }
  }

  const chainName = chainId ? (() => {
    try { return getNetwork(chainId).name; } catch { return `Chain ${chainId}`; }
  })() : "…";
  const chainShort = chainName.replace("Ethereum ", "").replace(" Testnet", "");

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
            <b className="text-[15px] font-semibold tracking-tight">Receive</b>
          </div>
          {chainId && <Chip label={chainShort} />}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center gap-2 mt-8 justify-center" style={{ color: "var(--text-2)" }}>
            <Spinner size={14} />
            <span className="text-[13px]">Loading…</span>
          </div>
        )}

        {error && (
          <div
            className="rounded-[13px] p-3 text-[12.5px]"
            style={{ background: "rgba(232,101,79,.08)", border: "1px solid rgba(232,101,79,.18)", color: "#E8654F" }}
          >
            {error}
          </div>
        )}

        {!loading && !error && address && (
          <div className="flex flex-col gap-3">
            {/* QR Code card */}
            <Card className="flex flex-col items-center py-4 gap-1">
              <span
                className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[6px] self-start"
                style={{ color: "var(--text-3)" }}
              >
                Your {chainName} address
              </span>

              {/* QR visual */}
              <div
                className="flex items-center justify-center rounded-[16px] p-3"
                style={{
                  width: 164,
                  height: 164,
                  background: "rgba(20,16,27,.72)",
                  border: "1px solid rgba(124,58,237,.13)",
                }}
              >
                {qrSvg ? (
                  <div
                    style={{ width: 136, height: 136 }}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                ) : (
                  /* Placeholder pattern while generating */
                  <div
                    className="grid place-items-center rounded-[10px]"
                    style={{
                      width: 136,
                      height: 136,
                      background: `repeating-conic-gradient(#0c0a12 0 25%, #15121d 0 50%) 0 0/16px 16px`,
                    }}
                  >
                    <div
                      className="w-[42px] h-[42px] rounded-[10px]"
                      style={{ background: "linear-gradient(150deg,#8B5CF6,#6D28D9)", boxShadow: "0 0 0 6px rgba(14,12,18,.95)" }}
                    />
                  </div>
                )}
              </div>

              <p className="text-[12px] mt-1" style={{ color: "var(--text-2)" }}>
                Scan to receive on {chainShort}
              </p>
            </Card>

            {/* Address card with copy */}
            <Card className="flex flex-col gap-2">
              <span
                className="text-[10px] tracking-[.07em] uppercase font-semibold"
                style={{ color: "var(--text-3)" }}
              >
                Wallet address
              </span>
              <div className="flex items-start gap-2">
                <code
                  className="flex-1 text-[11.5px] leading-[1.6] break-all"
                  style={{ fontFamily: "var(--mono)", color: "var(--text)" }}
                >
                  {address}
                </code>
                <button
                  type="button"
                  onClick={() => { void copyAddress(); }}
                  title={copied ? "Copied!" : "Copy address"}
                  className="flex-none flex items-center justify-center rounded-[9px] cursor-pointer transition-all duration-[150ms] border-0"
                  style={{
                    width: 32,
                    height: 32,
                    background: copied ? "rgba(52,211,153,.13)" : "rgba(124,58,237,.15)",
                    color: copied ? "#34D399" : "var(--accent)",
                    border: `1px solid ${copied ? "rgba(52,211,153,.25)" : "rgba(124,58,237,.2)"}`,
                  }}
                >
                  {copied ? <CheckCheck size={14} strokeWidth={1.9} /> : <Copy size={14} strokeWidth={1.9} />}
                </button>
              </div>
              {copied && (
                <span className="text-[11.5px] font-semibold" style={{ color: "#34D399" }}>
                  Copied!
                </span>
              )}
            </Card>

            {/* Back button */}
            <Button variant="ghost" onClick={onBack}>
              Back to wallet
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
