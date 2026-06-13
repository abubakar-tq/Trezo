import React from "react";
import { View, ViewProps } from "react-native";
import { useAppTheme } from "@theme";
import { BorderRadius } from "../TokenRegistry";
import { OverlineText } from "./Text";

type BadgeStatus =
  | "active"
  | "pending"
  | "inactive"
  | "warning"
  | "danger"
  | "neutral"
  | "success"
  | "accent";

interface BadgeProps extends Omit<ViewProps, "style"> {
  status: BadgeStatus;
  label: string;
  icon?: React.ReactNode;
  dot?: boolean;  // show a leading dot indicator instead of icon
}

export const Badge: React.FC<BadgeProps> = ({ status, label, icon, dot, ...props }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  // Soft backgrounds + bordered color text — more refined than filled-background badges
  const getStatusColors = (): { bg: string; text: string; border: string; dotColor: string } => {
    switch (status) {
      case "active":
      case "success":
        return {
          bg: colors.successSoft,
          text: colors.success,
          border: `${colors.success}30`,
          dotColor: colors.success,
        };
      case "pending":
      case "warning":
        return {
          bg: colors.warningSoft,
          text: colors.warning,
          border: `${colors.warning}30`,
          dotColor: colors.warning,
        };
      case "danger":
        return {
          bg: colors.dangerSoft,
          text: colors.danger,
          border: `${colors.danger}30`,
          dotColor: colors.danger,
        };
      case "accent":
        return {
          bg: colors.accentSoft,
          text: colors.accent,
          border: `${colors.accent}30`,
          dotColor: colors.accent,
        };
      case "inactive":
      case "neutral":
      default:
        return {
          bg: colors.surfaceMuted,
          text: colors.textSecondary,
          border: colors.borderMuted,
          dotColor: colors.textMuted,
        };
    }
  };

  const { bg, text, border, dotColor } = getStatusColors();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: BorderRadius.full,
        borderWidth: 1,
        borderColor: border,
        gap: 5,
        alignSelf: "flex-start",
      }}
      {...props}
    >
      {dot && !icon && (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor: dotColor,
          }}
        />
      )}
      {icon && !dot && icon}
      <OverlineText color={text}>{label}</OverlineText>
    </View>
  );
};

export const ActiveBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="active" {...props} />;
export const PendingBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="pending" {...props} />;
export const InactiveBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="inactive" {...props} />;
export const WarningBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="warning" {...props} />;
export const DangerBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="danger" {...props} />;
export const NeutralBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="neutral" {...props} />;
export const AccentBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="accent" {...props} />;
