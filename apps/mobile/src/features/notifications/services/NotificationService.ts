import { getSupabaseClient } from "@/src/lib/supabase";
import type {
  AppNotification,
  NotificationCategory,
  NotificationPayload,
  NotificationStatus,
} from "@features/notifications/types/notification";
import type { RealtimeChannel } from "@supabase/supabase-js";

type NotificationRow = {
  id: string;
  user_id: string;
  aa_wallet_id: string | null;
  category: NotificationCategory;
  status: NotificationStatus;
  title: string;
  body: string;
  icon: string | null;
  accent: string | null;
  related_tx_id: string | null;
  payload: NotificationPayload | null;
  created_at: string;
  updated_at: string;
  read_at: string | null;
};

const toRecord = (row: NotificationRow): AppNotification => ({
  id: row.id,
  userId: row.user_id,
  aaWalletId: row.aa_wallet_id,
  category: row.category,
  status: row.status,
  title: row.title,
  body: row.body,
  icon: row.icon,
  accent: row.accent,
  relatedTxId: row.related_tx_id,
  payload: (row.payload ?? {}) as NotificationPayload,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  readAt: row.read_at,
});

export type NotificationListOptions = {
  limit?: number;
  before?: string;
};

export const NotificationService = {
  async list(userId: string, options: NotificationListOptions = {}): Promise<AppNotification[]> {
    const supabase = getSupabaseClient();
    const limit = options.limit ?? 50;
    let query = supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (options.before) {
      query = query.lt("created_at", options.before);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row) => toRecord(row as NotificationRow));
  },

  async unreadCount(userId: string): Promise<number> {
    const supabase = getSupabaseClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "unread");
    if (error) throw error;
    return count ?? 0;
  },

  async markRead(notificationId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .update({ status: "read" })
      .eq("id", notificationId);
    if (error) throw error;
  },

  async markAllRead(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .update({ status: "read" })
      .eq("user_id", userId)
      .eq("status", "unread");
    if (error) throw error;
  },

  async remove(notificationId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);
    if (error) throw error;
  },

  subscribe(
    userId: string,
    onChange: (event: { type: "INSERT" | "UPDATE" | "DELETE"; notification: AppNotification | null; id: string }) => void,
  ): RealtimeChannel {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const eventType = payload.eventType as "INSERT" | "UPDATE" | "DELETE";
          if (eventType === "DELETE") {
            const oldRow = payload.old as Partial<NotificationRow> | null;
            onChange({ type: "DELETE", notification: null, id: oldRow?.id ?? "" });
            return;
          }
          const newRow = payload.new as NotificationRow;
          onChange({ type: eventType, notification: toRecord(newRow), id: newRow.id });
        },
      )
      .subscribe();
    return channel;
  },
};

export type { AppNotification };
