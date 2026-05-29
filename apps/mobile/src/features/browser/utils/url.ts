// Extracts a clean display hostname from a URL (strips scheme, www., port, path).
// Returns the raw input unchanged when it is not a parseable URL.
// `URL` is global in Node and polyfilled in the app via react-native-url-polyfill.
export function getHostname(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    return rawUrl;
  }
}
