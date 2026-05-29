// String injected into the WebView via react-native-webview's injectedJavaScriptBeforeContentLoaded.
// Must be ES5-compatible — runs in arbitrary dApp environments. Self-contained.

import { TREZO_PROVIDER_ICON } from "./trezoProviderIcon";

// Provider identity (EIP-6963). rdns matches app.config.ts bundleIdentifier.
export const TREZO_PROVIDER_NAME = "Trezo";
export const TREZO_PROVIDER_RDNS = "com.trezo.wallet";

export const INJECTED_PROVIDER_SCRIPT = `
(function () {
  var pending = {};
  function rid() { return Math.random().toString(36).slice(2) + Date.now(); }
  function uuidv4() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function send(method, params) {
    return new Promise(function (resolve, reject) {
      var id = rid();
      pending[id] = { resolve: resolve, reject: reject };
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "rpc", id: id, method: method, params: params }));
    });
  }

  var listeners = {};

  var provider = {
    isTrezo: true,
    isMetaMask: false,
    request: function (req) { return send(req.method, req.params || []); },
    on: function (event, cb) {
      (listeners[event] = listeners[event] || []).push(cb);
    },
    removeListener: function (event, cb) {
      listeners[event] = (listeners[event] || []).filter(function (x) { return x !== cb; });
    },
    enable: function () { return send("eth_requestAccounts", []); },
    sendAsync: function (req, cb) {
      send(req.method, req.params || []).then(
        function (result) { cb(null, { id: req.id, jsonrpc: "2.0", result: result }); },
        function (err) { cb(err, null); }
      );
    },
  };

  // Legacy injection — kept for dApps that still read window.ethereum directly.
  // Guarded: some sites pre-define a non-writable window.ethereum; if assignment throws
  // we swallow it and rely on EIP-6963 (which does not touch window.ethereum at all).
  try { window.ethereum = provider; } catch (e) {}

  // EIP-6963 multi-injected provider discovery — how modern dApps (Uniswap, etc.) list wallets.
  var info = {
    uuid: uuidv4(),
    name: "${TREZO_PROVIDER_NAME}",
    rdns: "${TREZO_PROVIDER_RDNS}",
    icon: "${TREZO_PROVIDER_ICON}"
  };
  function announce() {
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info: info, provider: provider })
    }));
  }
  window.addEventListener("eip6963:requestProvider", announce);
  announce();

  document.addEventListener("trezo:rpc-response", function (ev) {
    var msg = ev.detail;
    var p = pending[msg.id];
    if (!p) return;
    delete pending[msg.id];
    if (msg.error) p.reject(msg.error);
    else p.resolve(msg.result);
  });

  document.addEventListener("trezo:event", function (ev) {
    var msg = ev.detail;
    (listeners[msg.event] || []).forEach(function (cb) { try { cb(msg.data); } catch (e) {} });
  });

  window.dispatchEvent(new Event("ethereum#initialized"));
})();
true;
`;
