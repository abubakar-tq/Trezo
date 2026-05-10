// String injected into the WebView via react-native-webview's injectedJavaScriptBeforeContentLoaded.
// Must be ES5-compatible — runs in arbitrary dApp environments. Self-contained.

export const INJECTED_PROVIDER_SCRIPT = `
(function () {
  if (window.ethereum) return;
  var pending = {};
  function rid() { return Math.random().toString(36).slice(2) + Date.now(); }

  function send(method, params) {
    return new Promise(function (resolve, reject) {
      var id = rid();
      pending[id] = { resolve: resolve, reject: reject };
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "rpc", id: id, method: method, params: params }));
    });
  }

  var listeners = {};

  window.ethereum = {
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
