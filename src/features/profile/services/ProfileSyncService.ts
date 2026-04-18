/**
 * Profile Sync Service
 * Syncs user profile (username, avatar) between local store and Supabase
 *
 * Avatar Upload Restrictions:
 * - File Size: Maximum 2MB
 * - File Types: JPEG, PNG, GIF, WebP, HEIC, HEIF, BMP, TIFF, SVG, ICO, PSD, and camera raw formats (CR2, NEF, ARW, DNG, ORF, RW2, PEF, SRW)
 * - Storage: profiles/avatars/ folder with user-specific naming
 * - Security: Files uploaded with user ID prefix for ownership validation
 * - Supabase: Configured to allow all image/* MIME types with 2MB size limit
 */

import { getSupabaseClient } from '@/lib/supabase';
import { useUserStore } from '@store/useUserStore';

export interface ProfileData {
  username: string | null;
  avatar_url: string | null;
}

// File validation constants
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/bmp',
  'image/tiff',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon'
];
const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'svg', 'ico',
  'raw', 'cr2', 'nef', 'arw', 'dng', 'orf', 'rw2', 'pef', 'srw' // Additional camera raw formats
];

export class ProfileSyncService {
  private static supabase = getSupabaseClient();

  /**
   * Validate image file before upload - more adaptive validation
   */
  private static validateImageFile(imageUri: string): { isValid: boolean; error?: string } {
    try {
      // Check file extension - be very flexible
      const fileExt = imageUri.split('.').pop()?.toLowerCase();

      // If no extension, allow it (will validate by MIME type during upload)
      if (!fileExt) {
        console.log(`⚠️ [ProfileSync] No file extension found, allowing for MIME type validation`);
        return { isValid: true };
      }

      // Check if extension is in allowed list, but be more permissive
      const isValidExtension = ALLOWED_EXTENSIONS.includes(fileExt);
      if (!isValidExtension) {
        // For unknown extensions, allow them if they might be image-related
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'tiff', 'svg', 'raw', 'cr2', 'nef', 'arw'];
        if (imageExtensions.includes(fileExt)) {
          console.log(`✅ [ProfileSync] Allowing potentially valid image extension: ${fileExt}`);
          return { isValid: true };
        }

        return {
          isValid: false,
          error: `Unsupported file type ".${fileExt}". Please use: ${ALLOWED_EXTENSIONS.join(', ')}`
        };
      }

      return { isValid: true };
    } catch (error) {
      console.warn(`⚠️ [ProfileSync] Validation error:`, error);
      // Don't fail validation due to parsing errors, let upload proceed
      return { isValid: true };
    }
  }

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
      // Validate image file
      const validation = this.validateImageFile(imageUri);
      if (!validation.isValid) {
        console.error(`❌ [ProfileSync] File validation failed: ${validation.error}`);
        return { success: false, error: validation.error };
      }

      // Convert image URI to ArrayBuffer (works better in React Native)
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error('Failed to load image file');
      }
      const arrayBuffer = await response.arrayBuffer();
      
// Validate file size first (most common issue)
      if (arrayBuffer.byteLength > MAX_FILE_SIZE) {
        const sizeMB = (arrayBuffer.byteLength / (1024 * 1024)).toFixed(1);
        console.error(`❌ [ProfileSync] File too large: ${sizeMB}MB (max: 2MB)`);
        return {
          success: false,
          error: `Image is too large (${sizeMB}MB). Maximum allowed size is 2MB. Please choose a smaller image.`
        };
      }

      // Validate MIME type - be very permissive for images
      const contentType = response.headers.get('content-type');
      if (contentType) {
        // Allow any image/* MIME type
        const isValidImageType = contentType.startsWith('image/');

        if (!isValidImageType) {
          console.error(`❌ [ProfileSync] Invalid content type: ${contentType}`);
          return {
            success: false,
            error: `Invalid file type "${contentType}". Only image files are allowed.`
          };
        }

        // Log successful validation
        console.log(`✅ [ProfileSync] Valid image type: ${contentType}`);
      } else {
        console.log(`⚠️ [ProfileSync] No content-type header, allowing upload`);
      }
      
      // Generate unique filename with proper extension detection
      let fileExt = imageUri.split('.').pop()?.toLowerCase();

      // If no extension or extension not recognized, try to infer from content-type
      if (!fileExt || !ALLOWED_EXTENSIONS.includes(fileExt)) {
        const contentType = response.headers.get('content-type');
        if (contentType) {
          // Map MIME types to extensions - comprehensive mapping
          const mimeToExt: Record<string, string> = {
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/heic': 'heic',
            'image/heif': 'heif',
            'image/bmp': 'bmp',
            'image/tiff': 'tiff',
            'image/svg+xml': 'svg',
            'image/x-icon': 'ico',
            'image/vnd.microsoft.icon': 'ico',
            'image/vnd.adobe.photoshop': 'psd',
            'image/x-photoshop': 'psd'
          };
          fileExt = mimeToExt[contentType] || 'jpg';
          console.log(`📝 [ProfileSync] Inferred extension from MIME type: ${fileExt}`);
        } else {
          fileExt = 'jpg'; // Default fallback
          console.log(`📝 [ProfileSync] Using default extension: jpg`);
        }
      }

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
            contentType: contentType || `image/${fileExt}`,
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
        avatarUrl: undefined,
      });

      console.log(`✅ [ProfileSync] Avatar removed`);
      return true;
    } catch (error) {
      console.error(`❌ [ProfileSync] Failed to remove avatar:`, error);
      return false;
    }
  }
}
