import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Chain Configuration for Local Anvil Testnet
 *
 * Dev services run on the development laptop by default. Set
 * EXPO_PUBLIC_LOCAL_SERVICE_HOST or the per-service EXPO_PUBLIC_ANVIL_* URLs
 * when the Anvil/bundler/paymaster host changes.
 */
export const CHAIN_CONFIG = {
  chainId: 31337, // Anvil default
  name: 'Anvil Local Testnet',
};

const DEFAULT_LOCAL_SERVICE_HOST =
  process.env.EXPO_PUBLIC_LOCAL_SERVICE_HOST?.trim() || '192.168.100.68';

// Detect device/simulator
const isExpoGo = Constants.appOwnership === 'expo';
const isPhysicalDevice = Constants.isDevice ?? true;
const isIOSSimulator = Platform.OS === 'ios' && !isPhysicalDevice;
const isAndroidEmulator = Platform.OS === 'android' && !isPhysicalDevice;

const getEnvUrl = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const debugLog = (message: string) => {
  if (__DEV__) {
    console.log(message);
  }
};

const resolveLocalServiceUrl = (
  configuredUrl: string | undefined,
  fallbackUrl: string,
): string => {
  if (configuredUrl) return configuredUrl;
  return fallbackUrl;
};

const buildDefaultServiceUrl = (port: number) => `http://${DEFAULT_LOCAL_SERVICE_HOST}:${port}`;

/**
 * Get RPC URL based on platform and environment
 *
 * Devices, simulators, and emulators use the configured dev host by default.
 */
export const getRpcUrl = (): string => {
  const url = resolveLocalServiceUrl(
    getEnvUrl(process.env.EXPO_PUBLIC_ANVIL_RPC_URL),
    buildDefaultServiceUrl(8545),
  );
  debugLog(`🌐 [Chain] RPC URL: ${url}`);
  return url;
};

/**
 * Get Bundler URL (ERC-4337)
 */
export const getBundlerUrl = (): string => {
  return resolveLocalServiceUrl(
    getEnvUrl(process.env.EXPO_PUBLIC_ANVIL_BUNDLER_URL),
    buildDefaultServiceUrl(4337),
  );
};

/**
 * Get Paymaster URL (Gasless transactions)
 */
export const getPaymasterUrl = (): string => {
  return resolveLocalServiceUrl(
    getEnvUrl(process.env.EXPO_PUBLIC_ANVIL_PAYMASTER_URL),
    buildDefaultServiceUrl(3000),
  );
};

/**
 * Log current network configuration
 */
export const logNetworkConfig = () => {
  if (!__DEV__) return;
  console.log('📡 [Chain Config]', {
    platform: Platform.OS,
    isPhysicalDevice,
    isAndroidEmulator,
    isIOSSimulator,
    isExpoGo,
    chainId: CHAIN_CONFIG.chainId,
    rpcUrl: getRpcUrl(),
    bundlerUrl: getBundlerUrl(),
    paymasterUrl: getPaymasterUrl(),
  });
};
