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
  "ethereum-sepolia": [
    {
      chainId: 11155111,
      networkKey: "ethereum-sepolia",
      type: "erc20",
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle faucet USDC
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      tags: ["stablecoin", "sepolia"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
    {
      chainId: 11155111,
      networkKey: "ethereum-sepolia",
      type: "erc20",
      address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", // canonical V3 WETH on Sepolia
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      tags: ["wrapped-native", "sepolia"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
  ],
  "base-sepolia": [
    {
      chainId: 84532,
      networkKey: "base-sepolia",
      type: "erc20",
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Circle Base Sepolia USDC
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      tags: ["stablecoin", "base-sepolia"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
    {
      chainId: 84532,
      networkKey: "base-sepolia",
      type: "erc20",
      address: "0x4200000000000000000000000000000000000006", // canonical Base WETH
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      tags: ["wrapped-native", "base-sepolia"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
    {
      chainId: 84532,
      networkKey: "base-sepolia",
      type: "erc20",
      address: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", // Chainlink LINK Base Sepolia
      symbol: "LINK",
      name: "ChainLink Token",
      decimals: 18,
      tags: ["oracle", "base-sepolia"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
  ],
  "arbitrum-sepolia": [
    {
      chainId: 421614,
      networkKey: "arbitrum-sepolia",
      type: "erc20",
      address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Circle Arb Sepolia USDC
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      tags: ["stablecoin", "arb-sepolia"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
    {
      chainId: 421614,
      networkKey: "arbitrum-sepolia",
      type: "erc20",
      address: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // canonical Arb Sepolia WETH
      symbol: "WETH",
      name: "Wrapped Ether",
      decimals: 18,
      tags: ["wrapped-native", "arb-sepolia"],
      isSwapSupported: true,
      isVerified: true,
      source: "builtin",
    },
  ],
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
