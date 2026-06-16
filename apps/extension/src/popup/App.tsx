import { useEffect, useState } from "react";
import { AuthService } from "../auth/authService";
import { LoginScreen } from "./screens/LoginScreen";
import { PairDeviceScreen } from "./screens/PairDeviceScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ReceiveScreen } from "./screens/ReceiveScreen";
import { SendScreen } from "./screens/SendScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { ConnectSheet } from "./sheets/ConnectSheet";
import { SignSheet } from "./sheets/SignSheet";
import { SignTypedSheet } from "./sheets/SignTypedSheet";
import { TxConfirmSheet } from "./sheets/TxConfirmSheet";
import { nextApproval } from "./lib/approvalBridge";
import type { ApprovalRequest } from "../rpc/approvalManager";

type Screen = "loading" | "login" | "home" | "pair" | "receive" | "send" | "settings";

// Open a long-lived port to keep the service worker alive during WebAuthn
// round-trips (Windows Hello may take several seconds and steal focus).
const _keepAlivePort = chrome.runtime.connect({ name: "trezo-popup-keepalive" });
_keepAlivePort.onDisconnect.addListener(() => {});

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [pairHint, setPairHint] = useState<string | undefined>(undefined);
  const [defaultSendSymbol, setDefaultSendSymbol] = useState<string | undefined>(undefined);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);

  async function refresh() {
    const user = await AuthService.getUser();
    if (!user) {
      setScreen("login");
      return;
    }
    // Dedicated pairing window: ?screen=pair&hint=... opens directly to PairDeviceScreen.
    // This avoids running navigator.credentials in the action popup (which Chrome destroys
    // on focus-loss, crashing the whole WebAuthn ceremony).
    const params = new URLSearchParams(window.location.search);
    if (params.get("screen") === "pair") {
      setPairHint(params.get("hint") ?? undefined);
      setScreen("pair");
      return;
    }
    setScreen("home");
  }

  useEffect(() => { void refresh(); }, []);

  // Poll the approval queue every 500 ms.  Approval sheets take priority over
  // every other screen — the user must act on them first.
  useEffect(() => {
    let alive = true;
    const tick = () => nextApproval().then((r) => { if (alive) setApproval(r); }).catch(() => {});
    tick();
    const interval = setInterval(tick, 500);
    return () => { alive = false; clearInterval(interval); };
  }, []);

  // ── Approval sheets (highest priority) ──────────────────────────────────────
  if (approval?.kind === "connect") return <ConnectSheet req={approval} />;
  if (approval?.kind === "sign") return <SignSheet req={approval} />;
  if (approval?.kind === "signTyped") return <SignTypedSheet req={approval} />;
  if (approval?.kind === "tx") return <TxConfirmSheet req={approval} />;

  // ── Standard navigation ──────────────────────────────────────────────────────
  if (screen === "loading") return <div style={{ padding: 20 }}>Loading…</div>;

  if (screen === "login") return <LoginScreen onDone={refresh} />;

  if (screen === "pair") {
    // If opened as a standalone window (?screen=pair), close on done/back.
    // Otherwise (navigated within the action popup), go home.
    const isStandaloneWindow = new URLSearchParams(window.location.search).get("screen") === "pair";
    return (
      <PairDeviceScreen
        hint={pairHint}
        onPaired={() => {
          if (isStandaloneWindow) { window.close(); return; }
          setPairHint(undefined); setScreen("home");
        }}
        onBack={() => {
          if (isStandaloneWindow) { window.close(); return; }
          setPairHint(undefined); setScreen("home");
        }}
      />
    );
  }

  if (screen === "receive") {
    return <ReceiveScreen onBack={() => setScreen("home")} />;
  }

  if (screen === "send") {
    return (
      <SendScreen
        defaultTokenSymbol={defaultSendSymbol}
        onBack={() => { setDefaultSendSymbol(undefined); setScreen("home"); }}
      />
    );
  }

  if (screen === "settings") {
    return (
      <SettingsScreen
        onBack={() => setScreen("home")}
        onSignedOut={() => setScreen("login")}
      />
    );
  }

  // screen === "home"
  return (
    <HomeScreen
      onGoToPair={(hint) => {
        // Open WebAuthn ceremony in a dedicated window — action popup gets destroyed
        // on focus-loss when Windows Hello opens, crashing the whole ceremony.
        const params = new URLSearchParams({ ctx: "window", screen: "pair" });
        if (hint) params.set("hint", hint);
        void chrome.windows.create({
          url: `${chrome.runtime.getURL("index.html")}?${params}`,
          type: "popup",
          width: 420,
          height: 640,
          focused: true,
        });
      }}
      onReceive={() => setScreen("receive")}
      onSend={(symbol) => { setDefaultSendSymbol(symbol); setScreen("send"); }}
      onSettings={() => setScreen("settings")}
    />
  );
}
