import {
  RegistryDiscoveryProvider,
  type DiscoveredToken,
  type TokenDiscoveryProvider,
} from "../TokenDiscoveryProvider";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

function assertEqual(a: unknown, b: unknown, msg: string): void {
  const aj = JSON.stringify(a, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  const bj = JSON.stringify(b, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  if (aj !== bj) throw new Error(`assertEqual failed: ${msg}\n  expected: ${bj}\n  actual:   ${aj}`);
}

const fakeClient = {
  multicall: async (_args: { contracts: readonly { address: string; functionName: string; args: unknown[] }[]; allowFailure: boolean }) => [
    { status: "success", result: 0n },                  // USDC: zero -> filtered
    { status: "success", result: 1_000_000n },          // DAI: 1.0
    { status: "failure", error: new Error("rpc") },     // ERR: filtered
  ],
  getBalance: async (_args: { address: string }) => 5n * 10n ** 18n,
} as unknown as Parameters<typeof RegistryDiscoveryProvider.prototype.discover>[2];

const fakeTokens = [
  { type: "erc20", address: "0xUSDC", symbol: "USDC", name: "USD Coin", decimals: 6 },
  { type: "erc20", address: "0xDAI",  symbol: "DAI",  name: "Dai",      decimals: 6 },
  { type: "erc20", address: "0xERR",  symbol: "ERR",  name: "Err",      decimals: 18 },
];

async function run(): Promise<void> {
  const provider: TokenDiscoveryProvider = new RegistryDiscoveryProvider(() => fakeTokens as never);
  const result: DiscoveredToken[] = await provider.discover(31337, "0xWallet" as `0x${string}`, fakeClient);

  assertEqual(result.length, 2, "native + DAI only");
  assert(result[0].address === "native", "native first");
  assertEqual(result[0].amountRaw, 5n * 10n ** 18n, "native balance");
  assertEqual(result[1].symbol, "DAI", "DAI second");
  assertEqual(result[1].amountRaw, 1_000_000n, "DAI balance");
}

run().then(() => console.log("OK")).catch((e) => {
  console.error(e);
  process.exit(1);
});
