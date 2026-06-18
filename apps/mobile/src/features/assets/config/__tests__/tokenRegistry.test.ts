/**
 * tokenRegistry.test.ts
 *
 * Regression guard for the "Send shows only ETH" bug.
 *
 * SendScreen lists tokens via TokenRegistryService.listTokensForNetwork(),
 * whose buildTokenMapForNetwork folds BUILTIN_TOKENS_BY_NETWORK on top of
 * native ETH + deployment-manifest tokens. The legacy listTokens(chainId)
 * path SendScreen used before skipped these builtins, so on testnets whose
 * deployment manifest has no `usdc` (e.g. Base Sepolia) the Send flow
 * collapsed to ETH only — even though the account held USDC.
 *
 * This locks the invariant that the builtin registry carries the ERC20s the
 * Send list depends on. tokenRegistry.ts has only type-only imports, so this
 * runs under `npx tsx` without pulling react-native.
 */
import { BUILTIN_TOKENS_BY_NETWORK } from "../tokenRegistry";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

type NK = keyof typeof BUILTIN_TOKENS_BY_NETWORK;

const findToken = (networkKey: NK, symbol: string) =>
  BUILTIN_TOKENS_BY_NETWORK[networkKey].find((t) => t.symbol === symbol);

// ── Base Sepolia (the demo testnet) MUST expose USDC so Send is not ETH-only ──
const baseUsdc = findToken("base-sepolia", "USDC");
assert(Boolean(baseUsdc), "Base Sepolia builtin USDC present");
assert(baseUsdc!.type === "erc20", "Base Sepolia USDC is erc20");
assert(baseUsdc!.decimals === 6, "Base Sepolia USDC has 6 decimals");
assert(/^0x[0-9a-fA-F]{40}$/.test(baseUsdc!.address), "Base Sepolia USDC address is valid");
assert(baseUsdc!.chainId === 84532, "Base Sepolia USDC chainId is 84532");

const baseWeth = findToken("base-sepolia", "WETH");
assert(Boolean(baseWeth), "Base Sepolia builtin WETH present");

// ── Sibling testnets carry USDC too (the same Send path applies on each) ──
for (const nk of ["ethereum-sepolia"] as const) {
  const usdc = findToken(nk, "USDC");
  assert(Boolean(usdc), `${nk} builtin USDC present`);
  assert(usdc!.decimals === 6, `${nk} USDC has 6 decimals`);
}

console.log("OK");
