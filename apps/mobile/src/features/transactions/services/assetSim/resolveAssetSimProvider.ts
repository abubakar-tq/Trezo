import { AlchemyAssetSimulationProvider } from "./AlchemyAssetSimulationProvider";
import { NullAssetSimulationProvider, type AssetSimulationProvider } from "./AssetSimulationProvider";
import type { TxPreview } from "../../types/txPreview";

export function resolveAssetSimProvider(network: TxPreview["network"]): AssetSimulationProvider {
  const url = network.chainId === 84532 ? process.env.EXPO_PUBLIC_BASE_SEPOLIA_ALCHEMY_URL : undefined;
  return url ? new AlchemyAssetSimulationProvider(url) : new NullAssetSimulationProvider();
}
