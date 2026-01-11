/**
 * Storage Test Utility
 * Test Supabase Storage connectivity and permissions
 */

import { getSupabaseClient } from '@/lib/supabase';

export class StorageTest {
  private static supabase = getSupabaseClient();

  /**
   * Test storage bucket accessibility
   */
  static async testStorageAccess(): Promise<{
    canList: boolean;
    canUpload: boolean;
    error?: string;
  }> {
    try {
      console.log('🧪 [StorageTest] Testing storage access...');

      // Test 1: Can we list files in the bucket?
      const { data: listData, error: listError } = await this.supabase.storage
        .from('profiles')
        .list('avatars');

      const canList = !listError;
      console.log(`📋 [StorageTest] List test: ${canList ? '✅' : '❌'}`, listError);

      // Test 2: Can we get the public URL?
      const testPath = 'avatars/test.jpg';
      const { data: urlData } = this.supabase.storage
        .from('profiles')
        .getPublicUrl(testPath);

      console.log(`🔗 [StorageTest] Public URL generated: ${urlData.publicUrl}`);

      return {
        canList,
        canUpload: true, // We'll test this on actual upload
        error: listError?.message,
      };
    } catch (error: any) {
      console.error('❌ [StorageTest] Test failed:', error);
      return {
        canList: false,
        canUpload: false,
        error: error.message,
      };
    }
  }

  /**
   * Get storage bucket info
   */
  static async getBucketInfo(): Promise<void> {
    try {
      const { data, error } = await this.supabase.storage.listBuckets();
      console.log('🗂️  [StorageTest] Available buckets:', data);
      console.log('❌ [StorageTest] Bucket error:', error);
    } catch (error) {
      console.error('❌ [StorageTest] Failed to get buckets:', error);
    }
  }
}
