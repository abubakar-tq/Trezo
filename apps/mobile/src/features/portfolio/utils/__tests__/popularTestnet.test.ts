import { popularTestnetTokens } from "../popularTestnet";

// ── tiny assert helpers ─────────────────────────────────────────────────────
let passed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  passed++;
}

// ── tests ────────────────────────────────────────────────────────────────────
console.log("running popularTestnet.test.ts");

// base-sepolia includes LINK
{
  const tokens = popularTestnetTokens("base-sepolia");
  const symbols = tokens.map((t) => t.symbol);
  assertEqual(symbols.includes("LINK"), true, "base-sepolia: LINK is included");
}

// ethereum-sepolia does NOT include LINK
{
  const tokens = popularTestnetTokens("ethereum-sepolia");
  const symbols = tokens.map((t) => t.symbol);
  assertEqual(symbols.includes("LINK"), false, "ethereum-sepolia: LINK is NOT included");
}

// arbitrum-sepolia does NOT include LINK
{
  const tokens = popularTestnetTokens("arbitrum-sepolia");
  const symbols = tokens.map((t) => t.symbol);
  assertEqual(symbols.includes("LINK"), false, "arbitrum-sepolia: LINK is NOT included");
}

// ETH always action "buy"
{
  const tokens = popularTestnetTokens("base-sepolia");
  const eth = tokens.find((t) => t.symbol === "ETH");
  assertEqual(eth !== undefined, true, "ETH present on base-sepolia");
  assertEqual(eth!.action, "buy", "ETH action is 'buy'");
}

{
  const tokens = popularTestnetTokens("ethereum-sepolia");
  const eth = tokens.find((t) => t.symbol === "ETH");
  assertEqual(eth !== undefined, true, "ETH present on ethereum-sepolia");
  assertEqual(eth!.action, "buy", "ETH action is 'buy' on ethereum-sepolia");
}

// USDC always action "swap"
{
  const tokens = popularTestnetTokens("base-sepolia");
  const usdc = tokens.find((t) => t.symbol === "USDC");
  assertEqual(usdc !== undefined, true, "USDC present on base-sepolia");
  assertEqual(usdc!.action, "swap", "USDC action is 'swap'");
}

{
  const tokens = popularTestnetTokens("ethereum-sepolia");
  const usdc = tokens.find((t) => t.symbol === "USDC");
  assertEqual(usdc !== undefined, true, "USDC present on ethereum-sepolia");
  assertEqual(usdc!.action, "swap", "USDC action is 'swap' on ethereum-sepolia");
}

// LINK action is "swap" on base-sepolia
{
  const tokens = popularTestnetTokens("base-sepolia");
  const link = tokens.find((t) => t.symbol === "LINK");
  assertEqual(link !== undefined, true, "LINK present on base-sepolia");
  assertEqual(link!.action, "swap", "LINK action is 'swap' on base-sepolia");
}

// base-sepolia returns exactly 3 tokens (ETH + USDC + LINK)
{
  const tokens = popularTestnetTokens("base-sepolia");
  assertEqual(tokens.length, 3, "base-sepolia: 3 tokens total");
}

// other networks return exactly 2 tokens (ETH + USDC)
{
  const tokens = popularTestnetTokens("ethereum-sepolia");
  assertEqual(tokens.length, 2, "ethereum-sepolia: 2 tokens total");
}

{
  const tokens = popularTestnetTokens("arbitrum-sepolia");
  assertEqual(tokens.length, 2, "arbitrum-sepolia: 2 tokens total");
}

// ETH is always first (index 0)
{
  const tokens = popularTestnetTokens("base-sepolia");
  assertEqual(tokens[0].symbol, "ETH", "base-sepolia: ETH is first");
}

{
  const tokens = popularTestnetTokens("ethereum-sepolia");
  assertEqual(tokens[0].symbol, "ETH", "ethereum-sepolia: ETH is first");
}

console.log(`OK popularTestnet.test.ts (${passed} assertions)`);
