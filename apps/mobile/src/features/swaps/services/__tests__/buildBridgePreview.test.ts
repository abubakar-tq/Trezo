import { buildBridgePreview } from "../buildBridgePreview";
function assert(c: boolean, m: string): void { if (!c) throw new Error(`assert failed: ${m}`); }
const plan: any = {
  quote: {
    sourceChainId: 84532, destChainId: 421614, sourceNetworkKey: "base-sepolia",
    inputToken: { symbol: "USDC", name: "USD Coin", type: "erc20", address: "0xusdc", decimals: 6 },
    outputToken: { symbol: "USDC", name: "USD Coin", type: "erc20", address: "0xusdcarb", decimals: 6 },
    inputAmountRaw: 50000000n, outputAmountRaw: 49700000n, feeBps: 60,
  },
  bridgeExecution: { chainId: 84532, account: "0xacc", target: "0xspoke", value: 0n, data: "0xbeef", networkKey: "base-sepolia" },
};
function run(): void {
  const p = buildBridgePreview(plan, { 84532: "Base Sepolia", 421614: "Arbitrum Sepolia" });
  assert(p.kind === "bridge", "kind");
  assert(p.assetDeltas[0].direction === "out" && p.assetDeltas[0].chainId === 84532, "source out");
  assert(p.assetDeltas[1].direction === "in" && p.assetDeltas[1].chainId === 421614, "dest in cross-chain");
  assert(p.assetDeltas[1].amountDisplay === "49.7", `dest amount ${p.assetDeltas[1].amountDisplay}`);
  console.log("OK");
}
run();
