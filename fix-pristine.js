const fs = require("fs");
let content = fs.readFileSync("pristine.ts", "utf8");

// Fix 1: filename to be deterministic
content = content.replace(/const fileName = `\$\{userId\}-\$\{Date\.now\(\)\}\.\$\{fileExt\}`;/, `const filePath = \`avatars/\${userId}\`;`);
content = content.replace(/const filePath = `avatars\/\$\{fileName\}`;/, ``);

// Fix 2: publicUrl with timestamp
content = content.replace(/const \{ data: \{ publicUrl \} \} = this\.supabase\.storage\s*\n\s*\.from\('profiles'\)\s*\n\s*\.getPublicUrl\(filePath\);/, `const { data: { publicUrl: rawPublicUrl } } = this.supabase.storage
        .from("profiles")
        .getPublicUrl(filePath);

      const publicUrl = rawPublicUrl + "?t=" + Date.now();`);

// Fix 3: replace removeAvatar fully
const removeTarget = "  static async removeAvatar(userId: string): Promise<boolean> {";
const split = content.split(removeTarget);
const prefix = split[0];
const targetContent = removeTarget + `
    console.log("?? [ProfileSync] Removing avatar...");
    try {
      const currentProfile = useUserStore.getState().profile;
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
        ...(currentProfile ?? {}),
        avatarUrl: null,
      });

      console.log("? [ProfileSync] Avatar removed");
      return true;
    } catch (error) {
      console.error("? [ProfileSync] Error removing avatar:", error);
      return false;
    }
  }
}
`;

fs.writeFileSync("src/features/profile/services/ProfileSyncService.ts", prefix + targetContent);
console.log("Pristine fixed!");
