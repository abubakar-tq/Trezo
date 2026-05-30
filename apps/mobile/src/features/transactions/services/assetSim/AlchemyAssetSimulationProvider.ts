import { numberToHex } from "viem";
import type { AssetSimInput, AssetSimOutput, AssetSimulationProvider } from "./AssetSimulationProvider";

type FetchFn = (input: string, init?: any) => Promise<Response>;

export class AlchemyAssetSimulationProvider implements AssetSimulationProvider {
  constructor(private readonly endpoint: string, private readonly fetchFn: FetchFn = fetch) {}

  async simulate(input: AssetSimInput): Promise<AssetSimOutput | null> {
    if (!this.endpoint) return null;
    try {
      const body = {
        id: 1, jsonrpc: "2.0", method: "alchemy_simulateAssetChanges",
        params: [{
          from: input.account,
          to: input.call.to,
          value: input.call.value > 0n ? numberToHex(input.call.value) : "0x0",
          data: input.call.data,
        }],
      };
      const resp = await this.fetchFn(this.endpoint, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      if (!resp.ok) return null;
      const json: any = await resp.json();
      const changes: any[] = json?.result?.changes;
      if (!Array.isArray(changes)) return null;

      const deltas = changes
        .filter((c) => c.changeType === "TRANSFER" && c.rawAmount && BigInt(c.rawAmount) > 0n)
        .map((c) => ({
          symbol: c.symbol ?? "?",
          contractAddress: c.contractAddress,
          direction: (c.from?.toLowerCase() === input.account.toLowerCase() ? "out" : "in") as "in" | "out",
          rawAmount: BigInt(c.rawAmount),
          amountDisplay: String(c.amount ?? ""),
          decimals: Number(c.decimals ?? 18),
        }));

      const warnings = changes
        .filter((c) => c.changeType === "APPROVE")
        .map((c) => `Grants ${c.symbol ?? "token"} spending approval to ${input.call.to}`);

      return { deltas, warnings };
    } catch {
      return null;
    }
  }
}
