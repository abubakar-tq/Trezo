import AsyncStorage from "@react-native-async-storage/async-storage";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { NotificationPreferencesService } from "@features/notifications/services/NotificationPreferencesService";
import { NotificationService } from "@features/notifications/services/NotificationService";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type AppNotification,
  type NotificationPreferences,
} from "@features/notifications/types/notification";
import { getSupabaseClient } from "@/src/lib/supabase";

type NotificationStoreState = {
  notifications: AppNotification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;
  activeUserId: string | null;
};

type NotificationStoreActions = {
  hydrate: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (notificationId: string) => Promise<void>;
  setPreferencesLocal: (next: Partial<NotificationPreferences>) => void;
  savePreferences: (next: Partial<NotificationPreferences>) => Promise<void>;
  applyRealtime: (event: { type: "INSERT" | "UPDATE" | "DELETE"; notification: AppNotification | null; id: string }) => void;
  reset: () => void;
};

export type NotificationStore = NotificationStoreState & NotificationStoreActions;

const initialState: NotificationStoreState = {
  notifications: [],
  unreadCount: 0,
  preferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  isHydrated: false,
  isLoading: false,
  error: null,
  activeUserId: null,
};

let activeChannel: RealtimeChannel | null = null;

const teardownChannel = () => {
  if (activeChannel) {
    try {
      const supabase = getSupabaseClient();
      supabase.removeChannel(activeChannel);
    } catch {
      // ignore — supabase client may be unconfigured during sign-out
    }
    activeChannel = null;
  }
};

const computeUnread = (list: AppNotification[]): number =>
  list.reduce((acc, n) => (n.status === "unread" ? acc + 1 : acc), 0);

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      hydrate: async (userId: string) => {
        if (!userId) return;
        const current = get();
        if (current.activeUserId === userId && current.isHydrated) return;

        set({ isLoading: true, error: null, activeUserId: userId });
        try {
          const [list, prefs] = await Promise.all([
            NotificationService.list(userId, { limit: 100 }),
            NotificationPreferencesService.get(userId),
          ]);
          set({
            notifications: list,
            unreadCount: computeUnread(list),
            preferences: prefs,
            isHydrated: true,
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Failed to load notifications",
          });
        }

        teardownChannel();
        activeChannel = NotificationService.subscribe(userId, (event) => {
          get().applyRealtime(event);
        });
      },

      refresh: async () => {
        const { activeUserId } = get();
        if (!activeUserId) return;
        set({ isLoading: true, error: null });
        try {
          const list = await NotificationService.list(activeUserId, { limit: 100 });
          set({
            notifications: list,
            unreadCount: computeUnread(list),
            isLoading: false,
          });
        } catch (err) {
          set({
            isLoading: false,
            error: err instanceof Error ? err.message : "Failed to refresh notifications",
          });
        }
      },

      markRead: async (notificationId: string) => {
        const { notifications } = get();
        const optimistic = notifications.map((n) =>
          n.id === notificationId && n.status === "unread"
            ? { ...n, status: "read" as const, readAt: new Date().toISOString() }
            : n,
        );
        set({ notifications: optimistic, unreadCount: computeUnread(optimistic) });
        try {
          await NotificationService.markRead(notificationId);
        } catch (err) {
          // rollback
          set({ notifications, unreadCount: computeUnread(notifications), error: err instanceof Error ? err.message : "Failed to update notification" });
        }
      },

      markAllRead: async () => {
        const { activeUserId, notifications } = get();
        if (!activeUserId) return;
        const optimistic = notifications.map((n) =>
          n.status === "unread" ? { ...n, status: "read" as const, readAt: new Date().toISOString() } : n,
        );
        set({ notifications: optimistic, unreadCount: 0 });
        try {
          await NotificationService.markAllRead(activeUserId);
        } catch (err) {
          set({ notifications, unreadCount: computeUnread(notifications), error: err instanceof Error ? err.message : "Failed to mark all as read" });
        }
      },

      remove: async (notificationId: string) => {
        const { notifications } = get();
        const next = notifications.filter((n) => n.id !== notificationId);
        set({ notifications: next, unreadCount: computeUnread(next) });
        try {
          await NotificationService.remove(notificationId);
        } catch (err) {
          set({ notifications, unreadCount: computeUnread(notifications), error: err instanceof Error ? err.message : "Failed to dismiss notification" });
        }
      },

      setPreferencesLocal: (next) => {
        set((state) => ({ preferences: { ...state.preferences, ...next } }));
      },

      savePreferences: async (next) => {
        const { activeUserId, preferences } = get();
        if (!activeUserId) return;
        const optimistic = { ...preferences, ...next };
        set({ preferences: optimistic });
        try {
          const saved = await NotificationPreferencesService.upsert(activeUserId, next);
          set({ preferences: saved });
        } catch (err) {
          set({ preferences, error: err instanceof Error ? err.message : "Failed to save preferences" });
        }
      },

      applyRealtime: (event) => {
        const { notifications } = get();
        if (event.type === "DELETE") {
          const next = notifications.filter((n) => n.id !== event.id);
          set({ notifications: next, unreadCount: computeUnread(next) });
          return;
        }
        if (!event.notification) return;
        const incoming = event.notification;
        const exists = notifications.some((n) => n.id === incoming.id);
        let next: AppNotification[];
        if (exists) {
          next = notifications.map((n) => (n.id === incoming.id ? incoming : n));
        } else {
          next = [incoming, ...notifications];
        }
        set({ notifications: next, unreadCount: computeUnread(next) });
      },

      reset: () => {
        teardownChannel();
        set({ ...initialState });
      },
    }),
    {
      name: "Trezo_Wallet-notification-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 50),
        preferences: state.preferences,
      }),
    },
  ),
);
