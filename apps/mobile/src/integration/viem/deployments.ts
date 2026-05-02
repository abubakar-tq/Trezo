import deployment31337 from "../../../../../contracts/deployments/31337.json";
import type { SupportedChainId } from "../chains";

// Local mobile reads the derived compatibility manifest generated under contracts/deployments/<chainId>.json.
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
  deployer?: `0x${string}`;
  success: boolean;
};

export const DEPLOYMENTS: Partial<Record<SupportedChainId, DeploymentAddresses>> = {
  31337: deployment31337 as DeploymentAddresses,
};

export function getDeployment(chainId: SupportedChainId): DeploymentAddresses | undefined {
  return DEPLOYMENTS[chainId];
}
