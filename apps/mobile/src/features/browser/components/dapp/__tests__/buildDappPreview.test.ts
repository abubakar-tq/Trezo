import { buildDappPreview } from "../buildDappPreview";
function assert(c: boolean, m: string): void { if (!c) throw new Error(`assert failed: ${m}`); }
function run(): void {
  const p = buildDappPreview(
    "https://app.uniswap.org/swap",
    { to: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45", data: "0xabcdef", value: "0x16345785d8a0000" },
    "0xacc", 84532, "Base Sepolia",
  );
  assert(p.kind === "dapp", "kind");
  assert(p.origin === "https://app.uniswap.org/swap" && p.contextLabel === "app.uniswap.org", "origin host label");
  assert(p.assetDeltas.length === 1 && p.assetDeltas[0].symbol === "ETH" && p.assetDeltas[0].amountDisplay === "0.1", "native value delta");
  assert(p.calls[0].value === 100000000000000000n && p.calls[0].data === "0xabcdef", "call from hex");
  console.log("OK");
}
run();
