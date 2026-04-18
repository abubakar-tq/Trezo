const fs = require("fs");
const content = fs.readFileSync("src/features/profile/services/ProfileSyncService.ts", "utf8");

let newContent = content.replace(/const fileName = .+/g, "const filePath = `avatars/${userId}`;");
newContent = newContent.replace(/const filePath = `avatars\/\${fileName}`;\s+/g, "");

// Add cache busting and use proper filePath
newContent = newContent.replace(/const {\s*data:\s*{\s*publicUrl\s*}\s*}\s*=\s*this\.supabase\.storage\s*\.from\('profiles'\)\s*\.getPublicUrl\(filePath\);/g, `const { data: { publicUrl: rawPublicUrl } } = this.supabase.storage.from("profiles").getPublicUrl(filePath);
      const publicUrl = rawPublicUrl + "?t=" + Date.now();`);

newContent = newContent.replace(/avatar_url: publicUrl,/g, "avatar_url: publicUrl,");

// Now rewrite removeAvatar entirely
const removeTarget = "  static async removeAvatar(userId: string): Promise<boolean> {";
const split = newContent.split(removeTarget);
const prefix = split[0];
const targetContent = removeTarget + `
    console.log("?? [ProfileSync] Removing avatar...");
    try {
      const currentProfile = Object.assign({}, useUserStore.getState().profile);
      const filePath = "avatars/" + userId;
      
      const { error: deleteError } = await this.supabase
        .storage
        .from("profiles")
        .remove([filePath]);
        
      if (deleteError) {
        console.warn("?? [ProfileSync] Failed to delete file from storage:", deleteError);
      }

      const { error } = await this.supabase
        .from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) {
        console.error("? [ProfileSync] Failed to update profile row:", error);
        throw error;
      }

      useUserStore.getState().setProfile({
        ...currentProfile,
        username: currentProfile.username ?? null,
        avatarUrl: null,
      });

      console.log("? [ProfileSync] Avatar removed");
      return true;
    } catch (error) {
      console.error("? [ProfileSync] Error removing avatar:", error);
      return false;
    }
  }
}`;

fs.writeFileSync("src/features/profile/services/ProfileSyncService.ts", prefix + targetContent);
console.log("Done");
