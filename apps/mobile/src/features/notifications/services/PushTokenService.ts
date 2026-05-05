import { getSupabaseClient } from "@/src/lib/supabase";
import { Platform } from "react-native";

export type PushTokenPlatform = "ios" | "android";

export type RegisterPushTokenInput = {
  userId: string;
  token: string;
  deviceId?: string | null;
  platform?: PushTokenPlatform;
};

const detectPlatform = (): PushTokenPlatform => (Platform.OS === "ios" ? "ios" : "android");

export const PushTokenService = {
  async upsert({ userId, token, deviceId = null, platform }: RegisterPushTokenInput): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("device_push_tokens")
      .upsert(
        {
          user_id: userId,
          token,
          platform: platform ?? detectPlatform(),
          device_id: deviceId,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,token" },
      );
    if (error) throw error;
  },

  async disable(userId: string, token: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("device_push_tokens")
      .update({ enabled: false })
      .eq("user_id", userId)
      .eq("token", token);
    if (error) throw error;
  },
};
