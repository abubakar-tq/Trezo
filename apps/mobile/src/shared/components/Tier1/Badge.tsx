/**
 * Badge Component
 * Status indicators: Active, Pending, Inactive, Warning, Danger, Neutral
 */

import React from "react";
import { View, ViewProps } from "react-native";
import { OverlineText } from "./Text";
import { BorderRadius, Colors } from "../TokenRegistry";

type BadgeStatus =
  | "active"
  | "pending"
  | "inactive"
  | "warning"
  | "danger"
  | "neutral"
  | "success";

interface BadgeProps extends Omit<ViewProps, "style"> {
  status: BadgeStatus;
  label: string;
  isDark?: boolean;
  icon?: React.ReactNode;
}

const getStatusStyles = (status: BadgeStatus, isDark: boolean) => {
  const styles: Record<BadgeStatus, { bg: string; text: string }> = {
    active: {
      bg: Colors.success,
      text: "#ffffff",
    },
    pending: {
      bg: Colors.warning,
      text: "#ffffff",
    },
    inactive: {
      bg: isDark ? "#4b5563" : "#cbd5e0",
      text: isDark ? "#e2e8f0" : "#2d3748",
    },
    warning: {
      bg: Colors.warning,
      text: "#ffffff",
    },
    danger: {
      bg: Colors.danger,
      text: "#ffffff",
    },
    neutral: {
      bg: isDark ? Colors.surfaceMid : Colors.lightCard,
      text: isDark ? Colors.textSecondary : Colors.lightTextSecondary,
    },
    success: {
      bg: Colors.success,
      text: "#ffffff",
    },
  };

  return styles[status];
};

export const Badge: React.FC<BadgeProps> = ({
  status,
  label,
  isDark = true,
  icon,
  ...props
}) => {
  const { bg, text } = getStatusStyles(status, isDark);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: BorderRadius.full,
        gap: 4,
        alignSelf: "flex-start",
      }}
      {...props}
    >
      {icon}
      <OverlineText color={text}>{label}</OverlineText>
    </View>
  );
};

/**
 * Convenience factories
 */
export const ActiveBadge: React.FC<Omit<BadgeProps, "status">> = (props) => (
  <Badge status="active" {...props} />
);

export const PendingBadge: React.FC<Omit<BadgeProps, "status">> = (props) => (
  <Badge status="pending" {...props} />
);

export const InactiveBadge: React.FC<Omit<BadgeProps, "status">> = (props) => (
  <Badge status="inactive" {...props} />
);

export const WarningBadge: React.FC<Omit<BadgeProps, "status">> = (props) => (
  <Badge status="warning" {...props} />
);

export const DangerBadge: React.FC<Omit<BadgeProps, "status">> = (props) => (
  <Badge status="danger" {...props} />
);

export const NeutralBadge: React.FC<Omit<BadgeProps, "status">> = (props) => (
  <Badge status="neutral" {...props} />
);
