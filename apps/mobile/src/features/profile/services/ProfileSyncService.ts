/**
 * Profile Sync Service
 * Syncs user profile (username, avatar) between local store and Supabase
 */

import { getSupabaseClient } from '@/lib/supabase';
import { useUserStore } from '@store/useUserStore';

export interface ProfileData {
  username: string | null;
  avatar_url: string | null;
}

export class ProfileSyncService {
  private static supabase = getSupabaseClient();

  /**
   * Fetch profile from database and update local store
   */
  static async fetchAndSyncProfile(userId: string): Promise<ProfileData | null> {
    console.log(`🔄 [ProfileSync] Fetching profile for user ${userId}`);
    
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No profile exists yet, create one
          console.log(`📝 [ProfileSync] No profile found, creating...`);
          return await this.createProfile(userId);
        }
        throw error;
      }

      // Update local store
      useUserStore.getState().setProfile({
        username: data.username,
        avatarUrl: data.avatar_url,
      });

      console.log(`✅ [ProfileSync] Profile synced from database`);
      return data;
    } catch (error) {
      console.error(`❌ [ProfileSync] Failed to fetch profile:`, error);
      return null;
    }
  }

  /**
   * Create initial profile in database
   */
  static async createProfile(userId: string): Promise<ProfileData | null> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .insert({
          id: userId,
          username: null,
          avatar_url: null,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ [ProfileSync] Profile created`);
      return data;
    } catch (error) {
      console.error(`❌ [ProfileSync] Failed to create profile:`, error);
      return null;
    }
  }

  /**
   * Update username in database and local store
   */
  static async updateUsername(userId: string, username: string): Promise<{ success: boolean; error?: string }> {
    console.log(`🔄 [ProfileSync] Updating username to "${username}"`);
    
    try {
      const { error } = await this.supabase
        .from('profiles')
        .upsert({
          id: userId,
          username: username.trim(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (error) {
        // Handle specific error codes
        if (error.code === '23505') {
          console.error(`❌ [ProfileSync] Username already taken`);
          return { success: false, error: 'Username already taken. Please choose a different one.' };
        }
        throw error;
      }

      // Update local store
      const currentProfile = useUserStore.getState().profile;
      useUserStore.getState().setProfile({
        ...currentProfile,
        username: username.trim(),
      });

      console.log(`✅ [ProfileSync] Username updated successfully`);
      return { success: true };
    } catch (error: any) {
      console.error(`❌ [ProfileSync] Failed to update username:`, error);
      return { success: false, error: error.message || 'Failed to update username' };
    }
  }

  /**
   * Upload avatar to Supabase Storage and update profile
   */
  static async updateAvatar(
    userId: string, 
    imageUri: string
  ): Promise<{ success: boolean; url?: string; error?: string }> {
    console.log(`🔄 [ProfileSync] Uploading avatar...`);
    
    try {
      // Convert image URI to ArrayBuffer (works better in React Native)
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error('Failed to load image file');
      }
      const arrayBuffer = await response.arrayBuffer();
      
      // Generate unique filename
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      console.log(`📤 [ProfileSync] Uploading to: ${filePath}`);
      console.log(`📊 [ProfileSync] File size: ${arrayBuffer.byteLength} bytes`);

      // Upload to storage with retry logic
      let uploadData, uploadError;
      let retryCount = 0;
      const maxRetries = 2;

      while (retryCount <= maxRetries) {
        const result = await this.supabase.storage
          .from('profiles')
          .upload(filePath, arrayBuffer, {
            cacheControl: '3600',
            upsert: true,
            contentType: `image/${fileExt}`,
          });
        
        uploadData = result.data;
        uploadError = result.error;
        
        if (!uploadError) break;
        
        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`⚠️  [ProfileSync] Upload failed, retrying (${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }

      if (uploadError) {
        console.error(`❌ [ProfileSync] Storage upload error:`, uploadError);
        
        // Provide specific error messages
        let errorMessage = 'Failed to upload image to storage';
        if (uploadError.message?.includes('Network request failed')) {
          errorMessage = 'Network error. Please check:\n' +
            '• Your internet connection\n' +
            '• Supabase storage bucket exists\n' +
            '• Storage policies are configured';
        } else if (uploadError.message?.includes('permission') || uploadError.message?.includes('policy')) {
          errorMessage = 'Permission denied. Storage bucket policies may not be configured correctly.';
        }
        
        throw new Error(errorMessage);
      }

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      console.log(`✅ [ProfileSync] File uploaded, URL: ${publicUrl}`);

      // Update profile with avatar URL
      const { error: updateError } = await this.supabase
        .from('profiles')
        .upsert({
          id: userId,
          avatar_url: publicUrl,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (updateError) {
        console.error(`❌ [ProfileSync] Profile update error:`, updateError);
        throw new Error('Failed to update profile with new avatar');
      }

      // Update local store
      const currentProfile = useUserStore.getState().profile;
      useUserStore.getState().setProfile({
        ...currentProfile,
        avatarUrl: publicUrl,
      });

      console.log(`✅ [ProfileSync] Avatar uploaded: ${publicUrl}`);
      return { success: true, url: publicUrl };
    } catch (error: any) {
      console.error(`❌ [ProfileSync] Failed to upload avatar:`, error);
      return { 
        success: false, 
        error: error.message || 'Failed to upload avatar. Please check your connection.' 
      };
    }
  }

  /**
   * Remove avatar from storage and profile
   */
  static async removeAvatar(userId: string): Promise<boolean> {
    console.log(`🔄 [ProfileSync] Removing avatar...`);
    
    try {
      const currentProfile = useUserStore.getState().profile;
      const avatarUrl = currentProfile?.avatarUrl;

      if (avatarUrl) {
        // Extract file path from URL
        const urlParts = avatarUrl.split('/');
        const bucketIndex = urlParts.findIndex(part => part === 'profiles');
        if (bucketIndex !== -1 && bucketIndex < urlParts.length - 1) {
          const filePath = urlParts.slice(bucketIndex + 1).join('/');
          
          // Delete from storage
          const { error: deleteError } = await this.supabase.storage
            .from('profiles')
            .remove([filePath]);

          if (deleteError) {
            console.warn(`⚠️  [ProfileSync] Failed to delete file from storage:`, deleteError);
          }
        }
      }

      // Update profile to remove avatar_url
      const { error } = await this.supabase
        .from('profiles')
        .upsert({
          id: userId,
          avatar_url: null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

      if (error) throw error;

      // Update local store
      useUserStore.getState().setProfile({
        ...currentProfile,
        avatarUrl: null,
      });

      console.log(`✅ [ProfileSync] Avatar removed`);
      return true;
    } catch (error) {
      console.error(`❌ [ProfileSync] Failed to remove avatar:`, error);
      return false;
    }
  }
}
