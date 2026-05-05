import React from "react";
import { View, ViewProps } from "react-native";
import { useAppTheme } from "@theme";
import { OverlineText } from "./Text";
import { BorderRadius } from "../TokenRegistry";

type BadgeStatus = "active" | "pending" | "inactive" | "warning" | "danger" | "neutral" | "success";

interface BadgeProps extends Omit<ViewProps, "style"> {
  status: BadgeStatus;
  label: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ status, label, icon, ...props }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const getStatusColors = (): { bg: string; text: string } => {
    switch (status) {
      case "active":
      case "success":
        return { bg: colors.success, text: "#ffffff" };
      case "pending":
      case "warning":
        return { bg: colors.warning, text: "#ffffff" };
      case "danger":
        return { bg: colors.danger, text: "#ffffff" };
      case "inactive":
      case "neutral":
      default:
        return { bg: colors.surfaceMuted, text: colors.textSecondary };
    }
  };

  const { bg, text } = getStatusColors();

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

export const ActiveBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="active" {...props} />;
export const PendingBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="pending" {...props} />;
export const InactiveBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="inactive" {...props} />;
export const WarningBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="warning" {...props} />;
export const DangerBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="danger" {...props} />;
export const NeutralBadge: React.FC<Omit<BadgeProps, "status">> = (props) => <Badge status="neutral" {...props} />;
