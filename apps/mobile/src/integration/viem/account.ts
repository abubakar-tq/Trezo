import { parseEther, type Hex, type Address } from 'viem';
import { getDeployment } from './deployments';
import { getPublicClient, getWalletClientFromPrivateKey } from './clients';
import type { SupportedChainId } from '../chains';
import AccountFactoryABI from '../abi/AccountFactory.json';
import { ABIS } from './abis';
import type { DeploymentMode, PasskeyInit } from './userOps';

const toPasskeyTuple = (passkeyInit: PasskeyInit) => [
  passkeyInit.idRaw,
  BigInt(passkeyInit.px),
  BigInt(passkeyInit.py),
] as const;

/**
 * Predict the deterministic address of a smart account before deployment.
 * Prediction is bound to the full deployment snapshot.
 */
export async function predictAccountAddress(
  chainId: SupportedChainId,
  walletId: Hex,
  validator: Address,
  passkeyInit: PasskeyInit,
  walletIndex: bigint | number = 0n,
  mode: DeploymentMode = "portable",
): Promise<Address> {
  const deployment = getDeployment(chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${chainId}`);
  if (!deployment.accountFactory || deployment.accountFactory === '0x0000000000000000000000000000000000000000') {
    throw new Error(
      `Deployment config missing accountFactory for chain ${chainId}. `
      + 'Run contract deployment and sync mobile artifacts.',
    );
  }

  const publicClient = getPublicClient(chainId);
  const address = await publicClient.readContract({
    address: deployment.accountFactory as Address,
    abi: AccountFactoryABI.abi,
    functionName: mode === "chain-specific" ? 'predictChainSpecificAccount' : 'predictAccount',
    args: [walletId, BigInt(walletIndex), validator, toPasskeyTuple(passkeyInit)],
  });

  return address as Address;
}

/**
 * Check if code exists at an address (i.e., if contract is deployed)
 */
export async function isContractDeployed(chainId: SupportedChainId, address: Address): Promise<boolean> {
  const publicClient = getPublicClient(chainId);

  const code = await publicClient.getBytecode({ address });
  return code !== undefined && code !== '0x';
}

export async function isExecutorModuleInstalled({
  chainId,
  smartAccountAddress,
  moduleAddress,
}: {
  chainId: SupportedChainId;
  smartAccountAddress: Address;
  moduleAddress: Address;
}): Promise<boolean> {
  const publicClient = getPublicClient(chainId);
  return publicClient.readContract({
    address: smartAccountAddress,
    abi: ABIS.smartAccount,
    functionName: 'isModuleInstalled',
    args: [2n, moduleAddress, '0x'],
  }) as Promise<boolean>;
}

export type PasskeyRecordOnChain = {
  exists: boolean;
  px: bigint;
  py: bigint;
  signCounter: number;
  counterInitialized: boolean;
};

export async function checkPasskeyOnChain({
  chainId,
  smartAccountAddress,
  passkeyId,
  validatorAddress,
}: {
  chainId: SupportedChainId;
  smartAccountAddress: Address;
  passkeyId: `0x${string}`;
  validatorAddress?: Address;
}): Promise<PasskeyRecordOnChain> {
  const deployment = getDeployment(chainId);
  const validator = validatorAddress ?? (deployment?.passkeyValidator as Address | undefined);
  if (!validator) {
    throw new Error(`No passkey validator configured for chain ${chainId}`);
  }

  const publicClient = getPublicClient(chainId);
  const [exists, record] = await Promise.all([
    publicClient.readContract({
      address: validator,
      abi: ABIS.passkeyValidator,
      functionName: 'hasPasskey',
      args: [smartAccountAddress, passkeyId],
    }) as Promise<boolean>,
    publicClient.readContract({
      address: validator,
      abi: ABIS.passkeyValidator,
      functionName: 'getPasskeyRecord',
      args: [smartAccountAddress, passkeyId],
    }) as Promise<{
      px: bigint;
      py: bigint;
      signCounter: number;
      counterInitialized: boolean;
    }>,
  ]);

  return {
    exists,
    px: record.px,
    py: record.py,
    signCounter: record.signCounter,
    counterInitialized: record.counterInitialized,
  };
}

export type PasskeyOnchainState = {
  exists: boolean;
  executeAfter: bigint;
  requestedAt: bigint;
  cancelled: boolean;
};

export async function getPasskeyOnchainState({
  chainId,
  smartAccountAddress,
  passkeyId,
  validatorAddress,
}: {
  chainId: SupportedChainId;
  smartAccountAddress: Address;
  passkeyId: `0x${string}`;
  validatorAddress?: Address;
}): Promise<PasskeyOnchainState> {
  const deployment = getDeployment(chainId);
  const validator = validatorAddress ?? (deployment?.passkeyValidator as Address | undefined);
  if (!validator) {
    throw new Error(`No passkey validator configured for chain ${chainId}`);
  }

  const publicClient = getPublicClient(chainId);
  const [exists, pending] = await Promise.all([
    publicClient.readContract({
      address: validator,
      abi: ABIS.passkeyValidator,
      functionName: 'hasPasskey',
      args: [smartAccountAddress, passkeyId],
    }) as Promise<boolean>,
    publicClient.readContract({
      address: validator,
      abi: ABIS.passkeyValidator,
      functionName: 'pendingRemovals',
      args: [smartAccountAddress, passkeyId],
    }) as Promise<{
      executeAfter: bigint;
      requestedAt: bigint;
      cancelled: boolean;
    }>,
  ]);

  return {
    exists,
    executeAfter: pending.executeAfter,
    requestedAt: pending.requestedAt,
    cancelled: pending.cancelled,
  };
}

/**
 * Dev helper: prefund a predicted account using Anvil's default rich account.
 * Only for local testing; do not ship to production builds.
 */
const DEV_FUNDER_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

const assertRpcChainMatchesSigner = async (
  publicClient: ReturnType<typeof getPublicClient>,
  chainId: SupportedChainId,
) => {
  const rpcChainId = await publicClient.getChainId();
  if (rpcChainId !== chainId) {
    throw new Error(
      `RPC chain id mismatch: configured signer chain is ${chainId}, but the RPC reports ${rpcChainId}. `
      + "Set EXPO_PUBLIC_DEFAULT_CHAIN_ID/EXPO_PUBLIC_DEFAULT_NETWORK_KEY or the RPC URL so they point at the same network.",
    );
  }
};

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
  await assertRpcChainMatchesSigner(publicClient, chainId);

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
  await assertRpcChainMatchesSigner(publicClient, chainId);
  const entryPoint = getDeployment(chainId)?.entryPoint as Address | undefined;
  if (!entryPoint || entryPoint === '0x0000000000000000000000000000000000000000') {
    throw new Error(`EntryPoint address missing for chain ${chainId}. Deploy and sync mobile contract artifacts first.`);
  }

  const hash = await walletClient.writeContract({
    address: entryPoint,
    abi: entryPointAbi,
    functionName: 'depositTo',
    args: [account],
    value: parseEther(amountEth.toString()),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  return { hash, receipt };
}
