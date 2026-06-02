import type { RpcRequestMsg, RpcResponseMsg, ProviderEventMsg } from "./types/messages";

// inpage.ts is injected into the page's MAIN world by the manifest (world: "MAIN"
// content script), so no manual injection is needed here. This relay only bridges
// window.postMessage (page) <-> chrome.runtime (background).

// Page -> background
window.addEventListener("message", (ev: MessageEvent) => {
  const msg = ev.data as RpcRequestMsg;
  if (ev.source !== window || !msg || msg.type !== "trezo-rpc") return;
  chrome.runtime.sendMessage(
    { ...msg, origin: window.location.origin },
    (resp: RpcResponseMsg) => {
      if (chrome.runtime.lastError || !resp) {
        window.postMessage(
          { type: "trezo-rpc-response", id: msg.id, error: { code: -32603, message: "Trezo: wallet unavailable (service worker restarted)" } },
          "*",
        );
        return;
      }
      window.postMessage(
        { type: "trezo-rpc-response", id: msg.id, result: resp?.result, error: resp?.error },
        "*",
      );
    },
  );
});

// Background -> page (provider events: accountsChanged, chainChanged)
chrome.runtime.onMessage.addListener((msg: ProviderEventMsg) => {
  if (msg?.type === "trezo-event") window.postMessage(msg, "*");
});
