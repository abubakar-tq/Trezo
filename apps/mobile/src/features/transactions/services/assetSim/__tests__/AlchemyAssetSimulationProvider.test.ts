import { AlchemyAssetSimulationProvider } from "../AlchemyAssetSimulationProvider";
import { NullAssetSimulationProvider } from "../AssetSimulationProvider";

function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(`assert failed: ${msg}`); }

const sampleResponse = {
  jsonrpc: "2.0", id: 1,
  result: {
    changes: [
      { assetType: "NATIVE", changeType: "TRANSFER", from: "0xacc", to: "0xtarget", rawAmount: "100000000000000000", symbol: "ETH", decimals: 18, amount: "0.1" },
      { assetType: "ERC20", changeType: "TRANSFER", from: "0xtarget", to: "0xacc", rawAmount: "12400000000000000000", contractAddress: "0xuni", symbol: "UNI", decimals: 18, amount: "12.4" },
      { assetType: "ERC20", changeType: "APPROVE", from: "0xacc", to: "0xuni", rawAmount: "0", contractAddress: "0xuni", symbol: "UNI", decimals: 18, amount: "0" },
    ],
  },
};

async function run(): Promise<void> {
  // happy path
  const fakeFetch = async () => ({ ok: true, json: async () => sampleResponse }) as unknown as Response;
  const provider = new AlchemyAssetSimulationProvider("https://example/alchemy", fakeFetch);
  const res = await provider.simulate({
    account: "0xacc" as `0x${string}`, chainId: 84532,
    call: { to: "0xuni" as `0x${string}`, value: 100000000000000000n, data: "0x" as `0x${string}` },
  });
  assert(res !== null, "got result");
  assert(res!.deltas.length === 2, `2 transfer deltas, got ${res!.deltas.length}`);
  assert(res!.deltas[0].direction === "out" && res!.deltas[0].symbol === "ETH", "ETH out");
  assert(res!.deltas[1].direction === "in" && res!.deltas[1].symbol === "UNI", "UNI in");
  assert(res!.warnings.length === 1 && res!.warnings[0].includes("approval"), "approval warning");

  // degrade: http error -> null
  const errFetch = async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response;
  const p2 = new AlchemyAssetSimulationProvider("https://example/alchemy", errFetch);
  const res2 = await p2.simulate({ account: "0xacc" as `0x${string}`, chainId: 84532, call: { to: "0x" as `0x${string}`, value: 0n, data: "0x" as `0x${string}` } });
  assert(res2 === null, "http error degrades to null");

  // Null provider always null
  const res3 = await new NullAssetSimulationProvider().simulate({ account: "0xacc" as `0x${string}`, chainId: 84532, call: { to: "0x" as `0x${string}`, value: 0n, data: "0x" as `0x${string}` } });
  assert(res3 === null, "null provider returns null");

  console.log("OK");
}
run().then(() => {}).catch((e) => { console.error(e); process.exit(1); });
