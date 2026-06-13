import type WebView from "react-native-webview";

export function respondToRPC(
  webview: WebView | null,
  id: string,
  result?: unknown,
  error?: { code: number; message: string }
) {
  if (!webview) return;
  const payload = error ? { id, error } : { id, result };
  webview.injectJavaScript(
    `document.dispatchEvent(new CustomEvent("trezo:rpc-response", { detail: ${JSON.stringify(payload)} })); true;`
  );
}

export function emitProviderEvent(webview: WebView | null, event: string, data: unknown) {
  if (!webview) return;
  webview.injectJavaScript(
    `document.dispatchEvent(new CustomEvent("trezo:event", { detail: ${JSON.stringify({ event, data })} })); true;`
  );
}
