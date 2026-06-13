import { useState } from "react";
import { AuthService } from "../../auth/authService";
import { Logo } from "../ui/Logo";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export function LoginScreen({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleBusy(true);
    setErr(null);
    try {
      await AuthService.signInWithGoogle();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Google sign-in failed");
    } finally {
      setGoogleBusy(false);
    }
  }

  async function handleSignIn() {
    setBusy(true);
    setErr(null);
    try {
      await AuthService.signInWithEmail(email, password);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen font-sans" style={{ background: "var(--surface)", color: "var(--text)" }}>
      <div className="flex-1 flex flex-col justify-center px-[18px] py-[22px]">
        {/* Header */}
        <div className="flex flex-col items-center mb-[18px]">
          <Logo size={46} className="mb-[11px]" />
          <h2 className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            Sign in to Trezo
          </h2>
          <p className="text-[12.5px] leading-[1.55] mt-[5px] text-center" style={{ color: "var(--text-2)" }}>
            Sign in with the same account you use on the Trezo mobile app.
          </p>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-[10px]">
          <Input
            placeholder="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleSignIn(); }}
          />

          {err && (
            <p className="text-[12px]" style={{ color: "var(--danger)" }}>{err}</p>
          )}

          <Button
            variant="primary"
            loading={busy}
            disabled={busy}
            onClick={handleSignIn}
            className="mt-[2px]"
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>

          {/* Divider */}
          <div
            className="flex items-center gap-3 my-[4px] text-[10.5px] tracking-[.1em] uppercase"
            style={{ color: "var(--text-3)" }}
          >
            <span className="flex-1 h-px" style={{ background: "var(--border)" }} />
            or continue with
            <span className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>

          {/* Google social button */}
          <button
            type="button"
            disabled={googleBusy || busy}
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-[9px] px-3 py-3 rounded-btn text-[13.5px] font-semibold transition-all duration-[180ms] border-0"
            style={{
              background: "rgba(244,241,234,.04)",
              border: "1px solid rgba(124,58,237,.13)",
              color: "var(--text)",
              cursor: googleBusy || busy ? "not-allowed" : "pointer",
              opacity: googleBusy || busy ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!googleBusy && !busy)
                (e.currentTarget as HTMLButtonElement).style.background = "rgba(244,241,234,.07)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(244,241,234,.04)";
            }}
          >
            {googleBusy ? (
              /* Tailwind spinner */
              <span
                className="w-[17px] h-[17px] rounded-full flex-none animate-spin"
                style={{
                  border: "2px solid rgba(244,241,234,.25)",
                  borderTopColor: "var(--text)",
                }}
              />
            ) : (
              /* Google colour-wheel logo */
              <span
                className="w-[17px] h-[17px] rounded-[4px] flex-none"
                style={{
                  background: "conic-gradient(from -45deg,#EA4335,#FBBC05,#34A853,#4285F4,#EA4335)",
                }}
              />
            )}
            {googleBusy ? "Signing in…" : "Google"}
          </button>
        </div>
      </div>
    </div>
  );
}
