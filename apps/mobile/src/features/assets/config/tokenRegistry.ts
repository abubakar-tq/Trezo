/**
 * tokenRegistry.ts
 *
 * Built-in token definitions keyed by NetworkKey.
 * These are real tokens on canonical networks (not mock/deployed contracts).
 */

import type { NetworkKey } from "@/src/integration/networks";
import type { Erc20TokenMetadata, NativeTokenMetadata } from "@/src/features/assets/types/token";

export type BuiltinTokenEntry = Erc20TokenMetadata & { networkKey: NetworkKey };
export type BuiltinNativeEntry = NativeTokenMetadata & { networkKey: NetworkKey };

// ─── Base Mainnet Fork ────────────────────────────────────────────────────────

export const BUILTIN_TOKENS_BY_NETWORK: Record<NetworkKey, BuiltinTokenEntry[]> = {
  "anvil-local": [],
  "ethereum-sepolia": [],
  "base-mainnet": [
    {
      chainId: 8453,
      networkKey: "base-mainnet",
      type: "erc20",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      tags: ["stablecoin", "base"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
    {
      chainId: 8453,
      networkKey: "base-mainnet",
      type: "erc20",
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      tags: ["wrapped-native", "base"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
  ],
  "base-mainnet-fork": [
    {
      chainId: 8453,
      networkKey: "base-mainnet-fork",
      type: "erc20",
      // Real Base mainnet USDC — forked state
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      tags: ["stablecoin", "base", "fork"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
    {
      chainId: 8453,
      networkKey: "base-mainnet-fork",
      type: "erc20",
      // Real Base WETH — forked state
      address: "0x4200000000000000000000000000000000000006",
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      tags: ["wrapped-native", "base", "fork"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
  ],
} as const;
