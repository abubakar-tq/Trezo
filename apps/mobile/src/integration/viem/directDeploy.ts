import { type Hex, type Address } from 'viem';
import type { PasskeyInit } from './types';
import { getDeployment } from './deployments';
import { predictAccountAddress } from './account';
import { getPublicClient, getWalletClientFromPrivateKey } from './clients';
import AccountFactoryABI from '../abi/AccountFactory.json';

/**
 * Direct deployment using an EOA (Anvil default account) to call AccountFactory.createAccount
 * This bypasses the UserOperation flow for testing purposes
 */

// Anvil default private key (account #0)
const ANVIL_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;

export interface DirectDeployParams {
  chainId: number;
  salt: Hex;
  passkeyInit: PasskeyInit;
  validator: Address;
}

/**
 * Deploy a smart account directly using an EOA
 */
export async function directDeployAccount(params: DirectDeployParams) {
  console.log('[directDeploy] Starting direct deployment...');
  
  const deployment = getDeployment(params.chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${params.chainId}`);

  // Use existing client utilities
  const publicClient = getPublicClient(params.chainId);
  const walletClient = getWalletClientFromPrivateKey(ANVIL_PRIVATE_KEY, params.chainId);

  console.log('[directDeploy] Using EOA:', walletClient.account.address);
  console.log('[directDeploy] AccountFactory:', deployment.accountFactory);

  // Prepare passkey init as a tuple (struct in Solidity)
  const passkeyInitTuple = [
    params.passkeyInit.idRaw as Hex,
    BigInt(params.passkeyInit.px),
    BigInt(params.passkeyInit.py),
  ];

  console.log('[directDeploy] Passkey init tuple:', passkeyInitTuple);

  try {
    // Call createAccount on the factory with PasskeyInit as a tuple
    const hash = await walletClient.writeContract({
      address: deployment.accountFactory as Address,
      abi: AccountFactoryABI.abi,
      functionName: 'createAccount',
      args: [params.salt, params.validator, passkeyInitTuple],
    });

    console.log('[directDeploy] Transaction hash:', hash);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log('[directDeploy] Transaction confirmed in block:', receipt.blockNumber);
    console.log('[directDeploy] Gas used:', receipt.gasUsed.toString());

    // Get the deployed account address from logs
    let accountAddress: Address | null = null;
    
    // The AccountCreated event should contain the account address
    if (receipt.logs && receipt.logs.length > 0) {
      // First log topic is the event signature, second is typically the indexed account address
      const accountCreatedLog = receipt.logs.find(log => log.topics.length >= 2);
      if (accountCreatedLog && accountCreatedLog.topics[1]) {
        // Remove leading zeros from the topic (address is 20 bytes, topic is 32 bytes)
        accountAddress = ('0x' + accountCreatedLog.topics[1].slice(26)) as Address;
      }
    }

    // If we didn't find it in logs, compute it deterministically
    if (!accountAddress) {
      accountAddress = await predictAccountAddress(params.chainId, params.salt);
      console.log('[directDeploy] Account address (computed):', accountAddress);
    } else {
      console.log('[directDeploy] Account address (from logs):', accountAddress);
    }

    // Verify the account was deployed
    const code = await publicClient.getBytecode({ address: accountAddress });
    if (!code || code === '0x') {
      throw new Error('Account deployment failed - no code at address');
    }

    console.log('[directDeploy] ✅ Account deployed successfully!');
    console.log('[directDeploy] Account address:', accountAddress);
    console.log('[directDeploy] Code length:', code.length);

    return {
      success: true,
      accountAddress,
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  } catch (error) {
    console.error('[directDeploy] Deployment failed:', error);
    throw error;
  }
}

/**
 * Check if an account is already deployed
 */
export async function isAccountDeployed(chainId: number, accountAddress: Address): Promise<boolean> {
  const publicClient = getPublicClient(chainId);

  const code = await publicClient.getBytecode({ address: accountAddress });
  return code !== undefined && code !== '0x';
}
