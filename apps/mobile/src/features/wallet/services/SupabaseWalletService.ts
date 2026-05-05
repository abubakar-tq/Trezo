/**
 * Supabase Wallet Service
 * 
 * Handles database operations for AA wallets:
 * - Wallet CRUD operations
 * - Passkey management
 * - Guardian management
 * - Transaction history
 */

import { getSupabaseClient } from '@lib/supabase';

const supabase = getSupabaseClient();

// Types matching database schema
export interface AAWallet {
  id: string;
  user_id: string;
  network_key?: string;
  wallet_identity?: string | null;
  wallet_index: number;
  deployment_mode: 'portable' | 'chain-specific';
  predicted_address: string;
  owner_address: string;
  is_deployed: boolean;
  deployment_tx_hash?: string | null;
  deployment_block_number?: number | null;
  wallet_name: string;
  chain_id: number;
  created_at: string;
  deployed_at?: string | null;
  updated_at: string;
}

const inferWalletNetworkKey = (chainId: number, networkKey?: string): string => {
  if (networkKey) return networkKey;
  switch (chainId) {
    case 31337:
      return 'anvil-local';
    case 11155111:
      return 'ethereum-sepolia';
    case 8453:
      return 'base-mainnet-fork';
    default:
      return `chain-${chainId}`;
  }
};

const formatServiceError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'Unknown error';
};

export interface Passkey {
  id: string;
  user_id: string;
  aa_wallet_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  device_name: string;
  device_type: string;
  last_used_at?: string;
  created_at: string;
}

export interface Guardian {
  id: string;
  aa_wallet_id: string;
  guardian_address: string;
  guardian_name: string;
  guardian_email?: string;
  is_active: boolean;
  is_confirmed: boolean;
  confirmation_token?: string;
  added_at: string;
  confirmed_at?: string;
}

export interface AATransaction {
  id: string;
  aa_wallet_id: string;
  user_op_hash: string;
  tx_hash?: string;
  sender: string;
  target: string;
  value: string;
  calldata?: string;
  gas_limit?: string;
  gas_used?: string;
  paymaster_address?: string;
  paymaster_data?: string;
  status: 'pending' | 'confirmed' | 'failed';
  block_number?: number;
  created_at: string;
  confirmed_at?: string;
  metadata?: Record<string, any>;
}

export class SupabaseWalletService {
  /**
   * Save AA wallet to database
   */
  async saveAAWallet(data: {
    userId: string;
    predictedAddress: string;
    ownerAddress: string;
    walletName: string;
    chainId: number;
    walletId?: string;
    walletIndex?: number;
    deploymentMode?: 'portable' | 'chain-specific';
    networkKey?: string;
    isDeployed?: boolean;
    deploymentTxHash?: string | null;
    deploymentBlockNumber?: number | null;
    deployedAt?: string | null;
  }): Promise<AAWallet> {
    console.log(`💾 [SupabaseWalletService] Saving AA wallet for user ${data.userId}`);
    
    try {
      const now = new Date().toISOString();
      const payload: Record<string, unknown> = {
        user_id: data.userId,
        wallet_identity: data.walletId,
        wallet_index: data.walletIndex ?? 0,
        deployment_mode: data.deploymentMode ?? 'chain-specific',
        predicted_address: data.predictedAddress.toLowerCase(),
        owner_address: data.ownerAddress.toLowerCase(),
        wallet_name: data.walletName,
        chain_id: data.chainId,
        network_key: inferWalletNetworkKey(data.chainId, data.networkKey),
        updated_at: now,
      };

      if ('isDeployed' in data) {
        payload.is_deployed = Boolean(data.isDeployed);
        payload.deployed_at = data.isDeployed ? data.deployedAt ?? now : null;
        if (!data.isDeployed) {
          payload.deployment_tx_hash = null;
          payload.deployment_block_number = null;
        }
      }
      if ('deploymentTxHash' in data) {
        payload.deployment_tx_hash = data.deploymentTxHash ?? null;
      }
      if ('deploymentBlockNumber' in data) {
        payload.deployment_block_number = data.deploymentBlockNumber ?? null;
      }

      let { data: wallet, error } = await supabase
        .from('aa_wallets')
        .upsert(payload, { onConflict: 'user_id,network_key' })
        .select()
        .single();

      if (
        error?.code === '42P10'
        || error?.code === 'PGRST204'
        || String(error?.message ?? '').includes("network_key")
      ) {
        const legacyPayload = { ...payload };
        delete legacyPayload.network_key;
        const legacyResult = await supabase
          .from('aa_wallets')
          .upsert(legacyPayload, { onConflict: 'user_id,chain_id' })
          .select()
          .single();
        wallet = legacyResult.data;
        error = legacyResult.error;
      }
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Wallet saved: ${wallet.id}`);
      
      return wallet;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error saving wallet:', error);
      throw new Error(`Failed to save wallet: ${formatServiceError(error)}`);
    }
  }
  
  /**
   * Get AA wallet for user
   */
  async getAAWallet(userId: string): Promise<AAWallet | null> {
    console.log(`🔍 [SupabaseWalletService] Getting AA wallet for user ${userId}`);
    
    try {
      const { data, error } = await supabase
        .from('aa_wallets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          console.log(`ℹ️  [SupabaseWalletService] No wallet found for user`);
          return null;
        }
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Wallet found: ${data.predicted_address}`);
      
      return data;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error getting wallet:', error);
      throw new Error(`Failed to get wallet: ${formatServiceError(error)}`);
    }
  }

  async getAAWalletForChain(
    userId: string,
    chainId: number,
    networkKey?: string,
  ): Promise<AAWallet | null> {
    console.log(`🔍 [SupabaseWalletService] Getting AA wallet for user ${userId} on chain ${chainId}`);

    try {
      const resolvedNetworkKey = inferWalletNetworkKey(chainId, networkKey);
      const networkResult = await supabase
        .from('aa_wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('network_key', resolvedNetworkKey)
        .maybeSingle();

      if (!networkResult.error && networkResult.data) {
        return networkResult.data as AAWallet;
      }

      const { data, error } = await supabase
        .from('aa_wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('chain_id', chainId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as AAWallet | null;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error getting wallet by chain:', error);
      throw new Error(`Failed to get wallet by chain: ${formatServiceError(error)}`);
    }
  }

  async getAAWalletForNetwork(
    userId: string,
    networkKey: string,
  ): Promise<AAWallet | null> {
    console.log(`🔍 [SupabaseWalletService] Getting AA wallet for user ${userId} on network ${networkKey}`);

    try {
      const { data, error } = await supabase
        .from('aa_wallets')
        .select('*')
        .eq('user_id', userId)
        .eq('network_key', networkKey)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as AAWallet | null;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error getting wallet by network:', error);
      throw new Error(`Failed to get wallet by network: ${formatServiceError(error)}`);
    }
  }
  
  /**
   * Update deployment status
   */
  async updateDeploymentStatus(
    walletId: string,
    txHash: string,
    blockNumber: number
  ): Promise<void> {
    await this.setDeploymentState(walletId, {
      isDeployed: true,
      deploymentTxHash: txHash,
      deploymentBlockNumber: blockNumber,
    });
  }

  async setDeploymentState(
    walletId: string,
    params: {
      isDeployed: boolean;
      deploymentTxHash?: string | null;
      deploymentBlockNumber?: number | null;
      deployedAt?: string | null;
    },
  ): Promise<void> {
    console.log(`📝 [SupabaseWalletService] Updating deployment status for wallet ${walletId}`);

    try {
      const payload: Record<string, unknown> = {
        is_deployed: params.isDeployed,
        deployed_at: params.isDeployed
          ? params.deployedAt ?? new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      };

      if (params.isDeployed) {
        if ('deploymentTxHash' in params) {
          payload.deployment_tx_hash = params.deploymentTxHash ?? null;
        }
        if ('deploymentBlockNumber' in params) {
          payload.deployment_block_number = params.deploymentBlockNumber ?? null;
        }
      } else {
        payload.deployment_tx_hash = null;
        payload.deployment_block_number = null;
      }

      const { error } = await supabase
        .from('aa_wallets')
        .update(payload)
        .eq('id', walletId);

      if (error) {
        throw error;
      }

      console.log(`✅ [SupabaseWalletService] Deployment status updated`);
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error updating deployment:', error);
      throw new Error(`Failed to update deployment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Save passkey
   */
  async savePasskey(data: {
    userId: string;
    aaWalletId: string;
    credentialId: string;
    publicKey: string;
    deviceName: string;
    deviceType: string;
  }): Promise<Passkey> {
    console.log(`💾 [SupabaseWalletService] Saving passkey for wallet ${data.aaWalletId}`);
    
    try {
      const { data: passkey, error } = await supabase
        .from('passkeys')
        .insert({
          user_id: data.userId,
          aa_wallet_id: data.aaWalletId,
          credential_id: data.credentialId,
          public_key: data.publicKey,
          counter: 0,
          device_name: data.deviceName,
          device_type: data.deviceType,
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Passkey saved: ${passkey.id}`);
      
      return passkey;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error saving passkey:', error);
      throw new Error(`Failed to save passkey: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get passkeys for user
   */
  async getPasskeys(userId: string): Promise<Passkey[]> {
    console.log(`🔍 [SupabaseWalletService] Getting passkeys for user ${userId}`);
    
    try {
      const { data, error } = await supabase
        .from('passkeys')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Found ${data.length} passkeys`);
      
      return data;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error getting passkeys:', error);
      throw new Error(`Failed to get passkeys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update passkey counter (WebAuthn replay protection)
   */
  async updatePasskeyCounter(credentialId: string, newCounter: number): Promise<void> {
    console.log(`📝 [SupabaseWalletService] Updating passkey counter: ${newCounter}`);
    
    try {
      const { error } = await supabase
        .from('passkeys')
        .update({
          counter: newCounter,
          last_used_at: new Date().toISOString(),
        })
        .eq('credential_id', credentialId);
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Passkey counter updated`);
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error updating counter:', error);
      throw new Error(`Failed to update counter: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Delete passkey
   */
  async deletePasskey(passkeyId: string): Promise<void> {
    console.log(`🗑️  [SupabaseWalletService] Deleting passkey ${passkeyId}`);
    
    try {
      const { error } = await supabase
        .from('passkeys')
        .delete()
        .eq('id', passkeyId);
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Passkey deleted`);
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error deleting passkey:', error);
      throw new Error(`Failed to delete passkey: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Add guardian
   */
  async addGuardian(data: {
    aaWalletId: string;
    guardianAddress: string;
    guardianName: string;
    guardianEmail?: string;
  }): Promise<Guardian> {
    console.log(`💾 [SupabaseWalletService] Adding guardian: ${data.guardianName}`);
    
    try {
      const { data: guardian, error } = await supabase
        .from('guardians')
        .insert({
          aa_wallet_id: data.aaWalletId,
          guardian_address: data.guardianAddress.toLowerCase(),
          guardian_name: data.guardianName,
          guardian_email: data.guardianEmail,
          is_active: true,
          is_confirmed: false,
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Guardian added: ${guardian.id}`);
      
      return guardian;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error adding guardian:', error);
      throw new Error(`Failed to add guardian: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get guardians for wallet
   */
  async getGuardians(aaWalletId: string): Promise<Guardian[]> {
    console.log(`🔍 [SupabaseWalletService] Getting guardians for wallet ${aaWalletId}`);
    
    try {
      const { data, error } = await supabase
        .from('guardians')
        .select('*')
        .eq('aa_wallet_id', aaWalletId)
        .eq('is_active', true)
        .order('added_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Found ${data.length} guardians`);
      
      return data;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error getting guardians:', error);
      throw new Error(`Failed to get guardians: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Remove guardian (mark as inactive)
   */
  async removeGuardian(guardianId: string): Promise<void> {
    console.log(`🗑️  [SupabaseWalletService] Removing guardian ${guardianId}`);
    
    try {
      const { error } = await supabase
        .from('guardians')
        .update({ is_active: false })
        .eq('id', guardianId);
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Guardian removed`);
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error removing guardian:', error);
      throw new Error(`Failed to remove guardian: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Confirm guardian
   */
  async confirmGuardian(guardianId: string): Promise<void> {
    console.log(`✅ [SupabaseWalletService] Confirming guardian ${guardianId}`);
    
    try {
      const { error } = await supabase
        .from('guardians')
        .update({
          is_confirmed: true,
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', guardianId);
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Guardian confirmed`);
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error confirming guardian:', error);
      throw new Error(`Failed to confirm guardian: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Save transaction
   */
  async saveTransaction(data: {
    aaWalletId: string;
    userOpHash: string;
    txHash?: string;
    sender: string;
    target: string;
    value: string;
    calldata?: string;
    gasLimit?: string;
    gasUsed?: string;
    paymasterAddress?: string;
    paymasterData?: string;
    status: 'pending' | 'confirmed' | 'failed';
    blockNumber?: number;
    metadata?: Record<string, any>;
  }): Promise<AATransaction> {
    console.log(`💾 [SupabaseWalletService] Saving transaction ${data.userOpHash}`);
    
    try {
      const { data: transaction, error } = await supabase
        .from('aa_transactions')
        .insert({
          aa_wallet_id: data.aaWalletId,
          user_op_hash: data.userOpHash,
          tx_hash: data.txHash,
          sender: data.sender.toLowerCase(),
          target: data.target.toLowerCase(),
          value: data.value,
          calldata: data.calldata,
          gas_limit: data.gasLimit,
          gas_used: data.gasUsed,
          paymaster_address: data.paymasterAddress?.toLowerCase(),
          paymaster_data: data.paymasterData,
          status: data.status,
          block_number: data.blockNumber,
          confirmed_at: data.status === 'confirmed' ? new Date().toISOString() : undefined,
          metadata: data.metadata,
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Transaction saved: ${transaction.id}`);
      
      return transaction;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error saving transaction:', error);
      throw new Error(`Failed to save transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    userOpHash: string,
    status: 'confirmed' | 'failed',
    txHash?: string,
    blockNumber?: number,
    gasUsed?: string
  ): Promise<void> {
    console.log(`📝 [SupabaseWalletService] Updating transaction status: ${status}`);
    
    try {
      const { error } = await supabase
        .from('aa_transactions')
        .update({
          status,
          tx_hash: txHash,
          block_number: blockNumber,
          gas_used: gasUsed,
          confirmed_at: status === 'confirmed' ? new Date().toISOString() : undefined,
        })
        .eq('user_op_hash', userOpHash);
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Transaction status updated`);
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error updating transaction:', error);
      throw new Error(`Failed to update transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get transactions for wallet
   */
  async getTransactions(aaWalletId: string, limit: number = 50): Promise<AATransaction[]> {
    console.log(`🔍 [SupabaseWalletService] Getting transactions for wallet ${aaWalletId}`);
    
    try {
      const { data, error } = await supabase
        .from('aa_transactions')
        .select('*')
        .eq('aa_wallet_id', aaWalletId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Found ${data.length} transactions`);
      
      return data;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error getting transactions:', error);
      throw new Error(`Failed to get transactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Get transaction by user op hash
   */
  async getTransactionByUserOpHash(userOpHash: string): Promise<AATransaction | null> {
    console.log(`🔍 [SupabaseWalletService] Getting transaction ${userOpHash}`);
    
    try {
      const { data, error } = await supabase
        .from('aa_transactions')
        .select('*')
        .eq('user_op_hash', userOpHash)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`ℹ️  [SupabaseWalletService] Transaction not found`);
          return null;
        }
        throw error;
      }
      
      console.log(`✅ [SupabaseWalletService] Transaction found`);
      
      return data;
    } catch (error) {
      console.error('❌ [SupabaseWalletService] Error getting transaction:', error);
      throw new Error(`Failed to get transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Singleton instance
let supabaseWalletService: SupabaseWalletService | null = null;

export function getSupabaseWalletService(): SupabaseWalletService {
  if (!supabaseWalletService) {
    supabaseWalletService = new SupabaseWalletService();
  }
  return supabaseWalletService;
}

export default SupabaseWalletService;
