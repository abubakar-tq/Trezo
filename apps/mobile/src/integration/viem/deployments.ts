import deployment31337 from "../contracts/deployment.31337.json";
import type { SupportedChainId } from "../chains";

export type DeploymentAddresses = {
  chainId: number;
  entryPoint: `0x${string}`;
  smartAccountImpl: `0x${string}`;
  proxyFactory: `0x${string}`;
  accountFactory: `0x${string}`;
  passkeyValidator: `0x${string}`;
  socialRecovery: `0x${string}`;
  usdc: `0x${string}`;
  deployer: `0x${string}`;
  success: boolean;
};

export const DEPLOYMENTS: Partial<Record<SupportedChainId, DeploymentAddresses>> = {
  31337: deployment31337 as DeploymentAddresses,
};

export function getDeployment(chainId: SupportedChainId): DeploymentAddresses | undefined {
  return DEPLOYMENTS[chainId];
}
