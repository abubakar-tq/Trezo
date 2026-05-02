/**
 * NotificationCenterScreen.tsx
 *
 * Central notification hub for all app alerts.
 *
 * Constraints Applied:
 * - F-Pattern: Notification list, actions
 * - Empty state with settings CTA
 * - Notification cards with action buttons
 * - Trust markers: Priority badges
 * - Mark as read functionality
 */

import React, { useState } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import { Badge } from "../../../shared/components/Tier1/Badge";
import {
    PrimaryButton,
    SecondaryButton,
} from "../../../shared/components/Tier1/Button";
import { CardLevel1, Surface } from "../../../shared/components/Tier1/Surface";
import {
    BodyText,
    CaptionText,
    HeadlineText,
    TitleText,
} from "../../../shared/components/Tier1/Text";
import { Colors, Spacing } from "../../../shared/components/TokenRegistry";

interface Notification {
  id: string;
  type: "transaction" | "security" | "system";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  priority: "high" | "normal" | "low";
  icon: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface NotificationCenterScreenProps {
  isDark?: boolean;
  onSettingsPress?: () => void;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    type: "security",
    title: "New Trusted Contact Added",
    message:
      "Alice Johnson was added as a trusted contact for recovery. Review changes.",
    timestamp: "5 minutes ago",
    read: false,
    priority: "high",
    icon: "🛡",
    action: {
      label: "Review",
      onPress: () => console.log("Review security"),
    },
  },
  {
    id: "2",
    type: "transaction",
    title: "Received 0.5 ETH",
    message: "From 0x742d35Cc6634... Amount: 0.5 ETH (≈$1,500). View details.",
    timestamp: "2 hours ago",
    read: false,
    priority: "normal",
    icon: "📥",
  },
  {
    id: "3",
    type: "transaction",
    title: "Sent 1.0 ETH",
    message: "To Bob Smith. Transaction confirmed. Gas used: 0.0021 ETH.",
    timestamp: "1 day ago",
    read: true,
    priority: "normal",
    icon: "📤",
  },
  {
    id: "4",
    type: "system",
    title: "New App Version Available",
    message:
      "Version 1.1.0 is now available with new features and security updates.",
    timestamp: "2 days ago",
    read: true,
    priority: "low",
    icon: "📲",
    action: {
      label: "Update",
      onPress: () => console.log("Update app"),
    },
  },
];

export const NotificationCenterScreen: React.FC<
  NotificationCenterScreenProps
> = ({ isDark = true, onSettingsPress }) => {
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const renderNotificationCard = (notification: Notification) => (
    <CardLevel1 isDark={isDark} key={notification.id}>
      <View
        style={{
          backgroundColor: !notification.read
            ? isDark
              ? Colors.surface
              : "#f3f4f6"
            : "transparent",
          opacity: !notification.read ? 1 : 0.7,
        }}
      >
        <View style={{ gap: Spacing.sp2 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: Spacing.sp2,
            }}
          >
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sp2,
                flex: 1,
                alignItems: "center",
              }}
            >
              <BodyText isDark={isDark} style={{ fontSize: 24 }}>
                {notification.icon}
              </BodyText>

              <View style={{ flex: 1, gap: Spacing.sp1 }}>
                <View
                  style={{
                    flexDirection: "row",
                    gap: Spacing.sp2,
                    alignItems: "center",
                  }}
                >
                  <BodyText
                    isDark={isDark}
                    style={{ fontWeight: "600", flex: 1 }}
                  >
                    {notification.title}
                  </BodyText>
                  {!notification.read && (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: Colors.primary,
                      }}
                    />
                  )}
                </View>

                <BodyText
                  isDark={isDark}
                  color={
                    isDark ? Colors.textSecondary : Colors.lightTextSecondary
                  }
                  style={{ fontSize: 12, lineHeight: 16 }}
                >
                  {notification.message}
                </BodyText>
              </View>
            </View>

            <Badge
              isDark={isDark}
              status={
                notification.priority === "high"
                  ? "danger"
                  : notification.priority === "normal"
                    ? "warning"
                    : "success"
              }
              label={
                notification.priority === "high"
                  ? "!"
                  : notification.priority === "normal"
                    ? "i"
                    : "✓"
              }
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              gap: Spacing.sp2,
              paddingTop: Spacing.sp2,
              borderTopWidth: 1,
              borderTopColor: isDark ? Colors.surfaceMid : "#e5e7eb",
            }}
          >
            <CaptionText
              color={isDark ? Colors.textTertiary : Colors.lightTextTertiary}
            >
              {notification.timestamp}
            </CaptionText>

            <View style={{ flexDirection: "row", gap: Spacing.sp2 }}>
              {notification.action && (
                <SecondaryButton
                  label={notification.action.label}
                  isDark={isDark}
                  onPress={notification.action.onPress}
                />
              )}

              {!notification.read && (
                <SecondaryButton
                  label="Mark Read"
                  isDark={isDark}
                  onPress={() => markAsRead(notification.id)}
                />
              )}
            </View>
          </View>
        </View>
      </View>
    </CardLevel1>
  );

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDark ? Colors.background : "#ffffff",
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.sp4,
          paddingVertical: Spacing.sp6,
          gap: Spacing.sp6,
          paddingBottom: Spacing.sp8,
        }}
      >
        {/* HEADER */}
        <View style={{ gap: Spacing.sp2 }}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <HeadlineText isDark={isDark}>Notifications</HeadlineText>
            {unreadCount > 0 && (
              <Badge
                isDark={isDark}
                status="danger"
                label={`${unreadCount} new`}
              />
            )}
          </View>
          <BodyText
            isDark={isDark}
            color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
          >
            Stay updated on transactions and security.
          </BodyText>
        </View>

        {/* MARK ALL READ CTA */}
        {unreadCount > 0 && (
          <SecondaryButton
            label={`Mark ${unreadCount} as read`}
            isDark={isDark}
            onPress={markAllAsRead}
          />
        )}

        {/* NOTIFICATIONS LIST */}
        {notifications.length > 0 ? (
          <View style={{ gap: Spacing.sp3 }}>
            <CaptionText color={Colors.primary}>
              {unreadCount > 0 ? `${unreadCount} Unread` : "All caught up"}
            </CaptionText>

            {notifications.map((notification) =>
              renderNotificationCard(notification),
            )}
          </View>
        ) : (
          <Surface isDark={isDark} elevation={1}>
            <View
              style={{
                alignItems: "center",
                gap: Spacing.sp3,
                paddingVertical: Spacing.sp6,
              }}
            >
              <BodyText isDark={isDark} style={{ fontSize: 48 }}>
                🔔
              </BodyText>
              <View style={{ alignItems: "center", gap: Spacing.sp2 }}>
                <TitleText isDark={isDark}>No notifications</TitleText>
                <BodyText
                  isDark={isDark}
                  color={
                    isDark ? Colors.textSecondary : Colors.lightTextSecondary
                  }
                  style={{ fontSize: 13, textAlign: "center" }}
                >
                  You're all caught up. New alerts will appear here.
                </BodyText>
              </View>
            </View>
          </Surface>
        )}

        {/* NOTIFICATION SETTINGS */}
        <CardLevel1 isDark={isDark}>
          <View style={{ gap: Spacing.sp2 }}>
            <TitleText isDark={isDark}>Customize Notifications</TitleText>
            <BodyText
              isDark={isDark}
              color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
              style={{ fontSize: 13 }}
            >
              Manage which notifications you receive in your device settings.
            </BodyText>
            <PrimaryButton
              label="Notification Settings"
              isDark={isDark}
              onPress={onSettingsPress}
            />
          </View>
        </CardLevel1>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationCenterScreen;
