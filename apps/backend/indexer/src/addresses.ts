import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS_DIR = join(__dirname, "../../../../contracts/deployments");

interface DeploymentJson {
  chainId: number;
  accountFactory: string;
  smartAccountImpl: string;
  passkeyValidator: string;
  socialRecovery: string;
  emailRecovery?: string;
  entryPoint: string;
  proxyFactory: string;
  [key: string]: unknown;
}

// Returns null when the deployment artifact is absent (e.g. a hosted indexer like Render,
// where local-only profiles such as 31337 / base-mainnet-fork are not committed to git).
function loadDeployment(profile: string): DeploymentJson | null {
  try {
    const path = join(DEPLOYMENTS_DIR, `${profile}.json`);
    return JSON.parse(readFileSync(path, "utf8")) as DeploymentJson;
  } catch {
    return null;
  }
}

export const ANVIL_LOCAL = loadDeployment("31337");
export const BASE_FORK = loadDeployment("base-mainnet-fork");

export const ENTRYPOINT_V07 = "0x0000000071727De22E5E9d8BAf0edAc6f37da032" as const;

export interface TestnetChainDef {
  id: number;
  rpc?: string;
  accountFactory?: `0x${string}`;
  socialRecovery?: `0x${string}`;
  passkeyValidator?: `0x${string}`;
  startBlock: number;
  tokens: `0x${string}`[]; // known ERC-20 contracts to index (Transfer-volume control)
}

export const TESTNET_CHAINS: Record<string, TestnetChainDef> = {
  baseSepolia: {
    id: 84532,
    rpc: process.env.PONDER_BASE_SEPOLIA_RPC_URL,
    accountFactory: (process.env.BASE_SEPOLIA_ACCOUNT_FACTORY ?? "0xBc20fACed405c4806f4B1bEf9B8C6704ae0afC9F") as `0x${string}`,
    socialRecovery: (process.env.BASE_SEPOLIA_SOCIAL_RECOVERY ?? "0x735fD4912c11AB281C482E2c7B32D37D48b574B5") as `0x${string}`,
    passkeyValidator: (process.env.BASE_SEPOLIA_PASSKEY_VALIDATOR ?? "0xD3252Ca22F6a2A294F003eF95ea1768C30f9976A") as `0x${string}`,
    startBlock: Number(process.env.BASE_SEPOLIA_START_BLOCK ?? "41380204"),
    tokens: [
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC
      "0x4200000000000000000000000000000000000006", // WETH
      "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", // LINK
    ],
  },
  ethSepolia: {
    id: 11155111,
    rpc: process.env.PONDER_ETH_SEPOLIA_RPC_URL,
    accountFactory: (process.env.ETH_SEPOLIA_ACCOUNT_FACTORY ?? "0xBc20fACed405c4806f4B1bEf9B8C6704ae0afC9F") as `0x${string}`,
    socialRecovery: (process.env.ETH_SEPOLIA_SOCIAL_RECOVERY ?? "0x735fD4912c11AB281C482E2c7B32D37D48b574B5") as `0x${string}`,
    passkeyValidator: (process.env.ETH_SEPOLIA_PASSKEY_VALIDATOR ?? "0xD3252Ca22F6a2A294F003eF95ea1768C30f9976A") as `0x${string}`,
    startBlock: Number(process.env.ETH_SEPOLIA_START_BLOCK ?? "10945815"),
    tokens: [
      "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC
      "0xfff9976782d46cc05630d1f6ebab18b2324d6b14", // WETH
    ],
  },
  arbSepolia: { // NOT deployed yet — no address defaults, so it stays inactive until env provides them
    id: 421614,
    rpc: process.env.PONDER_ARB_SEPOLIA_RPC_URL,
    accountFactory: process.env.ARB_SEPOLIA_ACCOUNT_FACTORY as `0x${string}` | undefined,
    socialRecovery: process.env.ARB_SEPOLIA_SOCIAL_RECOVERY as `0x${string}` | undefined,
    passkeyValidator: process.env.ARB_SEPOLIA_PASSKEY_VALIDATOR as `0x${string}` | undefined,
    startBlock: Number(process.env.ARB_SEPOLIA_START_BLOCK ?? "0"),
    tokens: [
      "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // USDC
      "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73", // WETH
    ],
  },
};

// Active = RPC and AccountFactory both set. Arb Sepolia stays out until deployed.
export const ACTIVE_TESTNET_CHAINS: Record<string, TestnetChainDef> = Object.fromEntries(
  Object.entries(TESTNET_CHAINS).filter(([, c]) => Boolean(c.rpc && c.accountFactory)),
);
