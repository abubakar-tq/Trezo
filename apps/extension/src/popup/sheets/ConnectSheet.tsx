import { useEffect, useState } from "react";
import { resolveApproval, rejectApproval } from "../lib/approvalBridge";
import { AuthService } from "../../auth/authService";
import { WalletResolver } from "../../pairing/walletResolver";
import { WebAuthnService } from "../../passkey/webauthnService";
import { isDeviceLinkedOnChain } from "../../pairing/deviceLink";
import { getNetwork } from "../../core/networks";
import { Logo } from "../ui/Logo";
import { Sheet } from "../ui/Sheet";
import { Card } from "../ui/Card";
import { KV } from "../ui/KV";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { Pill } from "../ui/Pill";

interface ConnectSheetProps {
  req: { id: string; origin: string; chainId: number };
}

export function ConnectSheet({ req }: ConnectSheetProps) {
  const [address, setAddress] = useState<string | null>(null);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chainName = (() => {
    try { return getNetwork(req.chainId).name; } catch { return `Chain ${req.chainId}`; }
  })();

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const user = await AuthService.getUser();
        if (!user) { setError("Not signed in"); return; }
        const wallet = await WalletResolver.getForChain(user.id, req.chainId);
        if (!wallet) { setError(`No account on ${chainName}`); return; }
        setAddress(wallet.address);
        // Check device link status (non-blocking — warning only)
        const meta = await WebAuthnService.getStored();
        if (meta) {
          try {
            const ok = await isDeviceLinkedOnChain(req.chainId, wallet.address, meta.credentialIdRaw as `0x${string}`);
            setLinked(ok);
          } catch {
            setLinked(false);
          }
        } else {
          setLinked(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load wallet");
      } finally {
        setLoading(false);
      }
    })();
  }, [req.chainId, chainName]);

  if (loading) {
    return (
      <Sheet>
        <div className="flex items-center gap-2 mt-4" style={{ color: "var(--text-2)" }}>
          <Spinner size={14} />
          <span className="text-[13px]">Loading…</span>
        </div>
      </Sheet>
    );
  }

  if (error) {
    return (
      <Sheet>
        <div className="flex items-center gap-[9px] mb-[13px]">
          <Logo size={26} />
          <b className="text-[15px] font-semibold tracking-tight">Connect</b>
        </div>
        <p className="text-[12px] mb-4" style={{ color: "var(--danger)" }}>{error}</p>
        <Button
          variant="ghost"
          onClick={() => { void rejectApproval(req.id, error).then(() => window.close()); }}
        >
          Close
        </Button>
      </Sheet>
    );
  }

  return (
    <Sheet>
      {/* Title row */}
      <div className="flex items-center gap-[9px] mb-[13px]">
        <Logo size={26} />
        <b className="text-[15px] font-semibold tracking-tight">Connect</b>
      </div>

      {/* Origin row with favicon placeholder */}
      <div className="flex items-center gap-[7px] mb-[13px] text-[12.5px]" style={{ color: "var(--text-2)" }}>
        <span
          className="w-4 h-4 rounded-[5px] flex-none"
          style={{ background: "linear-gradient(135deg,#06B6D4,#7C3AED)" }}
        />
        {req.origin}
      </div>

      {/* Details card */}
      <Card className="mb-[14px]" style={{ padding: "4px 14px" }}>
        <KV label="Network" value={chainName} />
        <KV
          label="Account"
          value={
            <span className="font-mono text-[12px]">
              {address ? address.slice(0, 6) + "…" + address.slice(-4) : "—"}
            </span>
          }
        />
        <KV label="Status" value={
          linked === true
            ? <Pill tone="ok" showIcon={false}>Linked ✓</Pill>
            : <Pill tone="warn" showIcon={false}>Not linked</Pill>
        } last />
      </Card>

      {/* Device-link warning (non-blocking for connect) */}
      {linked === false && (
        <p className="text-[12px] mb-3" style={{ color: "var(--warning)" }}>
          This device isn&apos;t linked on {chainName} — signing/transactions will need linking first.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button
          variant="primary"
          onClick={() => { void resolveApproval(req.id, address).then(() => window.close()); }}
        >
          Connect
        </Button>
        <Button
          variant="ghost"
          onClick={() => { void rejectApproval(req.id, "User rejected").then(() => window.close()); }}
        >
          Reject
        </Button>
      </div>
    </Sheet>
  );
}
