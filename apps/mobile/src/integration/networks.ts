/**
 * networks.ts
 *
 * Canonical network identity for the Trezo mobile app.
 *
 * Split of concepts:
 *   chainId          - EIP-155 identity used in UserOp hash and RPC.
 *   sourceChainId    - Real chain being forked (e.g., 8453 for Base fork).
 *   networkKey       - App/storage identity. Distinguishes base-mainnet from base-mainnet-fork.
 *   deploymentProfile - Trezo local contract manifest identity.
 */

import Constants from "expo-constants";
import { Platform } from "react-native";

import { getDeployment } from "./viem/deployments";

// ─── Types ───────────────────────────────────────────────────────────────────

export type NetworkKey =
  | "anvil-local"
  | "ethereum-sepolia"
  | "base-mainnet"
  | "base-mainnet-fork";

export type DeploymentProfile = "31337" | "base-mainnet-fork";

export type ChainEnvironmentExtended =
  | "local"
  | "local_fork"
  | "testnet"
  | "mainnet";

export type NativeCurrency = {
  name: string;
  symbol: string;
  decimals: number;
};

export type SupportedChainId =
  | 31337
  | 11155111
  | 1
  | 324
  | 300
  | 8453;

export type NetworkConfig = {
  networkKey: NetworkKey;
  chainId: SupportedChainId;
  /** Real chain being forked; equals chainId for non-fork networks. */
  sourceChainId: number;
  deploymentProfile: DeploymentProfile;
  name: string;
  displayName: string;
  nativeCurrency: NativeCurrency;
  rpcUrl: string;
  bundlerUrl: string;
  paymasterUrl?: string;
  environment: ChainEnvironmentExtended;
  blockExplorerUrl?: string;
  isEnabled: boolean;
  isDevelopmentOnly?: boolean;
  /** Whether the network should use a paymaster by default. */
  defaultUsePaymaster: boolean;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

const DEFAULT_LAPTOP_IP =
  process.env.EXPO_PUBLIC_LAPTOP_IP ?? "10.70.81.26";
const INFRA_IP =
  process.env.EXPO_PUBLIC_INFRA_IP ?? "192.168.100.68";

const isPhysicalDevice = Constants.isDevice ?? true;
const isIOSSimulator = Platform.OS === "ios" && !isPhysicalDevice;
const isAndroidEmulator = Platform.OS === "android" && !isPhysicalDevice;

const resolveLocalHostWithPort = (port: number): string => {
  if (isAndroidEmulator) return `http://10.0.2.2:${port}`;
  if (isIOSSimulator) return `http://localhost:${port}`;
  return `http://${DEFAULT_LAPTOP_IP}:${port}`;
};

const DEFAULT_NATIVE_ETH: NativeCurrency = {
  name: "Ether",
  symbol: "ETH",
  decimals: 18,
};

// ─── Network registry ─────────────────────────────────────────────────────────

export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  "anvil-local": {
    networkKey: "anvil-local",
    chainId: 31337,
    sourceChainId: 31337,
    deploymentProfile: "31337",
    name: "Anvil",
    displayName: "Anvil (Local)",
    nativeCurrency: DEFAULT_NATIVE_ETH,
    rpcUrl:
      process.env.EXPO_PUBLIC_ANVIL_RPC_URL ??
      process.env.EXPO_PUBLIC_LOCAL_RPC_URL ??
      resolveLocalHostWithPort(8545),
    bundlerUrl:
      process.env.EXPO_PUBLIC_ANVIL_BUNDLER_URL ??
      resolveLocalHostWithPort(4337),
    paymasterUrl:
      process.env.EXPO_PUBLIC_ANVIL_PAYMASTER_URL ??
      resolveLocalHostWithPort(3000),
    environment: "local",
    isEnabled: true,
    isDevelopmentOnly: true,
    defaultUsePaymaster: true,
  },

  "ethereum-sepolia": {
    networkKey: "ethereum-sepolia",
    chainId: 11155111,
    sourceChainId: 11155111,
    deploymentProfile: "31337", // Sepolia uses same profile until it has its own manifest
    name: "Ethereum Sepolia",
    displayName: "Sepolia",
    nativeCurrency: DEFAULT_NATIVE_ETH,
    rpcUrl: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? "",
    bundlerUrl: process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL ?? "",
    paymasterUrl: process.env.EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL,
    environment: "testnet",
    blockExplorerUrl: "https://sepolia.etherscan.io",
    isEnabled: Boolean(
      process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL &&
        process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL
    ),
    defaultUsePaymaster: Boolean(
      process.env.EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL
    ),
  },

  "base-mainnet": {
    networkKey: "base-mainnet",
    chainId: 8453,
    sourceChainId: 8453,
    deploymentProfile: "base-mainnet-fork", // Placeholder – real mainnet not yet deployed
    name: "Base Mainnet",
    displayName: "Base",
    nativeCurrency: DEFAULT_NATIVE_ETH,
    rpcUrl: process.env.EXPO_PUBLIC_BASE_MAINNET_RPC_URL ?? "",
    bundlerUrl: process.env.EXPO_PUBLIC_BASE_MAINNET_BUNDLER_URL ?? "",
    paymasterUrl: process.env.EXPO_PUBLIC_BASE_MAINNET_PAYMASTER_URL,
    environment: "mainnet",
    blockExplorerUrl: "https://basescan.org",
    isEnabled: false, // Not yet enabled for production
    defaultUsePaymaster: false,
  },

  "base-mainnet-fork": (() => {
    const deployment = getDeployment("base-mainnet-fork");
    return {
      networkKey: "base-mainnet-fork" as NetworkKey,
      chainId: 8453 as SupportedChainId,
      sourceChainId: 8453,
      deploymentProfile: "base-mainnet-fork" as DeploymentProfile,
      name: "Base Mainnet Fork",
      displayName: "Base Fork",
      nativeCurrency: DEFAULT_NATIVE_ETH,
      rpcUrl:
        process.env.EXPO_PUBLIC_BASE_FORK_RPC_URL ??
        `http://${INFRA_IP}:8545`,
      bundlerUrl:
        process.env.EXPO_PUBLIC_BASE_FORK_BUNDLER_URL ??
        `http://${INFRA_IP}:4337`,
      paymasterUrl: process.env.EXPO_PUBLIC_BASE_FORK_PAYMASTER_URL,
      environment: "local_fork" as ChainEnvironmentExtended,
      blockExplorerUrl: "https://basescan.org",
      isEnabled: Boolean(
        deployment?.entryPoint && deployment?.accountFactory
      ),
      isDevelopmentOnly: true,
      defaultUsePaymaster: Boolean(
        process.env.EXPO_PUBLIC_BASE_FORK_PAYMASTER_URL
      ),
    };
  })(),
};

// ─── Constants ────────────────────────────────────────────────────────────────

const parseDefaultNetworkKey = (value?: string): NetworkKey | undefined =>
  value && value in NETWORKS ? (value as NetworkKey) : undefined;

export const DEFAULT_NETWORK_KEY: NetworkKey =
  parseDefaultNetworkKey(process.env.EXPO_PUBLIC_DEFAULT_NETWORK_KEY) ?? "anvil-local";

export const ALL_NETWORK_KEYS = Object.keys(NETWORKS) as NetworkKey[];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Returns the NetworkConfig for the given networkKey. Throws if not found. */
export const getNetworkConfig = (networkKey: NetworkKey): NetworkConfig => {
  const config = NETWORKS[networkKey];
  if (!config) {
    throw new Error(`Unknown networkKey: ${networkKey}`);
  }
  return config;
};

/** Returns all enabled networks. */
export const getEnabledNetworks = (): NetworkConfig[] =>
  ALL_NETWORK_KEYS.map((k) => NETWORKS[k]).filter((n) => n.isEnabled);

/**
 * Returns the RPC URL for a network.
 * Throws if the network is disabled or has no URL.
 */
export const getRpcUrlForNetwork = (networkKey: NetworkKey): string => {
  const config = getNetworkConfig(networkKey);
  if (!config.isEnabled) {
    throw new Error(
      `Network ${config.displayName} (${networkKey}) is disabled.`
    );
  }
  if (!config.rpcUrl) {
    throw new Error(
      `RPC URL missing for network ${networkKey}. Set the relevant EXPO_PUBLIC_* env var.`
    );
  }
  return config.rpcUrl;
};

/**
 * Returns the bundler URL for a network.
 * Throws if the network is disabled or has no URL.
 */
export const getBundlerUrlForNetwork = (networkKey: NetworkKey): string => {
  const config = getNetworkConfig(networkKey);
  if (!config.isEnabled) {
    throw new Error(
      `Network ${config.displayName} (${networkKey}) is disabled.`
    );
  }
  if (!config.bundlerUrl) {
    throw new Error(
      `Bundler URL missing for network ${networkKey}. Set the relevant EXPO_PUBLIC_* env var.`
    );
  }
  return config.bundlerUrl;
};

/**
 * Returns the default NetworkConfig for a given chainId.
 * For chainId 8453, returns base-mainnet-fork when enabled, otherwise base-mainnet.
 */
export const getDefaultNetworkForChain = (
  chainId: SupportedChainId
): NetworkConfig | undefined => {
  const enabled = getEnabledNetworks().filter((n) => n.chainId === chainId);
  if (enabled.length === 0) return undefined;
  // Prefer fork over mainnet for dev
  const fork = enabled.find((n) => n.environment === "local_fork");
  return fork ?? enabled[0];
};

/**
 * Resolves a NetworkConfig from either a NetworkKey or a legacy SupportedChainId.
 * Falls back to DEFAULT_NETWORK_KEY.
 */
export const resolveNetworkKey = (
  input?: NetworkKey | SupportedChainId
): NetworkKey => {
  if (!input) return DEFAULT_NETWORK_KEY;

  // If it's a number, treat as chainId
  if (typeof input === "number") {
    const config = getDefaultNetworkForChain(input as SupportedChainId);
    return config?.networkKey ?? DEFAULT_NETWORK_KEY;
  }

  // Validate it's a known key
  if (NETWORKS[input as NetworkKey]) {
    return input as NetworkKey;
  }

  return DEFAULT_NETWORK_KEY;
};
