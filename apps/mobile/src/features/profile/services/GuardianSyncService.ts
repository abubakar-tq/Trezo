/**
 * Guardian Sync Service
 * Syncs guardian configuration between local store and Supabase
 * 
 * Note: Guardians require an aa_wallet_id foreign key, but users may not have
 * deployed their AA wallet yet. This service handles both cases:
 * 1. If AA wallet exists: Store guardians with aa_wallet_id
 * 2. If no AA wallet yet: Keep guardians in local store only, sync when wallet is deployed
 */

import { getSupabaseClient } from '@lib/supabase';
import { useWalletStore } from '@/src/features/wallet/store/useWalletStore';
import { useRecoveryStatusStore } from '@store/useRecoveryStatusStore';

export interface GuardianData {
  address: string;
  weight: number;
}

export interface GuardianConfig {
  threshold: number;
  total_guardians: number;
  guardians: GuardianData[];
}

export class GuardianSyncService {
  private static supabase = getSupabaseClient();
  private static normalizeGuardianAddress(address: string): string {
    return address.trim().toLowerCase();
  }

  /**
   * Check if user has a deployed AA wallet
   */
  static async getAAWalletId(userId: string): Promise<string | null> {
    try {
      const aaAccount = useWalletStore.getState().aaAccount;
      if (aaAccount?.userId === userId && aaAccount.isDeployed && aaAccount.id) {
        return aaAccount.id;
      }

      const { data, error } = await this.supabase
        .from('aa_wallets')
        .select('id')
        .eq('user_id', userId)
        .eq('is_deployed', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No wallet found
        throw error;
      }

      return data?.id || null;
    } catch (error) {
      console.error(`❌ [GuardianSync] Failed to check AA wallet:`, error);
      return null;
    }
  }

  /**
   * Fetch guardians from database and update local store
   */
  static async fetchAndSyncGuardians(aaWalletId: string): Promise<GuardianConfig | null> {
    console.log(`🔄 [GuardianSync] Fetching guardians for AA wallet ${aaWalletId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('guardians')
        .select('guardian_address')
        .eq('aa_wallet_id', aaWalletId)
        .eq('is_active', true);

      if (error) throw error;

      if (!data || data.length === 0) {
        console.log(`📝 [GuardianSync] No guardians found`);
        return null;
      }

      // Extract guardian addresses
      const guardians = data.map(g => ({
        address: g.guardian_address,
        weight: 1,
      }));

      // Threshold is not modeled per-guardian row in Supabase.
      // Keep the locally configured threshold, but clamp to current guardian count.
      const totalGuardians = data.length;
      const localThreshold = useRecoveryStatusStore.getState().requiredSignatures || 1;
      const threshold = Math.max(1, Math.min(localThreshold, totalGuardians));

      // Update local store
      useRecoveryStatusStore.getState().setGuardians(
        guardians.map((g) => ({
          id: g.address,
          address: g.address,
        })),
        threshold,
        totalGuardians
      );

      console.log(`✅ [GuardianSync] Synced ${guardians.length} guardians (${threshold}-of-${totalGuardians})`);
      
      return {
        threshold,
        total_guardians: totalGuardians,
        guardians,
      };
    } catch (error) {
      console.error(`❌ [GuardianSync] Failed to fetch guardians:`, error);
      return null;
    }
  }

  /**
   * Sync local guardians to database
   * Requires deployed AA wallet
   */
  static async syncGuardiansToDatabase(
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`🔄 [GuardianSync] Syncing guardians to database...`);
    
    try {
      // Check if AA wallet exists
      const aaWalletId = await this.getAAWalletId(userId);
      if (!aaWalletId) {
        console.warn(`⚠️  [GuardianSync] No deployed AA wallet found`);
        return {
          success: false,
          error: 'AA_WALLET_NOT_DEPLOYED',
        };
      }

      // Get local guardian config
      const localConfig = useRecoveryStatusStore.getState();
      const { guardians, requiredSignatures: m, totalGuardians: n } = localConfig;

      if (!guardians || guardians.length === 0) {
        console.warn(`⚠️  [GuardianSync] No guardians configured locally`);
        return {
          success: false,
          error: 'NO_GUARDIANS_CONFIGURED',
        };
      }

      const normalizedGuardians = Array.from(
        new Set(guardians.map((guardian) => this.normalizeGuardianAddress(guardian.address)).filter(Boolean)),
      );
      if (normalizedGuardians.length === 0) {
        return {
          success: false,
          error: 'NO_VALID_GUARDIANS_CONFIGURED',
        };
      }

      // Fetch existing guardian rows so we can deactivate only removed guardians.
      const { data: existingRows, error: existingError } = await this.supabase
        .from('guardians')
        .select('guardian_address,is_active')
        .eq('aa_wallet_id', aaWalletId);

      if (existingError) throw existingError;

      const removedAddresses = (existingRows ?? [])
        .filter(
          (row) => !normalizedGuardians.includes(this.normalizeGuardianAddress(row.guardian_address)),
        )
        .map((row) => row.guardian_address);

      const uniqueRemovedAddresses = Array.from(
        new Set(removedAddresses.map((address) => address.trim())),
      );

      if (uniqueRemovedAddresses.length > 0) {
        const { error: deactivateError } = await this.supabase
          .from('guardians')
          .update({ is_active: false, removed_at: new Date().toISOString() })
          .eq('aa_wallet_id', aaWalletId)
          .in('guardian_address', uniqueRemovedAddresses);
        if (deactivateError) throw deactivateError;
      }

      // Upsert desired guardians so existing rows are reactivated instead of violating unique constraints.
      const guardianData = normalizedGuardians.map((guardianAddress) => ({
        aa_wallet_id: aaWalletId,
        guardian_address: guardianAddress,
        is_active: true,
        removed_at: null,
      }));

      const { error: upsertError } = await this.supabase
        .from('guardians')
        .upsert(guardianData, { onConflict: 'aa_wallet_id,guardian_address' });

      if (upsertError) throw upsertError;

      console.log(`✅ [GuardianSync] Synced ${normalizedGuardians.length} guardians (${m}-of-${n}) to database`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ [GuardianSync] Failed to sync guardians:`, error);
      const errorMessage = error instanceof Error ? error.message : 'SYNC_FAILED';
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Add a guardian (local only if no AA wallet, synced if wallet exists)
   */
  static async addGuardian(
    userId: string,
    address: string
  ): Promise<{ success: boolean; synced: boolean }> {
    console.log(`🔄 [GuardianSync] Adding guardian ${address}...`);
    
    try {
      // Add to local store first
      const localConfig = useRecoveryStatusStore.getState();
      const newGuardians = [
        ...(localConfig.guardians || []),
        { id: address, address },
      ];
      useRecoveryStatusStore.getState().setGuardians(
        newGuardians,
        localConfig.requiredSignatures || 1,
        newGuardians.length
      );

      // Try to sync to database if AA wallet exists
      const aaWalletId = await this.getAAWalletId(userId);
      if (aaWalletId) {
        const syncResult = await this.syncGuardiansToDatabase(userId);
        return {
          success: true,
          synced: syncResult.success,
        };
      }

      console.log(`✅ [GuardianSync] Guardian added locally (not synced, no AA wallet)`);
      return {
        success: true,
        synced: false,
      };
    } catch (error) {
      console.error(`❌ [GuardianSync] Failed to add guardian:`, error);
      return {
        success: false,
        synced: false,
      };
    }
  }

  /**
   * Remove a guardian
   */
  static async removeGuardian(
    userId: string,
    address: string
  ): Promise<{ success: boolean; synced: boolean }> {
    console.log(`🔄 [GuardianSync] Removing guardian ${address}...`);
    
    try {
      // Remove from local store first
      const localConfig = useRecoveryStatusStore.getState();
      const newGuardians = (localConfig.guardians || []).filter(
        (guardian) => guardian.address !== address,
      );
      useRecoveryStatusStore.getState().setGuardians(
        newGuardians,
        Math.min(localConfig.requiredSignatures || 1, newGuardians.length),
        newGuardians.length
      );

      // Try to sync to database if AA wallet exists
      const aaWalletId = await this.getAAWalletId(userId);
      if (aaWalletId) {
        const syncResult = await this.syncGuardiansToDatabase(userId);
        return {
          success: true,
          synced: syncResult.success,
        };
      }

      console.log(`✅ [GuardianSync] Guardian removed locally (not synced, no AA wallet)`);
      return {
        success: true,
        synced: false,
      };
    } catch (error) {
      console.error(`❌ [GuardianSync] Failed to remove guardian:`, error);
      return {
        success: false,
        synced: false,
      };
    }
  }

  /**
   * Update threshold (M value)
   */
  static async updateThreshold(
    userId: string,
    newThreshold: number
  ): Promise<{ success: boolean; synced: boolean }> {
    console.log(`🔄 [GuardianSync] Updating threshold to ${newThreshold}...`);
    
    try {
      // Update local store first
      const localConfig = useRecoveryStatusStore.getState();
      useRecoveryStatusStore.getState().setGuardians(
        localConfig.guardians || [],
        newThreshold,
        localConfig.totalGuardians || 0
      );

      // Try to sync to database if AA wallet exists
      const aaWalletId = await this.getAAWalletId(userId);
      if (aaWalletId) {
        const syncResult = await this.syncGuardiansToDatabase(userId);
        return {
          success: true,
          synced: syncResult.success,
        };
      }

      console.log(`✅ [GuardianSync] Threshold updated locally (not synced, no AA wallet)`);
      return {
        success: true,
        synced: false,
      };
    } catch (error) {
      console.error(`❌ [GuardianSync] Failed to update threshold:`, error);
      return {
        success: false,
        synced: false,
      };
    }
  }

  /**
   * Check sync status
   */
  static async getSyncStatus(userId: string): Promise<{
    hasAAWallet: boolean;
    isSynced: boolean;
    localGuardians: number;
    dbGuardians: number;
  }> {
    try {
      const aaWalletId = await this.getAAWalletId(userId);
      const localConfig = useRecoveryStatusStore.getState();
      const localGuardians = localConfig.guardians?.length || 0;

      if (!aaWalletId) {
        return {
          hasAAWallet: false,
          isSynced: false,
          localGuardians,
          dbGuardians: 0,
        };
      }

      const { data } = await this.supabase
        .from('guardians')
        .select('id', { count: 'exact' })
        .eq('aa_wallet_id', aaWalletId)
        .eq('is_active', true);

      const dbGuardians = data?.length || 0;

      return {
        hasAAWallet: true,
        isSynced: localGuardians === dbGuardians && dbGuardians > 0,
        localGuardians,
        dbGuardians,
      };
    } catch (error) {
      console.error(`❌ [GuardianSync] Failed to get sync status:`, error);
      return {
        hasAAWallet: false,
        isSynced: false,
        localGuardians: 0,
        dbGuardians: 0,
      };
    }
  }

  static async getDatabaseGuardianStatus(userId: string): Promise<{
    hasWalletMetadata: boolean;
    walletMarkedDeployed: boolean;
    dbGuardians: number;
    localGuardians: number;
    isSynced: boolean;
  }> {
    try {
      const localConfig = useRecoveryStatusStore.getState();
      const localGuardians = localConfig.guardians?.length || 0;

      const { data: wallet, error: walletError } = await this.supabase
        .from('aa_wallets')
        .select('id, is_deployed')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (walletError) {
        throw walletError;
      }

      if (!wallet) {
        return {
          hasWalletMetadata: false,
          walletMarkedDeployed: false,
          dbGuardians: 0,
          localGuardians,
          isSynced: false,
        };
      }

      const { count, error: guardianError } = await this.supabase
        .from('guardians')
        .select('id', { count: 'exact', head: true })
        .eq('aa_wallet_id', wallet.id)
        .eq('is_active', true);

      if (guardianError) {
        throw guardianError;
      }

      const dbGuardians = count ?? 0;

      return {
        hasWalletMetadata: true,
        walletMarkedDeployed: Boolean(wallet.is_deployed),
        dbGuardians,
        localGuardians,
        isSynced: localGuardians === dbGuardians && dbGuardians > 0,
      };
    } catch (error) {
      console.error(`❌ [GuardianSync] Failed to get guardian database status:`, error);
      return {
        hasWalletMetadata: false,
        walletMarkedDeployed: false,
        dbGuardians: 0,
        localGuardians: 0,
        isSynced: false,
      };
    }
  }
}
