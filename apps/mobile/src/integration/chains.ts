import { getRpcUrl } from '../core/network/chain';

export type SupportedChainId =
  | 31337     // local Anvil
  | 11155111  // Ethereum Sepolia
  | 1         // Ethereum mainnet 
  | 324       // zkSync mainnet 
  | 300;      // zkSync sepolia 

// Basic config for each chain the APP talks to
export type ChainConfig = {
  id: SupportedChainId;
  name: string;
  rpcUrl: string;
  // you can extend later: explorerUrl, nativeCurrency, etc.
};

export const CHAINS: Record<SupportedChainId, ChainConfig> = {
  31337: {
    id: 31337,
    name: "Local Anvil",
    // Use unified IP detection logic
    get rpcUrl() { return getRpcUrl(); },
  },
  11155111: {
    id: 11155111,
    name: "Ethereum Sepolia",
    // put your real RPC here or load from env later
    rpcUrl: process.env.EXPO_PUBLIC_SEPOLIA_RPC_URL ?? "",
  },
  1: {
    id: 1,
    name: "Ethereum Mainnet",
    rpcUrl: process.env.EXPO_PUBLIC_MAINNET_RPC_URL ?? "",
  },
  324: {
    id: 324,
    name: "zkSync Mainnet",
    rpcUrl: process.env.EXPO_PUBLIC_ZKSYNC_MAINNET_RPC_URL ?? "",
  },
  300: {
    id: 300,
    name: "zkSync Sepolia",
    rpcUrl: process.env.EXPO_PUBLIC_ZKSYNC_SEPOLIA_RPC_URL ?? "",
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
