import sepoliaDep from "./deployments/sepolia.json";
import baseSepoliaDep from "./deployments/base-sepolia.json";
import arbSepoliaDep from "./deployments/arb-sepolia.json";

export type ExtChainId = 11155111 | 84532 | 421614;

export type DeploymentJson = typeof sepoliaDep & Partial<typeof baseSepoliaDep>;

export type NetworkConfig = {
  chainId: ExtChainId;
  name: string;
  rpcUrl: string;
  bundlerUrl: string;
  paymasterUrl: string;
  blockExplorerUrl: string;
  deployment: DeploymentJson;
};

const env = import.meta.env;

// dep is typed as the intersection of the core fields shared by all deployment JSONs
type AnyDep = typeof sepoliaDep | typeof baseSepoliaDep | typeof arbSepoliaDep;
const RAW: Array<{ chainId: ExtChainId; name: string; explorer: string; dep: AnyDep;
  rpc?: string; bundler?: string; paymaster?: string }> = [
  { chainId: 11155111, name: "Ethereum Sepolia", explorer: "https://sepolia.etherscan.io", dep: sepoliaDep,
    rpc: env.VITE_SEPOLIA_RPC_URL, bundler: env.VITE_SEPOLIA_BUNDLER_URL, paymaster: env.VITE_SEPOLIA_PAYMASTER_URL },
  { chainId: 84532, name: "Base Sepolia", explorer: "https://sepolia.basescan.org", dep: baseSepoliaDep,
    rpc: env.VITE_BASE_SEPOLIA_RPC_URL, bundler: env.VITE_BASE_SEPOLIA_BUNDLER_URL, paymaster: env.VITE_BASE_SEPOLIA_PAYMASTER_URL },
  { chainId: 421614, name: "Arbitrum Sepolia", explorer: "https://sepolia.arbiscan.io", dep: arbSepoliaDep,
    rpc: env.VITE_ARB_SEPOLIA_RPC_URL, bundler: env.VITE_ARB_SEPOLIA_BUNDLER_URL, paymaster: env.VITE_ARB_SEPOLIA_PAYMASTER_URL },
];

export const NETWORKS: Partial<Record<ExtChainId, NetworkConfig>> = {};
for (const r of RAW) {
  if (r.rpc && r.bundler) {
    NETWORKS[r.chainId] = {
      chainId: r.chainId, name: r.name, rpcUrl: r.rpc, bundlerUrl: r.bundler,
      paymasterUrl: r.paymaster ?? r.bundler, blockExplorerUrl: r.explorer, deployment: r.dep as DeploymentJson,
    };
  }
}

export const ENABLED_CHAIN_IDS = Object.keys(NETWORKS).map(Number) as ExtChainId[];
export const DEFAULT_CHAIN_ID: ExtChainId = (ENABLED_CHAIN_IDS.includes(11155111) ? 11155111 : ENABLED_CHAIN_IDS[0]);

export const getNetwork = (chainId: number): NetworkConfig => {
  const n = NETWORKS[chainId as ExtChainId];
  if (!n) throw new Error(`Unsupported/!enabled chain ${chainId}`);
  return n;
};
export const isEnabledChain = (chainId: number): boolean => chainId in NETWORKS;
