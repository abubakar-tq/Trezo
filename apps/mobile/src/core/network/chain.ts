import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Chain Configuration for Local Anvil Testnet
 * 
 * IMPORTANT: Update LAPTOP_IP with your actual WiFi IP address
 * Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
 * Current value should match your network IP
 */
export const CHAIN_CONFIG = {
  chainId: 31337, // Anvil default
  name: 'Anvil Local Testnet',
  // Try to get IP from environment, fallback to a default
  LAPTOP_IP: process.env.EXPO_PUBLIC_LAPTOP_IP || '10.70.81.26', 
};

// Detect device/simulator
const isExpoGo = Constants.appOwnership === 'expo';
const isPhysicalDevice = Constants.isDevice ?? true;
const isIOSSimulator = Platform.OS === 'ios' && !isPhysicalDevice;
const isAndroidEmulator = Platform.OS === 'android' && !isPhysicalDevice;

/**
 * Get RPC URL based on platform and environment
 *
 * Physical devices (dev clients/installed APK/IPA) must hit your laptop IP.
 * Emulator/simulator use their loopback helpers.
 */
export const getRpcUrl = (): string => {
  // Android emulator
  if (isAndroidEmulator) {
    const url = 'http://10.0.2.2:8545';
    console.log(`🌐 [Chain] RPC URL (Android Emulator): ${url}`);
    return url;
  }

  // iOS simulator
  if (isIOSSimulator) {
    const url = 'http://localhost:8545';
    console.log(`🌐 [Chain] RPC URL (iOS Simulator): ${url}`);
    return url;
  }

  // Physical device or Expo Go
  const url = `http://${CHAIN_CONFIG.LAPTOP_IP}:8545`;
  console.log(`🌐 [Chain] RPC URL (Physical Device): ${url}`);
  return url;
};

/**
 * Get Bundler URL (ERC-4337)
 */
export const getBundlerUrl = (): string => {
  if (isAndroidEmulator) return 'http://10.0.2.2:4337';
  if (isIOSSimulator) return 'http://localhost:4337';
  return `http://${CHAIN_CONFIG.LAPTOP_IP}:4337`;
};

/**
 * Get Paymaster URL (Gasless transactions)
 */
export const getPaymasterUrl = (): string => {
  if (isAndroidEmulator) return 'http://10.0.2.2:3000';
  if (isIOSSimulator) return 'http://localhost:3000';
  return `http://${CHAIN_CONFIG.LAPTOP_IP}:3000`;
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
