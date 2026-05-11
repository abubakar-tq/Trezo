/**
 * bridgeRegistry.ts
 *
 * Per-network Across V3 SpokePool + Trezo CrossChainExecutor addresses, plus
 * the route allowlist for cross-chain swap. Source addresses come from the
 * across-protocol/contracts deployments repo and must be re-verified after any
 * Across protocol upgrade. The CrossChainExecutor address is hydrated from the
 * chain's deployment manifest at call time so it always tracks the on-chain
 * truth published by `make sync-mobile`.
 */

import type { NetworkKey } from "@/src/integration/networks";
import type { Address } from "viem";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BridgeId = "across_v3";

export type BridgeRouteConfig = {
  destinationNetworkKey: NetworkKey;
  /** Tokens accepted as the bridge `inputToken` on the source side. */
  supportedInputTokens: Address[];
};

export type BridgeConfig = {
  networkKey: NetworkKey;
  bridgeId: BridgeId;
  /** Across V3 SpokePool on this chain. */
  spokePool: Address;
  /** Trezo CrossChainExecutor on this chain — pulled from the deployment manifest. */
  crossChainExecutor?: Address;
  /** Outbound routes from this chain currently allowlisted. */
  routes: BridgeRouteConfig[];
};

// ─── Token addresses (mirror dexRegistry.ts and tokenRegistry.ts) ──────────────

const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
const SEPOLIA_WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9" as Address;
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
const BASE_SEPOLIA_WETH = "0x4200000000000000000000000000000000000006" as Address;
const ARB_SEPOLIA_USDC = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address;
const ARB_SEPOLIA_WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" as Address;

// ─── Across V3 SpokePool addresses (PLACEHOLDERS — pin from across-protocol/contracts) ──

const SPOKE_POOL_SEPOLIA = "0x5ef6C01E11889d86803e0B23e3cB3F9E9d97B662" as Address;
const SPOKE_POOL_BASE_SEPOLIA = "0x82B564983aE7274c86695917BBf8C99ECb6F0F8F" as Address;
const SPOKE_POOL_ARB_SEPOLIA = "0x7E63A5f1a8F0B4d0934B2f2327DAED3F6bb2ee75" as Address;

// ─── Registry ─────────────────────────────────────────────────────────────────

const tokensFor = (usdc: Address, weth: Address): Address[] => [usdc, weth];

const BRIDGE_CONFIGS: Partial<Record<NetworkKey, BridgeConfig>> = {
  "ethereum-sepolia": {
    networkKey: "ethereum-sepolia",
    bridgeId: "across_v3",
    spokePool: SPOKE_POOL_SEPOLIA,
    routes: [
      { destinationNetworkKey: "base-sepolia", supportedInputTokens: tokensFor(SEPOLIA_USDC, SEPOLIA_WETH) },
      { destinationNetworkKey: "arbitrum-sepolia", supportedInputTokens: tokensFor(SEPOLIA_USDC, SEPOLIA_WETH) },
    ],
  },
  "base-sepolia": {
    networkKey: "base-sepolia",
    bridgeId: "across_v3",
    spokePool: SPOKE_POOL_BASE_SEPOLIA,
    routes: [
      { destinationNetworkKey: "ethereum-sepolia", supportedInputTokens: tokensFor(BASE_SEPOLIA_USDC, BASE_SEPOLIA_WETH) },
      { destinationNetworkKey: "arbitrum-sepolia", supportedInputTokens: tokensFor(BASE_SEPOLIA_USDC, BASE_SEPOLIA_WETH) },
    ],
  },
  "arbitrum-sepolia": {
    networkKey: "arbitrum-sepolia",
    bridgeId: "across_v3",
    spokePool: SPOKE_POOL_ARB_SEPOLIA,
    routes: [
      { destinationNetworkKey: "ethereum-sepolia", supportedInputTokens: tokensFor(ARB_SEPOLIA_USDC, ARB_SEPOLIA_WETH) },
      { destinationNetworkKey: "base-sepolia", supportedInputTokens: tokensFor(ARB_SEPOLIA_USDC, ARB_SEPOLIA_WETH) },
    ],
  },
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Returns the bridge config for a source network, hydrated with the
 * CrossChainExecutor address pulled from the chain's deployment manifest.
 * Returns undefined if the chain has no Across SpokePool config or no executor
 * deployed yet.
 */
export const getBridgeConfig = (networkKey: NetworkKey): BridgeConfig | undefined => {
  const base = BRIDGE_CONFIGS[networkKey];
  if (!base) return undefined;

  // Lazy require to avoid a module-load cycle with viem/deployments.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getDeploymentForNetwork } = require("@/src/integration/viem/deployments");
  const deployment = getDeploymentForNetwork(networkKey);

  return { ...base, crossChainExecutor: deployment?.crossChainExecutor };
};

/** True when the source chain has both an Across SpokePool config and a deployed CrossChainExecutor. */
export const isCrossChainBridgeReady = (networkKey: NetworkKey): boolean => {
  const config = getBridgeConfig(networkKey);
  return Boolean(config?.spokePool && config?.crossChainExecutor);
};

/** Returns the allowlisted destination networks for a given source. */
export const getCrossChainDestinations = (networkKey: NetworkKey): NetworkKey[] =>
  BRIDGE_CONFIGS[networkKey]?.routes.map((r) => r.destinationNetworkKey) ?? [];
