import { getSupabaseClient } from "@/src/lib/supabase";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@features/notifications/types/notification";

type Row = {
  user_id: string;
  push_enabled: boolean;
  tx_alerts: boolean;
  swap_alerts: boolean;
  security_alerts: boolean;
  marketing: boolean;
  updated_at: string;
};

const toRecord = (row: Row): NotificationPreferences => ({
  pushEnabled: row.push_enabled,
  txAlerts: row.tx_alerts,
  swapAlerts: row.swap_alerts,
  securityAlerts: row.security_alerts,
  marketing: row.marketing,
  updatedAt: row.updated_at,
});

export const NotificationPreferencesService = {
  async get(userId: string): Promise<NotificationPreferences> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    return toRecord(data as Row);
  },

  async upsert(userId: string, prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const supabase = getSupabaseClient();
    const payload: Partial<Row> & { user_id: string } = { user_id: userId };
    if (prefs.pushEnabled !== undefined) payload.push_enabled = prefs.pushEnabled;
    if (prefs.txAlerts !== undefined) payload.tx_alerts = prefs.txAlerts;
    if (prefs.swapAlerts !== undefined) payload.swap_alerts = prefs.swapAlerts;
    if (prefs.securityAlerts !== undefined) payload.security_alerts = prefs.securityAlerts;
    if (prefs.marketing !== undefined) payload.marketing = prefs.marketing;

    const { data, error } = await supabase
      .from("notification_preferences")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw error;
    return toRecord(data as Row);
  },
};
