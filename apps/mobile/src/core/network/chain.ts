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
  
  // Your laptop's WiFi IP address (MUST UPDATE THIS!)
  // Use the WiFi adapter IP, not VirtualBox/WSL IPs
  LAPTOP_IP: '10.211.40.26', // ✅ Updated from ipconfig
  
  // Contract Addresses (deployed by docker-compose)
  contracts: {
    entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032', // EntryPoint v0.7 (pre-deployed)
    simpleAccountFactory: '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985', // SimpleAccountFactory v0.7 from Pimlico
  }
};

// Detect if running on physical device or emulator/simulator
// For Expo Go, we ALWAYS use WiFi IP (both iOS and Android physical devices)
// Emulators/simulators use different IPs (10.0.2.2 for Android, localhost for iOS)
const isExpoGo = Constants.appOwnership === 'expo';
const isPhysicalDevice = Constants.isDevice ?? true;

// iOS Simulator check: executionEnvironment === 'storeClient' means iOS simulator
const isIOSSimulator = Platform.OS === 'ios' && !isPhysicalDevice;
const isAndroidEmulator = Platform.OS === 'android' && !isPhysicalDevice;

/**
 * Get RPC URL based on platform and environment
 * 
 * - Physical device with Expo Go + tunnel: Use laptop WiFi IP
 * - Android emulator: Use 10.0.2.2 (emulator's host loopback)
 * - iOS simulator: Use localhost
 */
export const getRpcUrl = (): string => {
  // For Expo Go with tunnel, always use laptop WiFi IP (physical device scenario)
  // if (isExpoGo) {
  //   const url = `http://${CHAIN_CONFIG.LAPTOP_IP}:8545`;
  //   console.log(`🌐 [Chain] RPC URL (Expo Go/Physical Device): ${url}`);
  //   return url;
  // }
  
  // // Android emulator/simulator (development build, not Expo Go)
  // if (Platform.OS === 'android') {
  //   const url = 'http://10.0.2.2:8545';
  //   console.log(`🌐 [Chain] RPC URL (Android Emulator): ${url}`);
  //   return url;
  // }
  
  // iOS simulator (development build)
  const url = 'http://192.168.100.68:8545';
  console.log(`🌐 [Chain] RPC URL (iOS Simulator): ${url}`);
  return url;
};

/**
 * Get Bundler URL (ERC-4337)
 */
export const getBundlerUrl = (): string => {
  if (isExpoGo) {
    return `http://${CHAIN_CONFIG.LAPTOP_IP}:4337`;
  }
  // if (Platform.OS === 'android') {
  //   return 'http://10.0.2.2:4337';
  // }
  return 'http://192.168.100.68:4337';
};

/**
 * Get Paymaster URL (Gasless transactions)
 */
export const getPaymasterUrl = (): string => {
  // if (isExpoGo) {
  //   return `http://${CHAIN_CONFIG.LAPTOP_IP}:3000`;
  // }
  // if (Platform.localhost:8545OS === 'android') {
  //   return 'http://10.0.2.2:3000';
  // }
  return 'http://192.168.100.68:3000';
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
