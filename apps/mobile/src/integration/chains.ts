import Constants from "expo-constants";
import { Platform } from "react-native";
import type { Address } from "viem";

import { getDeployment } from "./viem/deployments";

export type SupportedChainId =
  | 31337
  | 11155111
  | 84532
  | 421614
  | 42161
  | 1
  | 324
  | 300
  | 8453;

/** @deprecated Use ChainEnvironmentExtended from networks.ts which includes 'local_fork'. */
export type ChainEnvironment = "local" | "local_fork" | "testnet" | "mainnet";
// Re-export extended type for callers that import from chains.ts
export type { ChainEnvironmentExtended } from "./networks";

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

const parseSupportedChainId = (value?: string): SupportedChainId | undefined => {
  const parsed = Number(value);
  if ([31337, 11155111, 84532, 421614, 42161, 1, 324, 300, 8453].includes(parsed)) {
    return parsed as SupportedChainId;
  }
  return undefined;
};

const resolveDefaultChainId = (): SupportedChainId =>
  parseSupportedChainId(process.env.EXPO_PUBLIC_DEFAULT_CHAIN_ID)
  ?? (process.env.EXPO_PUBLIC_DEFAULT_NETWORK_KEY === "base-mainnet-fork" ? 8453 : 31337);

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
const baseSepoliaDeployment = withDeployment(84532);
const arbSepoliaDeployment = withDeployment(421614);
const baseMainnetDeployment = withDeployment(8453 as never);

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
  84532: {
    id: 84532,
    name: "Base Sepolia",
    nativeCurrency: DEFAULT_NATIVE_CURRENCY,
    rpcUrl: process.env.EXPO_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    bundlerUrl: process.env.EXPO_PUBLIC_BASE_SEPOLIA_BUNDLER_URL ?? "",
    paymasterUrl: process.env.EXPO_PUBLIC_BASE_SEPOLIA_PAYMASTER_URL,
    ...baseSepoliaDeployment,
    blockExplorerUrl: "https://sepolia.basescan.org",
    environment: "testnet",
    isEnabled: Boolean(
      process.env.EXPO_PUBLIC_BASE_SEPOLIA_BUNDLER_URL
      && baseSepoliaDeployment.entryPoint
      && baseSepoliaDeployment.accountFactory,
    ),
  },
  421614: {
    id: 421614,
    name: "Arbitrum Sepolia",
    nativeCurrency: DEFAULT_NATIVE_CURRENCY,
    rpcUrl: process.env.EXPO_PUBLIC_ARB_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc",
    bundlerUrl: process.env.EXPO_PUBLIC_ARB_SEPOLIA_BUNDLER_URL ?? "",
    paymasterUrl: process.env.EXPO_PUBLIC_ARB_SEPOLIA_PAYMASTER_URL,
    ...arbSepoliaDeployment,
    blockExplorerUrl: "https://sepolia.arbiscan.io",
    environment: "testnet",
    isEnabled: Boolean(
      process.env.EXPO_PUBLIC_ARB_SEPOLIA_BUNDLER_URL
      && arbSepoliaDeployment.entryPoint
      && arbSepoliaDeployment.accountFactory,
    ),
  },
  42161: {
    id: 42161,
    name: "Arbitrum One",
    nativeCurrency: DEFAULT_NATIVE_CURRENCY,
    rpcUrl: process.env.EXPO_PUBLIC_ARB_MAINNET_RPC_URL ?? "https://arb1.arbitrum.io/rpc",
    bundlerUrl: process.env.EXPO_PUBLIC_ARB_MAINNET_BUNDLER_URL ?? "",
    paymasterUrl: undefined,
    ...withDeployment(42161 as never),
    blockExplorerUrl: "https://arbiscan.io",
    environment: "mainnet" as ChainEnvironment,
    isEnabled: false,
  },
  8453: {
    id: 8453,
    name: "Base",
    nativeCurrency: DEFAULT_NATIVE_CURRENCY,
    rpcUrl: process.env.EXPO_PUBLIC_BASE_MAINNET_RPC_URL ?? "https://mainnet.base.org",
    bundlerUrl: process.env.EXPO_PUBLIC_BASE_MAINNET_BUNDLER_URL ?? "",
    paymasterUrl: process.env.EXPO_PUBLIC_BASE_MAINNET_PAYMASTER_URL,
    ...baseMainnetDeployment,
    blockExplorerUrl: "https://basescan.org",
    environment: "mainnet" as ChainEnvironment,
    isEnabled: Boolean(
      process.env.EXPO_PUBLIC_BASE_MAINNET_BUNDLER_URL &&
      baseMainnetDeployment.entryPoint &&
      baseMainnetDeployment.accountFactory,
    ),
  },
};

export const DEFAULT_CHAIN_ID: SupportedChainId = resolveDefaultChainId();
export const SUPPORTED_CHAIN_IDS = Object.keys(CHAINS).map(Number) as SupportedChainId[];

// Chains that use the PORTABLE wallet salt → the same wallet resolves to the SAME
// address on every chain (no block.chainid in the salt; see AccountFactory.portableWalletSalt
// and contracts/DEPLOYMENTS.md, ADR-0006). Portability holds for any EVM chain where the
// deterministic factory + validator sit at the canonical addresses — i.e. every supported
// chain EXCEPT zkSync (Era/Sepolia), whose CREATE2 derivation differs.
// 84532 (Base Sepolia) is our demo testnet and MUST be portable so a wallet there shares
// its address with the same wallet on Ethereum Sepolia / Base mainnet. Omitting it forces
// the chain-specific salt and breaks the portable-address story on the one chain we demo.
export const PORTABLE_CHAIN_IDS = [1, 11155111, 10, 8453, 84532, 42161, 137] as const;

export function isPortableChain(chainId: number): boolean {
  return (PORTABLE_CHAIN_IDS as readonly number[]).includes(chainId);
}

export function getChainConfig(chainId: SupportedChainId = DEFAULT_CHAIN_ID): ChainConfig {
  return CHAINS[chainId];
}

export function getEnabledChains(): ChainConfig[] {
  return SUPPORTED_CHAIN_IDS.map((chainId) => CHAINS[chainId]).filter((chain) => chain.isEnabled);
}
