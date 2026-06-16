import { SimulationService } from "../SimulationService";
import type { TxPreview, GasFee } from "../../types/txPreview";
import type { AssetSimulationProvider } from "../assetSim/AssetSimulationProvider";

function assert(cond: boolean, msg: string): void { if (!cond) throw new Error(`assert failed: ${msg}`); }

const gas: GasFee = { nativeDisplay: "0.0004 ETH", sponsored: true };

const basePreview = (kind: TxPreview["kind"]): TxPreview => ({
  kind, title: "Confirm", account: "0xacc" as `0x${string}`,
  network: { chainId: 84532, name: "Base Sepolia" },
  assetDeltas: [
    { symbol: "ETH", direction: "out", amountRaw: 50000000000000000n, amountDisplay: "0.05", chainId: 84532 },
    { symbol: "USDC", direction: "in", amountRaw: 142610000n, amountDisplay: "142.61", chainId: 84532 },
  ],
  calls: [{ to: "0xtarget" as `0x${string}`, value: 0n, data: "0x1234" as `0x${string}` }],
});

const okClient = { call: async () => ({ data: "0x" }) } as any;
const revertClient = { call: async () => { throw { cause: { data: "0x08c379a0" + "0".repeat(64) }, shortMessage: "execution reverted: STF" }; } } as any;
const nullProvider: AssetSimulationProvider = { simulate: async () => null };
const richProvider: AssetSimulationProvider = { simulate: async () => ({ deltas: [{ symbol: "UNI", direction: "in", rawAmount: 12n, amountDisplay: "12.4", decimals: 18 }], warnings: ["Grants UNI spending approval to 0xuni"] }) };

async function run(): Promise<void> {
  // own flow success -> derived deltas, status success
  const r1 = await SimulationService.simulate(basePreview("swap"), { gasFee: gas, client: okClient, provider: nullProvider });
  assert(r1.status === "success", "swap success");
  assert(r1.source === "derived", "swap derived");
  assert(r1.assetDeltas === undefined, "derived keeps preview deltas (no override)");
  assert(r1.gasFee.sponsored === true, "gas echoed");

  // preflight revert -> status revert + decoded reason, approve will be blocked by UI
  const r2 = await SimulationService.simulate(basePreview("send"), { gasFee: gas, client: revertClient, provider: nullProvider });
  assert(r2.status === "revert", "send revert");
  assert((r2.revertReason ?? "").length > 0, "revert reason present");

  // dapp with provider -> provider deltas override, source provider
  const r3 = await SimulationService.simulate(basePreview("dapp"), { gasFee: gas, client: okClient, provider: richProvider });
  assert(r3.status === "success", "dapp success");
  assert(r3.source === "provider", "dapp provider source");
  assert(!!r3.assetDeltas && r3.assetDeltas[0].symbol === "UNI", "provider deltas mapped");
  assert((r3.warnings ?? []).length === 1, "approval warning surfaced");

  // dapp without provider -> unknown status (preflight ok but no deltas)
  const r4 = await SimulationService.simulate(basePreview("dapp"), { gasFee: gas, client: okClient, provider: nullProvider });
  assert(r4.status === "unknown", "dapp unknown when no provider");
  assert(r4.source === "preflight", "dapp preflight source");

  console.log("OK");
}
run().then(() => {}).catch((e) => { console.error(e); process.exit(1); });
