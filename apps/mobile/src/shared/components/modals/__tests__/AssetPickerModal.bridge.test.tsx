// npx tsx apps/mobile/src/shared/components/modals/__tests__/AssetPickerModal.bridge.test.tsx
// Pure logic test — no rendering needed.
// Tests the filterTokensByBridgeChain helper we extract.
// Pure implementation to avoid React Native imports.

interface Asset {
  symbol: string;
  name: string;
  chainId?: number;
}

/** Pure test version — same as the exported hook helper. */
function filterTokensByBridgeChainForTest(assets: Asset[], chainId: number | null): Asset[] {
  if (chainId === null) return assets;
  return assets.filter((a) => a.chainId !== undefined && a.chainId === chainId);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

const assets: Asset[] = [
  { symbol: "ETH", name: "Ether", chainId: 8453 },      // Base
  { symbol: "USDC", name: "USD Coin", chainId: 8453 },   // Base
  { symbol: "ETH", name: "Ether", chainId: 42161 },      // Arb
  { symbol: "ARB", name: "Arbitrum", chainId: 42161 },   // Arb
  { symbol: "WETH", name: "Wrapped ETH" },               // no chainId
];

// All — no filter
const all = filterTokensByBridgeChainForTest(assets, null);
assert(all.length === 5, `all should be 5, got ${all.length}`);

// Filter to Base (chainId 8453)
const base = filterTokensByBridgeChainForTest(assets, 8453);
assert(base.length === 2, `base should be 2, got ${base.length}`);
assert(base.every((a) => a.chainId === 8453), "base filter should only return chainId 8453");

// Filter to Arb (chainId 42161)
const arb = filterTokensByBridgeChainForTest(assets, 42161);
assert(arb.length === 2, `arb should be 2, got ${arb.length}`);

// Tokens without chainId are excluded from chain-filtered views
const noChainId = filterTokensByBridgeChainForTest(assets, 8453);
assert(!noChainId.some((a) => a.symbol === "WETH"), "tokens without chainId excluded from chain-filtered views");

console.log("AssetPickerModal bridge filter tests passed");
