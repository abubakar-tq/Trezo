import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ─── Read from .env ───────────────────────────────────────────────────────────
// EXPO_PUBLIC_CHAIN_ID  → 31337 (Anvil local) | 11155111 (Sepolia)
// EXPO_PUBLIC_LAPTOP_IP → your WiFi IP, used only when chainId=31337
// EXPO_PUBLIC_SEPOLIA_RPC_URL → optional override; defaults to public Sepolia RPC

const CHAIN_ID = parseInt(process.env.EXPO_PUBLIC_CHAIN_ID ?? '31337', 10);
const LAPTOP_IP = process.env.EXPO_PUBLIC_LAPTOP_IP ?? '10.45.194.26';
const SEPOLIA_RPC = process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? 'https://rpc.sepolia.org';

const CHAIN_NAMES: Record<number, string> = {
  31337: 'Anvil Local',
  11155111: 'Sepolia',
  1: 'Ethereum',
  137: 'Polygon',
};

export const CHAIN_CONFIG = {
  chainId: CHAIN_ID,
  name: CHAIN_NAMES[CHAIN_ID] ?? `Chain ${CHAIN_ID}`,
  LAPTOP_IP,
};

// Detect device/simulator (only relevant for local Anvil routing)
const isExpoGo = Constants.appOwnership === 'expo';
const isPhysicalDevice = Constants.isDevice ?? true;
const isIOSSimulator = Platform.OS === 'ios' && !isPhysicalDevice;
const isAndroidEmulator = Platform.OS === 'android' && !isPhysicalDevice;

/**
 * Get RPC URL.
 * - Testnet/mainnet (chainId != 31337): uses EXPO_PUBLIC_SEPOLIA_RPC_URL or public fallback.
 * - Local Anvil (chainId 31337): routes by platform so emulator/physical device both work.
 */
export const getRpcUrl = (): string => {
  if (CHAIN_ID !== 31337) return SEPOLIA_RPC;
  if (isAndroidEmulator) return 'http://10.0.2.2:8545';
  if (isIOSSimulator) return 'http://localhost:8545';
  return `http://${LAPTOP_IP}:8545`;
};

/**
 * Get Bundler URL (ERC-4337).
 * Only meaningful on local Anvil — no bundler for testnet in this setup.
 */
export const getBundlerUrl = (): string => {
  if (isAndroidEmulator) return 'http://10.0.2.2:4337';
  if (isIOSSimulator) return 'http://localhost:4337';
  return `http://${LAPTOP_IP}:4337`;
};

/**
 * Get Paymaster URL.
 * Only meaningful on local Anvil.
 */
export const getPaymasterUrl = (): string => {
  if (isAndroidEmulator) return 'http://10.0.2.2:3000';
  if (isIOSSimulator) return 'http://localhost:3000';
  return `http://${LAPTOP_IP}:3000`;
};

/**
 * Log current network configuration
 */
export const logNetworkConfig = () => {
  console.log('📡 [Chain Config]', {
    platform: Platform.OS,
    isPhysicalDevice,
    isExpoGo,
    chainId: CHAIN_CONFIG.chainId,
    rpcUrl: getRpcUrl(),
    bundlerUrl: getBundlerUrl(),
    paymasterUrl: getPaymasterUrl(),
  });
};
