import { useState } from "react";
import { ArrowLeft, Fingerprint } from "lucide-react";
import { AuthService } from "../../auth/authService";
import { DevicePairingService } from "../../pairing/devicePairingService";
import { WebAuthnService } from "../../passkey/webauthnService";
import { setActiveChainId } from "../../core/activeChain";
import { getNetwork, isEnabledChain, type ExtChainId } from "../../core/networks";
import { Logo } from "../ui/Logo";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface PairDeviceScreenProps {
  hint?: string;
  onPaired: () => void;
  onBack?: () => void;
}

export function PairDeviceScreen({ hint, onPaired, onBack }: PairDeviceScreenProps) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pair() {
    setErr(null);
    setBusy(true);
    try {
      const user = await AuthService.getUser();
      if (!user) throw new Error("Sign in first");
      const [requestId, secret] = code.trim().split(":");
      if (!requestId || !secret) throw new Error("Code must be requestId:secret");

      setStatus("Loading pairing request…");
      await DevicePairingService.getPairingRequestForUser({ requestId, secret, userId: user.id });

      setStatus("Preparing passkey (Windows Hello)…");
      const meta = await WebAuthnService.getOrCreate(user.id);

      setStatus("Submitting passkey, waiting for phone approval…");
      await DevicePairingService.submitNewDevicePasskey({
        requestId, secret, userId: user.id,
        passkeyId: meta.credentialIdRaw, credentialId: meta.credentialId,
        publicKeyX: meta.publicKeyX, publicKeyY: meta.publicKeyY,
        deviceName: meta.deviceName, platform: "extension",
      });

      const approved = await DevicePairingService.pollUntilApproved({ requestId, secret, userId: user.id });

      if (isEnabledChain(approved.chain_id)) {
        await setActiveChainId(approved.chain_id as ExtChainId);
      }

      const chainName = isEnabledChain(approved.chain_id)
        ? getNetwork(approved.chain_id).name
        : `chain ${approved.chain_id}`;

      setStatus(`Linked on ${chainName}!`);
      setTimeout(() => onPaired(), 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Pairing failed");
      setCode(""); // clear invalid code so user starts fresh
    } finally {
      setBusy(false);
    }
  }

  const displayHint = hint ?? "On your phone: Profile → Devices → Pair New Device. Paste the code shown.";

  return (
    <div
      className="flex flex-col min-h-screen font-sans"
      style={{ background: "var(--surface)", color: "var(--text)" }}
    >
      <div className="flex-1 p-4">
        {/* Back + Logo header */}
        <div className="flex items-center gap-3 mb-5">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-[13px] cursor-pointer border-0 bg-transparent transition-colors duration-[180ms]"
              style={{ color: "var(--text-2)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
            >
              <ArrowLeft size={15} strokeWidth={2} />
            </button>
          )}
          <div className="flex items-center gap-[9px]">
            <Logo size={26} />
            <b className="text-[15px] font-semibold tracking-tight">Pair device</b>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Hint card */}
          <Card>
            <p className="text-[12.5px] leading-[1.55]" style={{ color: "var(--text-2)" }}>
              {displayHint}
            </p>
          </Card>

          {/* Code input */}
          <Input
            placeholder="Paste the pairing code from your phone"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void pair(); }}
            disabled={busy}
          />

          {/* Windows Hello bio tag */}
          <div
            className="flex items-center gap-[9px] rounded-[12px] px-3 py-[10px] text-[12px]"
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

          <Button
            variant="primary"
            loading={busy}
            disabled={busy}
            onClick={() => { void pair(); }}
          >
            {busy ? status || "Pairing…" : "Pair device"}
          </Button>

          {/* Status messages */}
          {status && !busy && (
            <p className="text-[12.5px] text-center" style={{ color: "var(--success)" }}>{status}</p>
          )}
          {err && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>{err}</p>
          )}
        </div>
      </div>
    </div>
  );
}
