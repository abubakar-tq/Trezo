
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
    // for Android emulator → host machine: 10.0.2.2
    // adjust if you're using something else
    // rpcUrl: "http://10.0.2.2:8545",
    rpcUrl: "http://127.0.0.1:8545",
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

export function getChainConfig(chainId: SupportedChainId = DEFAULT_CHAIN_ID): ChainConfig {
  return CHAINS[chainId];
}
