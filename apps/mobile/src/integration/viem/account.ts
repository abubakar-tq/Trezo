import { encodeFunctionData, parseEther, type Hex, type Address } from 'viem';
import { getDeployment } from './deployments';
import { getPublicClient, getWalletClientFromPrivateKey } from './clients';
import type { SupportedChainId } from '../chains';
import AccountFactoryABI from '../abi/AccountFactory.json';

/**
 * Predict the deterministic address of a smart account before deployment
 */
export async function predictAccountAddress(chainId: number, salt: Hex): Promise<Address> {
  const deployment = getDeployment(chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${chainId}`);
  if (!deployment.accountFactory || deployment.accountFactory === '0x0000000000000000000000000000000000000000') {
    throw new Error(
      `Deployment config missing accountFactory for chain ${chainId}. `
      + 'Run contract deployment and sync mobile artifacts.',
    );
  }

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

/**
 * Dev helper: prefund a predicted account using Anvil's default rich account.
 * Only for local testing; do not ship to production builds.
 */
const DEV_FUNDER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

export async function fundAccount({
  chainId,
  to,
  amountEth = 0.05,
}: {
  chainId: SupportedChainId;
  to: Address;
  amountEth?: number;
}) {
  const walletClient = getWalletClientFromPrivateKey(DEV_FUNDER_PRIVATE_KEY, chainId);
  const publicClient = getPublicClient(chainId);

  const hash = await walletClient.sendTransaction({
    to,
    value: parseEther(amountEth.toString()),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}

const entryPointAbi = [
  {
    type: 'function',
    name: 'depositTo',
    stateMutability: 'payable',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [],
  },
] as const;

/**
 * Dev helper: fund EntryPoint deposit for a (possibly undeployed) account.
 * This is what AA21 expects when no paymaster is used.
 */
export async function fundEntryPointDeposit({
  chainId,
  account,
  amountEth = 0.05,
}: {
  chainId: SupportedChainId;
  account: Address;
  amountEth?: number;
}) {
  const walletClient = getWalletClientFromPrivateKey(DEV_FUNDER_PRIVATE_KEY, chainId);
  const publicClient = getPublicClient(chainId);
  const deployment = getDeployment(chainId);
  if (!deployment?.entryPoint) throw new Error(`EntryPoint missing for chain ${chainId}`);

  const hash = await walletClient.writeContract({
    address: deployment.entryPoint as Address,
    abi: entryPointAbi,
    functionName: 'depositTo',
    args: [account],
    value: parseEther(amountEth.toString()),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}
