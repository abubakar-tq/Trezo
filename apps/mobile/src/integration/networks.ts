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
  | "base-sepolia"
  | "arbitrum-sepolia"
  | "base-mainnet"
  | "arb-mainnet"
  | "base-mainnet-fork";

export type DeploymentProfile =
  | "31337"
  | "base-mainnet"
  | "arb-mainnet"
  | "base-mainnet-fork"
  | "sepolia"
  | "base-sepolia"
  | "arb-sepolia";

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
  | 84532
  | 421614
  | 42161
  | 1
  | 324
  | 300
  | 8453
  | 84532
  | 421614;

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
  /** Gated by `make swap-healthcheck`; flips off when Uniswap V3 pool liquidity is empty. */
  swapSupported: boolean;
  /** True only on chains where the ZK Email hosted relayer accepts proofs. */
  emailRecoverySupported: boolean;
  /** True when CrossChainExecutor is deployed on this chain. */
  crossChainSwapSupported: boolean;
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
    swapSupported: false,
    emailRecoverySupported: false,
    crossChainSwapSupported: false,
  },

  "ethereum-sepolia": (() => {
    const d = getDeployment("sepolia");
    return {
      networkKey: "ethereum-sepolia" as NetworkKey,
      chainId: 11155111 as SupportedChainId,
      sourceChainId: 11155111,
      deploymentProfile: "sepolia" as DeploymentProfile,
      name: "Ethereum Sepolia",
      displayName: "Sepolia",
      nativeCurrency: DEFAULT_NATIVE_ETH,
      rpcUrl: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? "",
      bundlerUrl: process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL ?? "",
      paymasterUrl: process.env.EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL,
      environment: "testnet" as ChainEnvironmentExtended,
      blockExplorerUrl: "https://sepolia.etherscan.io",
      isEnabled: Boolean(
        d?.entryPoint && d?.accountFactory &&
        process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL &&
        process.env.EXPO_PUBLIC_SEPOLIA_BUNDLER_URL
      ),
      defaultUsePaymaster: Boolean(process.env.EXPO_PUBLIC_SEPOLIA_PAYMASTER_URL),
      swapSupported: Boolean(d?.swapSupported),
      emailRecoverySupported: false, // ZK Email hosted relayer is Base Sepolia only
      crossChainSwapSupported: Boolean(d?.crossChainExecutor),
    };
  })(),

  "base-sepolia": (() => {
    const d = getDeployment("base-sepolia");
    return {
      networkKey: "base-sepolia" as NetworkKey,
      chainId: 84532 as SupportedChainId,
      sourceChainId: 84532,
      deploymentProfile: "base-sepolia" as DeploymentProfile,
      name: "Base Sepolia",
      displayName: "Base Sepolia",
      nativeCurrency: DEFAULT_NATIVE_ETH,
      rpcUrl: process.env.EXPO_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
      bundlerUrl: process.env.EXPO_PUBLIC_BASE_SEPOLIA_BUNDLER_URL ?? "",
      paymasterUrl: process.env.EXPO_PUBLIC_BASE_SEPOLIA_PAYMASTER_URL,
      environment: "testnet" as ChainEnvironmentExtended,
      blockExplorerUrl: "https://sepolia.basescan.org",
      isEnabled: Boolean(
        d?.entryPoint && d?.accountFactory &&
        process.env.EXPO_PUBLIC_BASE_SEPOLIA_BUNDLER_URL
      ),
      defaultUsePaymaster: Boolean(process.env.EXPO_PUBLIC_BASE_SEPOLIA_PAYMASTER_URL),
      swapSupported: Boolean(d?.swapSupported),
      emailRecoverySupported: true, // ZK Email hosted relayer is on Base Sepolia
      crossChainSwapSupported: Boolean(d?.crossChainExecutor),
    };
  })(),

  "arbitrum-sepolia": (() => {
    const d = getDeployment("arb-sepolia");
    return {
      networkKey: "arbitrum-sepolia" as NetworkKey,
      chainId: 421614 as SupportedChainId,
      sourceChainId: 421614,
      deploymentProfile: "arb-sepolia" as DeploymentProfile,
      name: "Arbitrum Sepolia",
      displayName: "Arbitrum Sepolia",
      nativeCurrency: DEFAULT_NATIVE_ETH,
      rpcUrl: process.env.EXPO_PUBLIC_ARB_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc",
      bundlerUrl: process.env.EXPO_PUBLIC_ARB_SEPOLIA_BUNDLER_URL ?? "",
      paymasterUrl: process.env.EXPO_PUBLIC_ARB_SEPOLIA_PAYMASTER_URL,
      environment: "testnet" as ChainEnvironmentExtended,
      blockExplorerUrl: "https://sepolia.arbiscan.io",
      isEnabled: Boolean(
        d?.entryPoint && d?.accountFactory &&
        process.env.EXPO_PUBLIC_ARB_SEPOLIA_BUNDLER_URL
      ),
      defaultUsePaymaster: Boolean(process.env.EXPO_PUBLIC_ARB_SEPOLIA_PAYMASTER_URL),
      swapSupported: Boolean(d?.swapSupported),
      emailRecoverySupported: false, // ZK Email hosted relayer is Base Sepolia only
      crossChainSwapSupported: Boolean(d?.crossChainExecutor),
    };
  })(),

  "base-mainnet": (() => {
    const d = getDeployment("base-mainnet");
    return {
      networkKey: "base-mainnet" as NetworkKey,
      chainId: 8453 as SupportedChainId,
      sourceChainId: 8453,
      deploymentProfile: "base-mainnet" as DeploymentProfile,
      name: "Base Mainnet",
      displayName: "Base",
      nativeCurrency: DEFAULT_NATIVE_ETH,
      rpcUrl: process.env.EXPO_PUBLIC_BASE_MAINNET_RPC_URL ?? "",
      bundlerUrl: process.env.EXPO_PUBLIC_BASE_MAINNET_BUNDLER_URL ?? "",
      paymasterUrl: process.env.EXPO_PUBLIC_BASE_MAINNET_PAYMASTER_URL,
      environment: "mainnet" as ChainEnvironmentExtended,
      blockExplorerUrl: "https://basescan.org",
      isEnabled: Boolean(
        d?.entryPoint && d?.accountFactory &&
        process.env.EXPO_PUBLIC_BASE_MAINNET_RPC_URL &&
        process.env.EXPO_PUBLIC_BASE_MAINNET_BUNDLER_URL
      ),
      defaultUsePaymaster: false,
      swapSupported: Boolean(d?.swapSupported),
      emailRecoverySupported: false,
      crossChainSwapSupported: true,
    };
  })(),

  "arb-mainnet": (() => {
    const d = getDeployment("arb-mainnet");
    return {
      networkKey: "arb-mainnet" as NetworkKey,
      chainId: 42161 as SupportedChainId,
      sourceChainId: 42161,
      deploymentProfile: "arb-mainnet" as DeploymentProfile,
      name: "Arbitrum One",
      displayName: "Arbitrum",
      nativeCurrency: DEFAULT_NATIVE_ETH,
      rpcUrl: process.env.EXPO_PUBLIC_ARB_MAINNET_RPC_URL ?? "",
      bundlerUrl: process.env.EXPO_PUBLIC_ARB_MAINNET_BUNDLER_URL ?? "",
      paymasterUrl: undefined,
      environment: "mainnet" as ChainEnvironmentExtended,
      blockExplorerUrl: "https://arbiscan.io",
      isEnabled: Boolean(
        d?.entryPoint && d?.accountFactory &&
        process.env.EXPO_PUBLIC_ARB_MAINNET_RPC_URL &&
        process.env.EXPO_PUBLIC_ARB_MAINNET_BUNDLER_URL
      ),
      defaultUsePaymaster: false,
      swapSupported: Boolean(d?.swapSupported),
      emailRecoverySupported: false,
      crossChainSwapSupported: true,
    };
  })(),

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
      paymasterUrl:
        process.env.EXPO_PUBLIC_BASE_FORK_PAYMASTER_URL ??
        `http://${INFRA_IP}:3000`,
      environment: "local_fork" as ChainEnvironmentExtended,
      blockExplorerUrl: "https://basescan.org",
      isEnabled: Boolean(
        deployment?.entryPoint && deployment?.accountFactory
      ),
      isDevelopmentOnly: true,
      defaultUsePaymaster: true,
      swapSupported: Boolean(deployment?.swapSupported ?? true), // fork has working Uniswap
      emailRecoverySupported: false,
      crossChainSwapSupported: Boolean(deployment?.crossChainExecutor),
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
