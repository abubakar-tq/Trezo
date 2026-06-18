/**
 * bridgeRegistry.ts
 *
 * Per-network Across V3 SpokePool + Trezo CrossChainExecutor addresses, plus
 * the route allowlist for cross-chain swap. SpokePool addresses are pinned
 * from across-protocol/contracts deployments and must be re-verified after
 * any Across protocol upgrade. The CrossChainExecutor address is hydrated
 * from the chain's deployment manifest at call time so it always tracks the
 * on-chain truth published by `make sync-mobile`.
 *
 * Equivalent cross-chain token pairs are encoded per-route so the
 * Across SpokePool's depositV3 `outputToken` matches the canonical token on
 * the destination chain (e.g. Sepolia USDC -> Base Sepolia USDC).
 */

import type { NetworkKey } from "@/src/integration/networks";
import type { Address } from "viem";
import { isLifiNetwork } from "../lifi/constants";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BridgeId = "across_v3";

/** Token-pair mapping between source and destination for a single bridge route. */
export type BridgeTokenPair = {
  inputToken: Address;
  outputToken: Address;
};

export type BridgeRouteConfig = {
  destinationNetworkKey: NetworkKey;
  /** Allowed (sourceToken, destToken) pairs for this route. */
  pairs: BridgeTokenPair[];
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

/**
 * Flat relayer + LP fee charged per route, in basis points.
 *
 * Per ADR 0008, Trezo runs the only filler that watches testnets, so we set
 * the fee tight enough to cover relayer gas and LP yield on testnets. 30 bps
 * is a healthy buffer; the relayer earns the spread on settlement.
 */
export const BRIDGE_FLAT_FEE_BPS = 30;

/** How long after deposit the relayer has to fill. After this, the deposit refunds. */
export const BRIDGE_FILL_DEADLINE_SECONDS = 60 * 60; // 1h

/** Quote validity window on the source chain. */
export const BRIDGE_QUOTE_VALIDITY_SECONDS = 60;

// ─── Token addresses (mirror dexRegistry.ts and tokenRegistry.ts) ──────────────

const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
// Same address as dexRegistry.ts SEPOLIA_WETH (SwapRouter02.WETH9) so canonical bridge
// output token matches tokenRegistry and no cross-chain swap leg is required for WETH→WETH.
const SEPOLIA_WETH = "0xfff9976782d46cc05630d1f6ebab18b2324d6b14" as Address;
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
const BASE_SEPOLIA_WETH = "0x4200000000000000000000000000000000000006" as Address;
const ARB_SEPOLIA_USDC = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address;
const ARB_SEPOLIA_WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" as Address;

// ─── Across V3 SpokePool addresses ────────────────────────────────────────────
// Pinned from https://github.com/across-protocol/contracts/tree/master/deployments
// (Across V3, testnet). Re-verify after any Across protocol upgrade.

const SPOKE_POOL_SEPOLIA = "0x5ef6C01E11889d86803e0B23e3cB3F9E9d97B662" as Address;
const SPOKE_POOL_BASE_SEPOLIA = "0x82B564983aE7274c86695917BBf8C99ECb6F0F8F" as Address;
const SPOKE_POOL_ARB_SEPOLIA = "0x7E63A5f1a8F0B4d0934B2f2327DAED3F6bb2ee75" as Address;

// ─── Registry ─────────────────────────────────────────────────────────────────

const pairsBetween = (
  source: { usdc: Address; weth: Address },
  dest: { usdc: Address; weth: Address },
): BridgeTokenPair[] => [
  { inputToken: source.usdc, outputToken: dest.usdc },
  { inputToken: source.weth, outputToken: dest.weth },
];

const SEPOLIA_TOKENS = { usdc: SEPOLIA_USDC, weth: SEPOLIA_WETH };
const BASE_SEPOLIA_TOKENS = { usdc: BASE_SEPOLIA_USDC, weth: BASE_SEPOLIA_WETH };
const ARB_SEPOLIA_TOKENS = { usdc: ARB_SEPOLIA_USDC, weth: ARB_SEPOLIA_WETH };

const BRIDGE_CONFIGS: Partial<Record<NetworkKey, BridgeConfig>> = {
  "ethereum-sepolia": {
    networkKey: "ethereum-sepolia",
    bridgeId: "across_v3",
    spokePool: SPOKE_POOL_SEPOLIA,
    routes: [
      { destinationNetworkKey: "base-sepolia", pairs: pairsBetween(SEPOLIA_TOKENS, BASE_SEPOLIA_TOKENS) },
      { destinationNetworkKey: "arbitrum-sepolia", pairs: pairsBetween(SEPOLIA_TOKENS, ARB_SEPOLIA_TOKENS) },
    ],
  },
  "base-sepolia": {
    networkKey: "base-sepolia",
    bridgeId: "across_v3",
    spokePool: SPOKE_POOL_BASE_SEPOLIA,
    routes: [
      { destinationNetworkKey: "ethereum-sepolia", pairs: pairsBetween(BASE_SEPOLIA_TOKENS, SEPOLIA_TOKENS) },
      { destinationNetworkKey: "arbitrum-sepolia", pairs: pairsBetween(BASE_SEPOLIA_TOKENS, ARB_SEPOLIA_TOKENS) },
    ],
  },
  "arbitrum-sepolia": {
    networkKey: "arbitrum-sepolia",
    bridgeId: "across_v3",
    spokePool: SPOKE_POOL_ARB_SEPOLIA,
    routes: [
      { destinationNetworkKey: "ethereum-sepolia", pairs: pairsBetween(ARB_SEPOLIA_TOKENS, SEPOLIA_TOKENS) },
      { destinationNetworkKey: "base-sepolia", pairs: pairsBetween(ARB_SEPOLIA_TOKENS, BASE_SEPOLIA_TOKENS) },
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

/**
 * True when same-asset bridge is wired from this source chain — only requires
 * an Across V3 SpokePool. Bridged funds are delivered directly to the user's
 * smart account on the destination chain (no executor hop).
 */
export const isCrossChainBridgeReady = (networkKey: NetworkKey): boolean => {
  if (isLifiNetwork(networkKey)) return true;
  const config = getBridgeConfig(networkKey);
  return Boolean(config?.spokePool);
};

/**
 * True when cross-chain SWAP is wired into the destination chain — requires
 * a deployed CrossChainExecutor on `destinationNetworkKey` so the bridged
 * token can be swapped to a different output token on arrival.
 * LI.FI networks are always ready (route fetched live from the API).
 */
export const isCrossChainSwapReady = (destinationNetworkKey: NetworkKey): boolean => {
  if (isLifiNetwork(destinationNetworkKey)) return true;
  const config = getBridgeConfig(destinationNetworkKey);
  return Boolean(config?.spokePool && config?.crossChainExecutor);
};

/** Returns the allowlisted destination networks for a given testnet source. For mainnet, use useBridgeDestChains hook. */
export const getCrossChainDestinations = (networkKey: NetworkKey): NetworkKey[] =>
  BRIDGE_CONFIGS[networkKey]?.routes.map((r) => r.destinationNetworkKey) ?? [];

/** Find a configured route from `source` to `destination`, or undefined. */
export const findBridgeRoute = (
  source: NetworkKey,
  destination: NetworkKey,
): BridgeRouteConfig | undefined =>
  BRIDGE_CONFIGS[source]?.routes.find((r) => r.destinationNetworkKey === destination);

/**
 * Find the destination-chain output token for a given source-chain input token
 * on the source -> destination route. Returns undefined if the pair is not allowlisted.
 */
export const findBridgeOutputToken = (
  source: NetworkKey,
  destination: NetworkKey,
  inputToken: Address,
): Address | undefined => {
  const route = findBridgeRoute(source, destination);
  if (!route) return undefined;
  const inputLc = inputToken.toLowerCase();
  return route.pairs.find((p) => p.inputToken.toLowerCase() === inputLc)?.outputToken;
};

/** True when `spender` is the SpokePool for `networkKey` — used by the allowance trust check. */
export const isTrustedBridgeSpender = (networkKey: NetworkKey, spender: Address): boolean => {
  const config = BRIDGE_CONFIGS[networkKey];
  if (!config) return false;
  return config.spokePool.toLowerCase() === spender.toLowerCase();
};
