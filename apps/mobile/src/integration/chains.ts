import Constants from "expo-constants";
import { Platform } from "react-native";
import type { Address } from "viem";

import { getDeployment } from "./viem/deployments";

export type SupportedChainId =
  | 31337
  | 11155111
  | 1
  | 324
  | 300;

export type ChainEnvironment = "local" | "testnet" | "mainnet";

export type NativeCurrency = {
  name: string;
  symbol: string;
  decimals: number;
};

export type ChainConfig = {
  id: SupportedChainId;
  name: string;
  nativeCurrency: NativeCurrency;
  rpcUrl: string;
  bundlerUrl: string;
  paymasterUrl?: string;
  entryPoint: Address | null;
  accountFactory: Address | null;
  blockExplorerUrl?: string;
  environment: ChainEnvironment;
  isEnabled: boolean;
};

const DEFAULT_NATIVE_CURRENCY: NativeCurrency = {
  name: "Ether",
  symbol: "ETH",
  decimals: 18,
};

const DEFAULT_LOCAL_LAPTOP_IP = process.env.EXPO_PUBLIC_LAPTOP_IP || "10.70.81.26";

const isPhysicalDevice = Constants.isDevice ?? true;
const isIOSSimulator = Platform.OS === "ios" && !isPhysicalDevice;
const isAndroidEmulator = Platform.OS === "android" && !isPhysicalDevice;

const resolveLocalHostWithPort = (port: number): string => {
  if (isAndroidEmulator) {
    return `http://10.0.2.2:${port}`;
  }

  if (isIOSSimulator) {
    return `http://localhost:${port}`;
  }

  return `http://${DEFAULT_LOCAL_LAPTOP_IP}:${port}`;
};

const resolveLocalRpcUrl = (): string =>
  process.env.EXPO_PUBLIC_ANVIL_RPC_URL
  ?? process.env.EXPO_PUBLIC_LOCAL_RPC_URL
  ?? resolveLocalHostWithPort(8545);

const resolveLocalBundlerUrl = (): string =>
  process.env.EXPO_PUBLIC_ANVIL_BUNDLER_URL
  ?? resolveLocalHostWithPort(4337);

const resolveLocalPaymasterUrl = (): string =>
  process.env.EXPO_PUBLIC_ANVIL_PAYMASTER_URL
  ?? resolveLocalHostWithPort(3000);

const withDeployment = (chainId: SupportedChainId) => {
  const deployment = getDeployment(chainId);
  return {
    entryPoint: (deployment?.entryPoint as Address | undefined) ?? null,
    accountFactory: (deployment?.accountFactory as Address | undefined) ?? null,
  };
};

const localDeployment = withDeployment(31337);
const sepoliaDeployment = withDeployment(11155111);

export const CHAINS: Record<SupportedChainId, ChainConfig> = {
  31337: {
    id: 31337,
    name: "Anvil",
    nativeCurrency: DEFAULT_NATIVE_CURRENCY,
    rpcUrl: resolveLocalRpcUrl(),
    bundlerUrl: resolveLocalBundlerUrl(),
    paymasterUrl: resolveLocalPaymasterUrl(),
    ...localDeployment,
    environment: "local",
    isEnabled: true,
  },
  11155111: {
    id: 11155111,
    name: "Ethereum Sepolia",
    nativeCurrency: DEFAULT_NATIVE_CURRENCY,
    rpcUrl: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? "",
    bundlerUrl: process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL ?? "",
    paymasterUrl: process.env.EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL,
    ...sepoliaDeployment,
    blockExplorerUrl: "https://sepolia.etherscan.io",
    environment: "testnet",
    isEnabled: Boolean(
      process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL
      && process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL
      && sepoliaDeployment.entryPoint
      && sepoliaDeployment.accountFactory,
    ),
  },
  1: {
    id: 1,
    name: "Ethereum Mainnet",
    nativeCurrency: DEFAULT_NATIVE_CURRENCY,
    rpcUrl: process.env.EXPO_PUBLIC_MAINNET_RPC_URL ?? "",
    bundlerUrl: process.env.EXPO_PUBLIC_MAINNET_BUNDLER_URL ?? "",
    paymasterUrl: process.env.EXPO_PUBLIC_MAINNET_PAYMASTER_URL,
    ...withDeployment(1),
    blockExplorerUrl: "https://etherscan.io",
    environment: "mainnet",
    isEnabled: false,
  },
  324: {
    id: 324,
    name: "zkSync Mainnet",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrl: process.env.EXPO_PUBLIC_ZKSYNC_MAINNET_RPC_URL ?? "",
    bundlerUrl: process.env.EXPO_PUBLIC_ZKSYNC_MAINNET_BUNDLER_URL ?? "",
    paymasterUrl: process.env.EXPO_PUBLIC_ZKSYNC_MAINNET_PAYMASTER_URL,
    ...withDeployment(324),
    blockExplorerUrl: "https://explorer.zksync.io",
    environment: "mainnet",
    isEnabled: false,
  },
  300: {
    id: 300,
    name: "zkSync Sepolia",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrl: process.env.EXPO_PUBLIC_ZKSYNC_SEPOLIA_RPC_URL ?? "",
    bundlerUrl: process.env.EXPO_PUBLIC_ZKSYNC_SEPOLIA_BUNDLER_URL ?? "",
    paymasterUrl: process.env.EXPO_PUBLIC_ZKSYNC_SEPOLIA_PAYMASTER_URL,
    ...withDeployment(300),
    blockExplorerUrl: "https://sepolia.explorer.zksync.io",
    environment: "testnet",
    isEnabled: false,
  },
};

export const DEFAULT_CHAIN_ID: SupportedChainId = 31337;
export const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number) as SupportedChainId[];

export const PORTABLE_CHAIN_IDS = [1, 11155111, 10, 8453, 42161, 137] as const;

export function isPortableChain(chainId: number): boolean {
  return (PORTABLE_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function getChainConfig(chainId: SupportedChainId = DEFAULT_CHAIN_ID): ChainConfig {
  return CHAINS[chainId];
}

export function getEnabledChains(): ChainConfig[] {
  return SUPPORTED_CHAIN_IDS.map((chainId) => CHAINS[chainId]).filter((chain) => chain.isEnabled);
}
