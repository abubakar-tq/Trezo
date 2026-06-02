// Injected into the page MAIN world. EIP-1193 + EIP-6963 provider.
// Transport: window.postMessage to the content script and back.
import { TREZO_PROVIDER_ICON } from "./trezoProviderIcon";

const TREZO_PROVIDER_NAME = "Trezo";
const TREZO_PROVIDER_RDNS = "com.trezo.wallet";
const TREZO_ICON = TREZO_PROVIDER_ICON;

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
const pending: Record<string, Pending> = {};

function rid(): string {
  return crypto.randomUUID().replace(/-/g, '');
}
function send(method: string, params: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = rid();
    // Time out so a dropped response (e.g. service worker died) doesn't hang the
    // dApp promise forever or leak the pending entry.
    const timer = setTimeout(() => {
      if (pending[id]) {
        delete pending[id];
        reject({ code: -32603, message: "Trezo: request timed out" });
      }
    }, 90_000);
    pending[id] = {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    };
    window.postMessage({ type: "trezo-rpc", id, method, params }, "*");
  });
}

const listeners: Record<string, Array<(d: unknown) => void>> = {};

const provider = {
  isTrezo: true,
  isMetaMask: true,
  request(req: { method: string; params?: unknown[] }) {
    return send(req.method, req.params || []);
  },
  on(event: string, cb: (d: unknown) => void) {
    (listeners[event] = listeners[event] || []).push(cb);
  },
  removeListener(event: string, cb: (d: unknown) => void) {
    listeners[event] = (listeners[event] || []).filter((x) => x !== cb);
  },
  enable() {
    return send("eth_requestAccounts", []);
  },
};
Object.freeze(provider);

try {
  (window as unknown as { ethereum?: unknown }).ethereum = provider;
} catch {
  /* some sites freeze window.ethereum; EIP-6963 still works */
}

// Stable UUID so the EIP-6963 wallet-picker identity survives page refreshes
const info = { uuid: 'a5f3e2b1-7c4d-4a8e-9f01-3b2c5d6e7f8a', name: TREZO_PROVIDER_NAME, rdns: TREZO_PROVIDER_RDNS, icon: TREZO_ICON };
function announce() {
  window.dispatchEvent(
    new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info: Object.freeze(info), provider }),
    }),
  );
}
window.addEventListener("eip6963:requestProvider", announce);
// Defer initial announce until DOMContentLoaded so dApp listeners are registered
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', announce, { once: true });
} else {
  announce();
}

window.addEventListener("message", (ev: MessageEvent) => {
  if (ev.source !== window) return; // ignore messages from other frames/extensions
  const msg = ev.data;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "trezo-rpc-response") {
    const p = pending[msg.id];
    if (!p) return;
    delete pending[msg.id];
    if (msg.error) p.reject(msg.error);
    else p.resolve(msg.result);
  } else if (msg.type === "trezo-event") {
    (listeners[msg.event] || []).forEach((cb) => {
      try { cb(msg.data); } catch { /* ignore */ }
    });
  }
});

window.dispatchEvent(new Event("ethereum#initialized"));
