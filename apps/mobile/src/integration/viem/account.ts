import { type Hex, type Address } from 'viem';
import { getDeployment } from './deployments';
import { getPublicClient } from './clients';
import AccountFactoryABI from '../abi/AccountFactory.json';

/**
 * Predict the deterministic address of a smart account before deployment
 */
export async function predictAccountAddress(chainId: number, salt: Hex): Promise<Address> {
  const deployment = getDeployment(chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${chainId}`);

  const publicClient = getPublicClient(chainId);

  // Call predictAccount on the AccountFactory
  const address = await publicClient.readContract({
    address: deployment.accountFactory as Address,
    abi: AccountFactoryABI.abi,
    functionName: 'predictAccount',
    args: [salt],
  });

  return address as Address;
}

/**
 * Check if code exists at an address (i.e., if contract is deployed)
 */
export async function isContractDeployed(chainId: number, address: Address): Promise<boolean> {
  const publicClient = getPublicClient(chainId);

  const code = await publicClient.getBytecode({ address });
  return code !== undefined && code !== '0x';
}
