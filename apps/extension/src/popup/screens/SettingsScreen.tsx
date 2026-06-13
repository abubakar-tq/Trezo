import { useEffect, useState } from "react";
import { ArrowLeft, Globe, Network, Lock, Info, Fingerprint, Trash2 } from "lucide-react";
import { AuthService } from "../../auth/authService";
import { sessionStore } from "../../rpc/sessionStore";
import type { DAppSession } from "../../rpc/sessionStore";
import { getNetwork, ENABLED_CHAIN_IDS } from "../../core/networks";
import { WebAuthnService, type PasskeyMetadata } from "../../passkey/webauthnService";
import { Logo } from "../ui/Logo";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";

// Read version from manifest if available
const EXT_VERSION = (typeof chrome !== "undefined" && chrome.runtime?.getManifest?.()?.version) ?? "0.0.0";

function chainName(chainId: number): string {
  try { return getNetwork(chainId).name; } catch { return `Chain ${chainId}`; }
}

const NETWORK_NAMES = ENABLED_CHAIN_IDS
  .map((id) => { try { return getNetwork(id).name.replace("Ethereum ", "").replace(" Testnet", ""); } catch { return `Chain ${id}`; } })
  .join(" · ");

interface SettingsScreenProps {
  onBack: () => void;
  onSignedOut: () => void;
}

/** A single settings row */
function SettingRow({
  icon,
  title,
  sub,
  rightSlot,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  rightSlot?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-3 py-[13px] transition-all duration-[150ms]"
      style={{
        cursor: onClick ? "pointer" : "default",
        color: danger && hovered ? "#E8654F" : hovered && onClick ? "var(--accent)" : "var(--text)",
        borderBottom: "1px solid rgba(124,58,237,.07)",
      }}
    >
      {/* Icon */}
      <span
        className="grid place-items-center rounded-[9px] flex-none"
        style={{
          width: 30,
          height: 30,
          background: "rgba(26,21,35,.6)",
          border: "1px solid rgba(124,58,237,.07)",
          color: "var(--text-2)",
        }}
      >
        {icon}
      </span>
      {/* Text */}
      <span className="flex-1 min-w-0">
        <b
          className="text-[13.5px] font-semibold block"
          style={{ color: danger && hovered ? "#E8654F" : "inherit" }}
        >
          {title}
        </b>
        {sub && (
          <small className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
            {sub}
          </small>
        )}
      </span>
      {/* Right slot */}
      {rightSlot && (
        <span className="flex-none" style={{ color: "var(--text-3)" }}>
          {rightSlot}
        </span>
      )}
    </div>
  );
}

export function SettingsScreen({ onBack, onSignedOut }: SettingsScreenProps) {
  const [sessions, setSessions] = useState<DAppSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // This device / passkey state
  const [passkey, setPasskey] = useState<PasskeyMetadata | null>(null);
  const [passkeyLoading, setPasskeyLoading] = useState(true);
  const [removingPasskey, setRemovingPasskey] = useState(false);

  async function loadSessions() {
    setSessionsLoading(true);
    try {
      const all = await sessionStore.getAll();
      setSessions(Object.values(all));
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => { void loadSessions(); }, []);

  useEffect(() => {
    WebAuthnService.getStored()
      .then(setPasskey)
      .finally(() => setPasskeyLoading(false));
  }, []);

  async function disconnect(origin: string) {
    setDisconnecting(origin);
    try {
      // Emit accountsChanged [] to the dApp tab
      await chrome.runtime.sendMessage({ type: "trezo-disconnect-origin", origin });
      await sessionStore.remove(origin);
      await loadSessions();
    } finally {
      setDisconnecting(null);
    }
  }

  async function disconnectAll() {
    if (!window.confirm("Disconnect from all connected dApps?")) return;
    setDisconnecting("all");
    try {
      await chrome.runtime.sendMessage({ type: "trezo-disconnect-all" });
      await loadSessions();
    } finally {
      setDisconnecting(null);
    }
  }

  async function lockWallet() {
    setLocking(true);
    setLockError(null);
    try {
      await AuthService.signOut();
      onSignedOut();
    } catch (e) {
      setLockError(e instanceof Error ? e.message : "Sign-out failed");
    } finally {
      setLocking(false);
    }
  }

  async function removePasskey() {
    if (!window.confirm("Remove the passkey from this device? You will need to pair again to sign transactions.")) return;
    setRemovingPasskey(true);
    try {
      await WebAuthnService.clear();
      setPasskey(null);
    } finally {
      setRemovingPasskey(false);
    }
  }

  return (
    <div
      className="flex flex-col min-h-screen font-sans"
      style={{ background: "var(--surface)", color: "var(--text)" }}
    >
      <div className="flex-1 p-4 pb-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-[9px] mb-[18px]">
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
          <b className="text-[15px] font-semibold tracking-tight">Settings</b>
        </div>

        <div className="flex flex-col gap-3">
          {/* ── Connected Sites ─────────────────────────────────────── */}
          <Card>
            <span className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[2px]" style={{ color: "var(--text-3)" }}>
              Connected sites
            </span>

            {sessionsLoading && (
              <div className="flex items-center gap-2 py-3" style={{ color: "var(--text-2)" }}>
                <Spinner size={12} />
                <span className="text-[12px]">Loading…</span>
              </div>
            )}

            {!sessionsLoading && sessions.length === 0 && (
              <p className="text-[12.5px] py-3" style={{ color: "var(--text-3)" }}>
                No sites connected yet. Visit a dApp to connect.
              </p>
            )}

            {!sessionsLoading && sessions.length > 0 && (
              <div>
                {sessions.map((s, idx) => {
                  const isLast = idx === sessions.length - 1;
                  const shortOrigin = s.origin.replace(/^https?:\/\//, "");
                  return (
                    <div
                      key={s.origin}
                      className="flex items-center gap-2 py-[11px]"
                      style={{ borderBottom: isLast ? "none" : "1px solid rgba(124,58,237,.07)" }}
                    >
                      {/* Favicon placeholder */}
                      <span
                        className="flex-none rounded-[5px]"
                        style={{ width: 16, height: 16, background: "linear-gradient(135deg,#06B6D4,#7C3AED)" }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium truncate">{shortOrigin}</div>
                        <div className="text-[11px]" style={{ color: "var(--text-3)" }}>
                          {s.address.slice(0, 6)}…{s.address.slice(-4)} · {chainName(s.chainId)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => { void disconnect(s.origin); }}
                        disabled={disconnecting === s.origin || disconnecting === "all"}
                        className="text-[11.5px] font-semibold px-[10px] py-[5px] rounded-[8px] cursor-pointer transition-all duration-[150ms] border-0 disabled:opacity-40"
                        style={{ background: "rgba(232,101,79,.1)", color: "#E8654F" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,101,79,.2)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,101,79,.1)"; }}
                      >
                        {disconnecting === s.origin ? "…" : "Disconnect"}
                      </button>
                    </div>
                  );
                })}

                {/* Disconnect all */}
                <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(124,58,237,.07)" }}>
                  <Button
                    variant="ghost"
                    onClick={() => { void disconnectAll(); }}
                    loading={disconnecting === "all"}
                    disabled={!!disconnecting}
                  >
                    Disconnect all sites
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* ── General settings ────────────────────────────────────── */}
          <Card>
            <span className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[2px]" style={{ color: "var(--text-3)" }}>
              Wallet
            </span>

            <div
              style={{
                /* remove last child bottom border via CSS — each SettingRow sets its own borderBottom */
              }}
            >
              {/* Networks */}
              <SettingRow
                icon={<Network size={14} strokeWidth={1.9} />}
                title="Networks"
                sub={NETWORK_NAMES}
                rightSlot={
                  <span className="text-[11px] font-semibold px-[8px] py-[3px] rounded-[6px]" style={{ background: "rgba(52,211,153,.12)", color: "#34D399" }}>
                    Testnet
                  </span>
                }
              />

              {/* Lock wallet */}
              <SettingRow
                icon={<Lock size={14} strokeWidth={1.9} />}
                title={locking ? "Locking…" : "Lock wallet"}
                sub="Sign out of this device"
                onClick={() => { void lockWallet(); }}
                danger
              />
              {lockError && (
                <p className="text-[11.5px] px-[40px]" style={{ color: "var(--danger)" }}>{lockError}</p>
              )}

              {/* About */}
              <div
                className="flex items-center gap-3 py-[13px]"
                style={{
                  // no bottom border on last item
                  color: "var(--text)",
                }}
              >
                <span
                  className="grid place-items-center rounded-[9px] flex-none"
                  style={{
                    width: 30,
                    height: 30,
                    background: "rgba(26,21,35,.6)",
                    border: "1px solid rgba(124,58,237,.07)",
                    color: "var(--text-2)",
                  }}
                >
                  <Info size={14} strokeWidth={1.9} />
                </span>
                <span className="flex-1 min-w-0">
                  <b className="text-[13.5px] font-semibold block">About</b>
                  <small className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
                    Trezo v{EXT_VERSION} · Chrome Extension
                  </small>
                </span>
              </div>
            </div>
          </Card>

          {/* ── This device ─────────────────────────────────────────── */}
          <Card>
            <span className="text-[10px] tracking-[.07em] uppercase font-semibold block mb-[2px]" style={{ color: "var(--text-3)" }}>
              This device
            </span>

            {passkeyLoading && (
              <div className="flex items-center gap-2 py-3" style={{ color: "var(--text-2)" }}>
                <Spinner size={12} />
                <span className="text-[12px]">Loading…</span>
              </div>
            )}

            {!passkeyLoading && !passkey && (
              <p className="text-[12.5px] py-3" style={{ color: "var(--text-3)" }}>
                No passkey on this device — pair it in the mobile app: Profile → Devices → Pair New Device.
              </p>
            )}

            {!passkeyLoading && passkey && (
              <div>
                <div className="flex items-center gap-3 py-[11px]" style={{ borderBottom: "1px solid rgba(124,58,237,.07)" }}>
                  <span
                    className="grid place-items-center rounded-[9px] flex-none"
                    style={{ width: 30, height: 30, background: "rgba(124,58,237,.13)", color: "#7C3AED", border: "1px solid rgba(124,58,237,.2)" }}
                  >
                    <Fingerprint size={14} strokeWidth={1.9} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold">{passkey.deviceName}</div>
                    <div className="text-[11px] font-mono" style={{ color: "var(--text-3)" }}>
                      {passkey.credentialId.slice(0, 16)}…
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 py-[11px]" style={{ borderBottom: "1px solid rgba(124,58,237,.07)" }}>
                  <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>Added</span>
                  <span className="text-[11.5px] ml-auto" style={{ color: "var(--text-2)" }}>
                    {new Date(passkey.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => { void removePasskey(); }}
                    disabled={removingPasskey}
                    className="flex items-center gap-[7px] w-full px-3 py-[9px] rounded-[10px] text-[12.5px] font-semibold cursor-pointer transition-all duration-[150ms] border-0 disabled:opacity-40"
                    style={{ background: "rgba(232,101,79,.08)", color: "#E8654F", border: "1px solid rgba(232,101,79,.15)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,101,79,.14)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,101,79,.08)"; }}
                  >
                    <Trash2 size={13} strokeWidth={1.9} />
                    {removingPasskey ? "Removing…" : "Remove passkey from this device"}
                  </button>
                </div>
              </div>
            )}
          </Card>

          {/* Connected sites info */}
          <div
            className="flex items-start gap-2 px-[12px] py-[10px] rounded-[12px]"
            style={{ background: "rgba(124,58,237,.06)", border: "1px solid rgba(124,58,237,.1)" }}
          >
            <Globe size={13} strokeWidth={1.9} style={{ color: "var(--text-3)", flex: "none", marginTop: 1 }} />
            <p className="text-[11.5px] leading-[1.55]" style={{ color: "var(--text-3)" }}>
              Connected sites can see your wallet address and request transactions. Disconnect a site to revoke its access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
