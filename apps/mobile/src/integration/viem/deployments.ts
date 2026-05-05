/**
 * deployments.ts
 *
 * Resolves Trezo contract deployment manifests by:
 *   - DeploymentProfile  ("31337" | "base-mainnet-fork")
 *   - NetworkKey         ("anvil-local" | "base-mainnet-fork" | …)
 *   - Legacy SupportedChainId  (backwards compat)
 */

// Static imports of known manifests
import deployment31337 from "../contracts/deployment.31337.json";

// NOTE: deployment.base-mainnet-fork.json is loaded dynamically so it doesn't
// break the build if the file doesn't exist yet. We catch the require error and
// return undefined in that case.
let deploymentBaseFork: DeploymentAddresses | undefined;
try {
  deploymentBaseFork = require("../contracts/deployment.base-mainnet-fork.json") as DeploymentAddresses;
} catch {
  deploymentBaseFork = undefined;
}

// ─── Public types ─────────────────────────────────────────────────────────────

/** App-level deployment profile identifier — decoupled from chainId. */
export type DeploymentProfile = "31337" | "base-mainnet-fork";

/**
 * Local mobile reads the derived compatibility manifest generated under
 * contracts/deployments/<profile>.json.
 */
export type DeploymentAddresses = {
  chainId: number;
  entryPoint: `0x${string}`;
  smartAccountImpl: `0x${string}`;
  proxyFactory: `0x${string}`;
  accountFactory: `0x${string}`;
  passkeyValidator: `0x${string}`;
  socialRecovery: `0x${string}`;
  infraVersion?: string;
  rootFactory?: `0x${string}`;
  portable?: boolean;
  emailRecovery?: `0x${string}`;
  emailRecoveryCommandHandler?: `0x${string}`;
  zkEmailVerifier?: `0x${string}`;
  zkEmailDkimRegistry?: `0x${string}`;
  zkEmailAuthImpl?: `0x${string}`;
  zkEmailGroth16Verifier?: `0x${string}`;
  zkEmailVerifierImpl?: `0x${string}`;
  zkEmailDkimRegistryImpl?: `0x${string}`;
  emailRecoveryKillSwitchAuthorizer?: `0x${string}`;
  emailRecoveryMinimumDelay?: number;
  usdc?: `0x${string}`;
  mockSwapRouter?: `0x${string}`;
  mockSwapTokens?: Record<string, `0x${string}`>;
  mockSwapTokenMeta?: Record<string, {
    name?: string;
    decimals?: number;
    tags?: string[];
    isSwapSupported?: boolean;
  }>;
  deployer?: `0x${string}`;
  success: boolean;
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const DEPLOYMENTS_BY_PROFILE: Partial<Record<DeploymentProfile, DeploymentAddresses>> = {
  "31337": deployment31337 as DeploymentAddresses,
  "base-mainnet-fork": deploymentBaseFork,
};

// ─── Lookup by profile ────────────────────────────────────────────────────────

/** Look up a deployment manifest by DeploymentProfile. */
export function getDeployment(profile: DeploymentProfile): DeploymentAddresses | undefined;
/** @deprecated Use getDeployment(profile) or getDeploymentForNetwork(networkKey). */
export function getDeployment(chainId: number): DeploymentAddresses | undefined;
export function getDeployment(profileOrChainId: DeploymentProfile | number): DeploymentAddresses | undefined {
  if (typeof profileOrChainId === "number") {
    // Legacy chain-id lookup for callers that have not moved to networkKey yet.
    if (profileOrChainId === 31337) return DEPLOYMENTS_BY_PROFILE["31337"];
    if (profileOrChainId === 8453) return DEPLOYMENTS_BY_PROFILE["base-mainnet-fork"];
    return undefined;
  }
  return DEPLOYMENTS_BY_PROFILE[profileOrChainId];
}

/**
 * Returns the deployment for a given networkKey by mapping it to a
 * DeploymentProfile.  Imported lazily to avoid circular deps with networks.ts.
 */
export function getDeploymentForNetwork(networkKey: string): DeploymentAddresses | undefined {
  // Map network keys to deployment profiles without importing networks.ts
  // (which itself imports this module, causing a cycle).
  const profileMap: Record<string, DeploymentProfile> = {
    "anvil-local": "31337",
    "ethereum-sepolia": "31337",
    "base-mainnet": "base-mainnet-fork",
    "base-mainnet-fork": "base-mainnet-fork",
  };

  const profile = profileMap[networkKey];
  if (!profile) return undefined;
  return DEPLOYMENTS_BY_PROFILE[profile];
}

/**
 * @deprecated Use getDeployment(profile) with a DeploymentProfile string.
 * Kept for callers that still pass a legacy SupportedChainId.
 */
export function getDeploymentByChainId(chainId: number): DeploymentAddresses | undefined {
  return getDeployment(chainId as never);
}
