import { getHostname } from "../url";

function assertEqual(a: unknown, b: unknown, msg: string): void {
  if (a !== b) throw new Error(`assertEqual failed: ${msg}\n  expected: ${String(b)}\n  actual:   ${String(a)}`);
}

function run(): void {
  assertEqual(getHostname("https://app.uniswap.org/swap?x=1"), "app.uniswap.org", "path/query stripped");
  assertEqual(getHostname("https://www.coingecko.com"), "coingecko.com", "www. stripped");
  assertEqual(getHostname("http://example.com:8080/a"), "example.com", "port stripped");
  assertEqual(getHostname("not a url"), "not a url", "non-URL returned as-is");
  assertEqual(getHostname(""), "", "empty returned as-is");
  console.log("OK url");
}

run();
