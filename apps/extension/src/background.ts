import type { RpcRequestMsg } from "./types/messages";
import { handleRpc } from "./rpc/rpcRouter";
import { sessionStore } from "./rpc/sessionStore";
import { requestApproval } from "./rpc/approvalManager"; // named import triggers side-effect approval-result listener

console.log("[trezo-bg] service worker booted");

// ── Helper: emit a provider event to all tabs matching an origin ──────────────
async function emitToOrigin(origin: string, event: string, data: unknown): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ url: `${origin}/*` });
    for (const t of tabs) {
      if (t.id) {
        chrome.tabs.sendMessage(t.id, { type: "trezo-event", event, data }).catch(() => {});
      }
    }
  } catch {
    // tabs API may be unavailable in some contexts; swallow silently
  }
}

// ── RPC message handler ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (msg: any, _sender, sendResponse: (r: unknown) => void) => {
    if (!msg || typeof msg !== "object") return;

    // Block disconnect messages from content scripts (tab senders)
    if ((msg.type === "trezo-disconnect-all" || msg.type === "trezo-disconnect-origin") && _sender.tab) return;

    // Popup-initiated: disconnect all connected dApps and emit accountsChanged []
    if (msg.type === "trezo-disconnect-all") {
      void (async () => {
        const sessions = await sessionStore.getAll();
        await Promise.all(
          Object.keys(sessions).flatMap((origin) => [
            emitToOrigin(origin, "accountsChanged", []),
            emitToOrigin(origin, "disconnect", { code: 1013, message: "Trezo: disconnected" }),
          ]),
        );
        await sessionStore.clear();
        sendResponse({ ok: true });
      })();
      return true;
    }

    // Popup-initiated: disconnect a single origin
    if (msg.type === "trezo-disconnect-origin" && msg.origin) {
      void (async () => {
        await emitToOrigin(msg.origin as string, "accountsChanged", []);
        await emitToOrigin(msg.origin as string, "disconnect", { code: 1013, message: "Trezo: disconnected" });
        await sessionStore.remove(msg.origin as string);
        sendResponse({ ok: true });
      })();
      return true;
    }

    // Popup-initiated: internal send (routes through the approval window + TxConfirmSheet)
    if (msg.type === "trezo-internal-tx") {
      void (async () => {
        try {
          // Only the extension popup/approval-window may initiate internal txs; reject tab senders
          if (_sender.tab) {
            sendResponse({ error: "Unauthorized: content scripts cannot initiate internal transactions" });
            return;
          }
          const id = (msg.id as string) ?? `internal-${Date.now()}`;
          const result = await requestApproval({
            kind: "tx",
            id,
            origin: "Trezo Wallet",
            chainId: msg.chainId as number,
            tx: msg.tx as { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` },
          });
          sendResponse({ hash: result as string });
        } catch (e) {
          sendResponse({ error: e instanceof Error ? e.message : "Transaction rejected" });
        }
      })();
      return true; // async response
    }

    // Standard EIP-1193 RPC from content script
    const rpc = msg as RpcRequestMsg;
    if (rpc.type !== "trezo-rpc") return;
    void handleRpc(rpc.id, rpc.method, rpc.params, rpc.origin ?? "")
      .then(sendResponse)
      .catch((e: unknown) =>
        sendResponse({
          type: "trezo-rpc-response",
          id: rpc.id,
          error: { code: -32603, message: e instanceof Error ? e.message : "Internal error" },
        }),
      );
    return true; // keep the message channel open for the async response
  },
);

// ── Popup keep-alive port ─────────────────────────────────────────────────────
// The service worker must stay alive during WebAuthn round-trips (Windows Hello
// may take several seconds and steal focus).  The popup opens a long-lived port;
// we ping it every 20 s to prevent the SW from becoming idle.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "trezo-popup-keepalive") {
    const ping = setInterval(() => {
      try { port.postMessage({ t: "ping" }); } catch { /* port closed */ }
    }, 20_000);
    port.onDisconnect.addListener(() => clearInterval(ping));
  }
});

chrome.runtime.onInstalled.addListener(() => console.log("[trezo-bg] installed"));
