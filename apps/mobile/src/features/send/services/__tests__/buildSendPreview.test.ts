import { buildSendPreview } from "../buildSendPreview";

function assert(c: boolean, m: string): void { if (!c) throw new Error(`assert failed: ${m}`); }

const prepared: any = {
  intent: { chainId: 84532, walletAddress: "0xacc", token: { symbol: "ETH", name: "Ethereum", type: "native", decimals: 18 } },
  validation: { amountRaw: 50000000000000000n, recipient: "0x7a3f000000000000000000000000000000000C21", token: { symbol: "ETH", name: "Ethereum", type: "native", decimals: 18 }, feeMode: "sponsored" },
  execution: { chainId: 84532, account: "0xacc", target: "0x7a3f000000000000000000000000000000000C21", value: 50000000000000000n, data: "0x", networkKey: "base-sepolia" },
  targetAddress: "0x7a3f000000000000000000000000000000000C21", valueRaw: 50000000000000000n, calldata: "0x",
};

function run(): void {
  const p = buildSendPreview(prepared, "Base Sepolia");
  assert(p.kind === "send", "kind send");
  assert(p.assetDeltas.length === 1 && p.assetDeltas[0].direction === "out", "one out delta");
  assert(p.assetDeltas[0].amountDisplay === "0.05", `display 0.05, got ${p.assetDeltas[0].amountDisplay}`);
  assert(!!p.recipientDisplay && p.recipientDisplay.includes("…"), "recipient truncated");
  assert(p.calls.length === 1 && p.calls[0].to === "0x7a3f000000000000000000000000000000000C21", "call target");
  console.log("OK");
}
run();
