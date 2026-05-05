/**
 * dexRegistry.ts
 *
 * DEX configuration registry keyed by NetworkKey.
 * Each entry defines which DEX contracts to use and which pools are supported.
 *
 * Philosophy:
 *   - Only explicitly listed pools/pairs can be used.
 *   - Only explicitly listed spenders can receive token approvals.
 *   - No arbitrary addresses are trusted.
 */

import type { NetworkKey } from "@/src/integration/networks";
import type { Address } from "viem";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DexId = "uniswap_v3";

/** Uniswap V3 fee tier in bps (500 = 0.05%, 3000 = 0.3%, 10000 = 1%). */
export type UniswapV3FeeTier = 500 | 3000 | 10000;

export type DexPoolConfig = {
  sellToken: Address;
  buyToken: Address;
  feeTier: UniswapV3FeeTier;
  /** Known pool address — optional; provider will call factory.getPool() if absent. */
  poolAddress?: Address;
  enabled: boolean;
};

export type DexConfig = {
  networkKey: NetworkKey;
  dexId: DexId;
  label: string;
  factoryAddress: Address;
  quoterAddress: Address;
  routerAddress: Address;
  /** Wrapped native token address (e.g. WETH). Used to route native ETH → ERC20 swaps via the router. */
  wrappedNativeAddress: Address;
  /** Addresses that are allowed to receive ERC20 approvals. */
  trustedSpenders: Address[];
  supportedPools: DexPoolConfig[];
};

// ─── Base Mainnet Addresses ───────────────────────────────────────────────────
// Source: https://developers.uniswap.org/docs/protocols/v3/deployments/v3-base-deployments

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const BASE_WETH = "0x4200000000000000000000000000000000000006" as Address;

const UNISWAP_V3_FACTORY_BASE = "0x33128a8fC17869897dcE68Ed026d694621f6FDfD" as Address;
const UNISWAP_QUOTER_V2_BASE = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a" as Address;
const UNISWAP_SWAP_ROUTER02_BASE = "0x2626664c2603336E57B271c5C0b26F421741e481" as Address;
// Uniswap V2 on Base — verify: cast code 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24 --rpc-url $FORK_RPC_URL
const UNISWAP_V2_ROUTER_BASE = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24" as Address;

// ─── Registry ─────────────────────────────────────────────────────────────────

const DEX_CONFIGS: Partial<Record<NetworkKey, DexConfig>> = {
  "base-mainnet-fork": {
    networkKey: "base-mainnet-fork",
    dexId: "uniswap_v3",
    label: "Uniswap V3 on Base Fork",
    factoryAddress: UNISWAP_V3_FACTORY_BASE,
    quoterAddress: UNISWAP_QUOTER_V2_BASE,
    routerAddress: UNISWAP_SWAP_ROUTER02_BASE,
    wrappedNativeAddress: BASE_WETH,
    trustedSpenders: [UNISWAP_SWAP_ROUTER02_BASE, UNISWAP_V2_ROUTER_BASE],
    supportedPools: [
      {
        sellToken: BASE_USDC,
        buyToken: BASE_WETH,
        feeTier: 500,
        // Hardcoded to skip the factory.getPool() round-trip to the remote RPC
        poolAddress: "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59" as Address,
        enabled: true,
      },
      {
        sellToken: BASE_WETH,
        buyToken: BASE_USDC,
        feeTier: 500,
        poolAddress: "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59" as Address,
        enabled: true,
      },
    ],
  },
  "base-mainnet": {
    networkKey: "base-mainnet",
    dexId: "uniswap_v3",
    label: "Uniswap V3 on Base",
    factoryAddress: UNISWAP_V3_FACTORY_BASE,
    quoterAddress: UNISWAP_QUOTER_V2_BASE,
    routerAddress: UNISWAP_SWAP_ROUTER02_BASE,
    wrappedNativeAddress: BASE_WETH,
    trustedSpenders: [UNISWAP_SWAP_ROUTER02_BASE, UNISWAP_V2_ROUTER_BASE],
    supportedPools: [
      {
        sellToken: BASE_USDC,
        buyToken: BASE_WETH,
        feeTier: 500,
        poolAddress: "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59" as Address,
        enabled: true,
      },
      {
        sellToken: BASE_WETH,
        buyToken: BASE_USDC,
        feeTier: 500,
        poolAddress: "0xb2cc224c1c9feE385f8ad6a55b4d94E92359DC59" as Address,
        enabled: true,
      },
    ],
  },
};

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Returns the DexConfig for the given networkKey, or undefined if not configured. */
export const getDexConfig = (networkKey: NetworkKey): DexConfig | undefined =>
  DEX_CONFIGS[networkKey];

/** Returns all trusted spenders for the given networkKey across all DEX configs. */
export const getTrustedSpendersForNetwork = (networkKey: NetworkKey): Address[] => {
  const config = DEX_CONFIGS[networkKey];
  return config?.trustedSpenders ?? [];
};

/** Returns true if the given spender is trusted for the given networkKey. */
export const isTrustedSpenderForNetwork = (networkKey: NetworkKey, spender: Address): boolean => {
  const trusted = getTrustedSpendersForNetwork(networkKey).map((a) => a.toLowerCase());
  return trusted.includes(spender.toLowerCase());
};

/**
 * Returns the DexPoolConfig for the given pair, or undefined if not found.
 * Address comparison is case-insensitive.
 */
export const getPoolConfig = (
  networkKey: NetworkKey,
  sellToken: Address,
  buyToken: Address
): DexPoolConfig | undefined => {
  const config = DEX_CONFIGS[networkKey];
  if (!config) return undefined;

  return config.supportedPools.find(
    (pool) =>
      pool.enabled &&
      pool.sellToken.toLowerCase() === sellToken.toLowerCase() &&
      pool.buyToken.toLowerCase() === buyToken.toLowerCase()
  );
};
