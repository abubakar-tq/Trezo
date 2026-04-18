/**
 * Guardian Sync Service
 * Syncs guardian configuration between local store and Supabase
 * 
 * Note: Guardians require an aa_wallet_id foreign key, but users may not have
 * deployed their AA wallet yet. This service handles both cases:
 * 1. If AA wallet exists: Store guardians with aa_wallet_id
 * 2. If no AA wallet yet: Keep guardians in local store only, sync when wallet is deployed
 */

import { getSupabaseClient } from '@/lib/supabase';
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
        .select('*')
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
        weight: g.weight,
      }));

      // Get threshold from first guardian (all should have same threshold)
      const threshold = data[0]?.threshold || 1;
      const totalGuardians = data.length;

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

      // Deactivate existing guardians
      const { error: deactivateError } = await this.supabase
        .from('guardians')
        .update({ is_active: false })
        .eq('aa_wallet_id', aaWalletId);

      if (deactivateError) throw deactivateError;

      // Insert new guardians
      const guardianData = guardians.map((guardian) => ({
        aa_wallet_id: aaWalletId,
        guardian_address: guardian.address,
        weight: 1, // Equal weight for all guardians
        threshold: m,
        is_active: true,
      }));

      const { error: insertError } = await this.supabase
        .from('guardians')
        .insert(guardianData);

      if (insertError) throw insertError;

      console.log(`✅ [GuardianSync] Synced ${guardians.length} guardians (${m}-of-${n}) to database`);
      
      return { success: true };
    } catch (error) {
      console.error(`❌ [GuardianSync] Failed to sync guardians:`, error);
      return {
        success: false,
        error: 'SYNC_FAILED',
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
}
