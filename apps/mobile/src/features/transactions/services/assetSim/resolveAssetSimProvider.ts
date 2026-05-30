import type { TxPreview } from "../../types/txPreview";
import type { AssetSimulationProvider } from "./AssetSimulationProvider";

// Stub — returns null for now; Task 14 will wire the Alchemy Base Sepolia endpoint.
export function resolveAssetSimProvider(_network: TxPreview["network"]): AssetSimulationProvider | null {
  return null;
}
