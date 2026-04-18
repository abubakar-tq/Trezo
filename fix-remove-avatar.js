const fs = require("fs");
const content = fs.readFileSync("src/features/profile/services/ProfileSyncService.ts", "utf8");
const target = "  static async removeAvatar(userId: string): Promise<boolean> {";
const split = content.split(target);
const prefix = split[0];
const newContent = prefix + target + `
    console.log("?? [ProfileSync] Removing avatar...");
    try {
      const currentProfile = useUserStore.getState().profile;
      const filePath = "avatars/" + userId;
      const { error: deleteError } = await this.supabase
        .storage
        .from("profiles")
        .remove([filePath]);
      if (deleteError) console.warn("?? [ProfileSync] Failed to delete file:", deleteError);
      
      const { error } = await this.supabase
        .from("profiles")
        .update({ avatar_url: null, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) {
        console.error("? [ProfileSync] Failed to update profile row:", error);
        throw error;
      }
      useUserStore.getState().setProfile({
        ...(currentProfile || {}),
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
fs.writeFileSync("src/features/profile/services/ProfileSyncService.ts", newContent);
console.log("Done");
