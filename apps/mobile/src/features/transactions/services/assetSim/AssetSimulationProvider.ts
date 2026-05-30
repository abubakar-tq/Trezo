import type { Address, Hex } from "viem";
import type { SupportedChainId } from "@/src/integration/chains";

export type AssetSimInput = {
  account: Address;
  chainId: SupportedChainId;
  call: { to: Address; value: bigint; data: Hex };
};

export type AssetSimDelta = {
  symbol: string;
  contractAddress?: string;
  direction: "in" | "out";
  rawAmount: bigint;
  amountDisplay: string;
  decimals: number;
};

export type AssetSimOutput = { deltas: AssetSimDelta[]; warnings: string[] };

export interface AssetSimulationProvider {
  /** Returns null when simulation is unavailable (no endpoint / error) — caller degrades. */
  simulate(input: AssetSimInput): Promise<AssetSimOutput | null>;
}

export class NullAssetSimulationProvider implements AssetSimulationProvider {
  async simulate(): Promise<AssetSimOutput | null> { return null; }
}
