import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { TabScreenContainer } from "@shared/components";
import { useAppTheme, type ThemeColors } from "@theme";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useNotificationStore } from "@features/notifications/store/useNotificationStore";
import type {
  AppNotification,
  NotificationCategory,
} from "@features/notifications/types/notification";
import { useUserStore } from "@/src/store/useUserStore";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

const CATEGORY_ICON: Record<NotificationCategory, FeatherIconName> = {
  incoming_transfer: "arrow-down-circle",
  outgoing_tx: "arrow-up-circle",
  swap: "repeat",
  security: "shield",
  recovery: "key",
  system: "info",
};

const formatRelativeTime = (iso: string): string => {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return new Date(ts).toLocaleDateString();
};

const accentColor = (accent: string | null, colors: ThemeColors): string => {
  switch (accent) {
    case "success":
      return colors.success;
    case "danger":
      return colors.danger;
    case "warning":
      return colors.warning;
    case "accent":
    default:
      return colors.accent;
  }
};

const NotificationCenterScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useUserStore((state) => state.user?.id ?? null);
  const notifications = useNotificationStore((state) => state.notifications);
  const isLoading = useNotificationStore((state) => state.isLoading);
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const hydrate = useNotificationStore((state) => state.hydrate);
  const refresh = useNotificationStore((state) => state.refresh);
  const markRead = useNotificationStore((state) => state.markRead);
  const markAllRead = useNotificationStore((state) => state.markAllRead);
  const remove = useNotificationStore((state) => state.remove);
  const clearAll = useNotificationStore((state) => state.clearAll);

  useEffect(() => {
    if (userId) {
      hydrate(userId).catch(() => undefined);
    }
  }, [userId, hydrate]);

  const handlePress = useCallback(
    (notification: AppNotification) => {
      if (notification.status === "unread") {
        markRead(notification.id).catch(() => undefined);
      }
      const deeplink = notification.payload?.deeplink;
      if (deeplink?.screen) {
        try {
          navigation.navigate(deeplink.screen as any, deeplink.params as any);
        } catch {
          // screen not registered in current navigator — mark-read is enough
        }
      }
    },
    [markRead, navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => {
      const iconName = (item.icon as FeatherIconName | null) ?? CATEGORY_ICON[item.category] ?? "bell";
      const tint = accentColor(item.accent, colors);
      const isUnread = item.status === "unread";
      return (
        <View
          style={[
            styles.item,
            { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted },
            isUnread && { borderColor: `${tint}4D` },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handlePress(item)}
            style={styles.itemPressable}
          >
            <View style={[styles.itemIcon, { backgroundColor: `${tint}1F` }]}>
              <Feather name={iconName} size={20} color={tint} />
            </View>
            <View style={styles.itemBody}>
              <View style={styles.itemTitleRow}>
                <Text
                  numberOfLines={1}
                  style={[styles.itemTitle, { color: colors.textPrimary }]}
                >
                  {item.title}
                </Text>
                {isUnread ? <View style={[styles.unreadDot, { backgroundColor: tint }]} /> : null}
              </View>
              <Text
                numberOfLines={2}
                style={[styles.itemSubtitle, { color: colors.textSecondary }]}
              >
                {item.body}
              </Text>
              <Text style={[styles.itemTime, { color: colors.textSecondary }]}>
                {formatRelativeTime(item.createdAt)}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => remove(item.id).catch(() => undefined)}
            style={styles.itemDeleteBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="trash-2" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      );
    },
    [colors, handlePress, remove, styles],
  );

  const renderEmpty = useCallback(
    () => (
      <View style={styles.empty}>
        <View
          style={[
            styles.emptyIcon,
            { backgroundColor: colors.glass, borderColor: colors.borderMuted },
          ]}
        >
          <Feather name="bell-off" size={28} color={colors.textSecondary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
          No notifications yet
        </Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          You&apos;ll see incoming transfers, transaction updates, and security events here.
        </Text>
      </View>
    ),
    [colors, styles],
  );

  return (
    <TabScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 ? (
            <TouchableOpacity
              onPress={() => markAllRead().catch(() => undefined)}
              style={[styles.headerActionBtn, { backgroundColor: colors.glass }]}
            >
              <Text style={[styles.headerActionLabel, { color: colors.accent }]}>Mark all read</Text>
            </TouchableOpacity>
          ) : null}
          {notifications.length > 0 ? (
            <TouchableOpacity
              onPress={() => clearAll().catch(() => undefined)}
              style={[styles.headerIconBtn, { backgroundColor: colors.glass }]}
            >
              <Feather name="trash-2" size={18} color={colors.danger} />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => navigation.navigate("NotificationSettings")}
            style={[styles.headerIconBtn, { backgroundColor: colors.glass }]}
          >
            <Feather name="settings" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          notifications.length === 0 ? styles.listContentEmpty : styles.listContent
        }
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => refresh().catch(() => undefined)}
            tintColor={colors.accent}
          />
        }
      />
    </TabScreenContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      gap: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      fontSize: 20,
      fontWeight: "700",
    },
    headerActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    headerActionBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 14,
    },
    headerActionLabel: {
      fontSize: 12,
      fontWeight: "600",
    },
    headerIconBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: 32,
      gap: 10,
    },
    listContentEmpty: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingBottom: 32,
    },
    item: {
      flexDirection: "row",
      borderRadius: 18,
      borderWidth: 1,
      alignItems: "center",
      overflow: "hidden",
    },
    itemPressable: {
      flex: 1,
      flexDirection: "row",
      gap: 14,
      padding: 14,
      alignItems: "flex-start",
    },
    itemDeleteBtn: {
      paddingHorizontal: 14,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    itemIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
    },
    itemBody: {
      flex: 1,
      gap: 4,
    },
    itemTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    itemTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    itemSubtitle: {
      fontSize: 13,
      lineHeight: 18,
    },
    itemTime: {
      fontSize: 11,
      marginTop: 2,
      opacity: 0.8,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
      gap: 16,
    },
    emptyIcon: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: "700",
    },
    emptyBody: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
  });

export default NotificationCenterScreen;
