/**
 * GuardianListItem Component
 * Renders a single guardian in one of 7 lifecycle states
 * All states designed per recovery-ux skill constraints
 */

import React from "react";
import { ActivityIndicator, View, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { Surface } from "../Tier1/Surface";
import { BodyText, CaptionText, OverlineText } from "../Tier1/Text";
import { Colors } from "../TokenRegistry";

export type GuardianState =
  | "invited"
  | "pending"
  | "active"
  | "recovering"
  | "inactive"
  | "removed"
  | "expired";

interface GuardianListItemProps {
  name: string;
  contact: string; // email or phone
  state: GuardianState;
  removedDate?: string; // "Removed on [Date]"
  isDark?: boolean;
  editable?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}

const getStateStyles = (state: GuardianState) => {
  const styles: Record<
    GuardianState,
    { color: string; icon: string; label: string; borderStyle?: any }
  > = {
    invited: {
      color: Colors.warning,
      icon: "⏳",
      label: "Awaiting confirmation",
      borderStyle: { borderStyle: "dashed" as const },
    },
    pending: {
      color: Colors.primary,
      icon: "⟳",
      label: "Securing your setup...",
    },
    active: {
      color: Colors.success,
      icon: "✓",
      label: "Actively protecting",
    },
    recovering: {
      color: "#4f46e5",
      icon: "↔",
      label: "Helping you recover",
    },
    inactive: {
      color: "#9ca3af",
      icon: "⚠",
      label: "Connection lost",
    },
    removed: {
      color: "#9ca3af",
      icon: "✗",
      label: "Removed",
    },
    expired: {
      color: Colors.danger,
      icon: "🔄",
      label: "Invitation expired",
    },
  };

  return styles[state];
};

export const GuardianListItem: React.FC<GuardianListItemProps> = ({
  name,
  contact,
  state,
  removedDate,
  isDark = true,
  editable,
  onEdit,
  onRemove,
}) => {
  const { color, icon, label, borderStyle } = getStateStyles(state);

  return (
    <Surface isDark={isDark} elevation={1}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          borderWidth: state === "invited" ? 1 : 0,
          borderColor: state === "invited" ? Colors.warning : "transparent",
          borderStyle: state === "invited" ? "dashed" : "solid",
          borderRadius: 8,
          padding: state === "invited" ? 8 : 0,
          gap: 12,
        }}
      >
        {/* Avatar + Info */}
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: color,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <BodyText color="#ffffff">{icon}</BodyText>
            </View>
            <View style={{ flex: 1 }}>
              <BodyText isDark={isDark} style={{ fontWeight: "600" }}>{name}</BodyText>
              <CaptionText
                isDark={isDark}
                color={isDark ? Colors.textTertiary : Colors.lightTextSecondary}
              >
                {contact}
              </CaptionText>
            </View>
          </View>

          {/* Status Label */}
          <View style={{ paddingLeft: 48, gap: 4 }}>
            <OverlineText color={color} style={{ fontSize: 10 }}>{label.toUpperCase()}</OverlineText>
            {removedDate && (
              <CaptionText
                isDark={isDark}
                color={isDark ? Colors.textTertiary : Colors.lightTextSecondary}
              >
                {removedDate}
              </CaptionText>
            )}
          </View>
        </View>

        {/* Actions or Indicator */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {editable && (
            <>
              <TouchableOpacity onPress={onEdit} style={{ padding: 4 }}>
                <Feather name="edit-2" size={16} color={isDark ? Colors.textTertiary : Colors.lightTextSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onRemove} style={{ padding: 4 }}>
                <Feather name="trash-2" size={16} color={Colors.danger} />
              </TouchableOpacity>
            </>
          )}
          {(state === "pending" || state === "recovering") && (
            <ActivityIndicator color={color} size="small" />
          )}
        </View>
      </View>
    </Surface>
  );
};

/**
 * Guardian List Showcase
 * Renders all 7 states for visual QA
 */
interface GuardianListShowcaseProps {
  isDark?: boolean;
}

export const GuardianListShowcase: React.FC<GuardianListShowcaseProps> = ({
  isDark = true,
}) => {
  const mockGuardians: Array<GuardianListItemProps> = [
    {
      name: "Alice Smith",
      contact: "alice@example.com",
      state: "active",
      isDark,
    },
    {
      name: "Bob Johnson",
      contact: "+1 234 567 8900",
      state: "invited",
      isDark,
    },
    {
      name: "Carol Williams",
      contact: "carol@example.com",
      state: "pending",
      isDark,
    },
    {
      name: "David Brown",
      contact: "david@example.com",
      state: "recovering",
      isDark,
    },
    {
      name: "Eve Davis",
      contact: "eve@example.com",
      state: "inactive",
      isDark,
    },
    {
      name: "Frank Miller",
      contact: "frank@example.com",
      state: "removed",
      removedDate: "Removed on April 20, 2026",
      isDark,
    },
    {
      name: "Grace Lee",
      contact: "grace@example.com",
      state: "expired",
      isDark,
    },
  ];

  return (
    <View style={{ gap: 8 }}>
      {mockGuardians.map((guardian, idx) => (
        <GuardianListItem
          key={idx}
          name={guardian.name}
          contact={guardian.contact}
          state={guardian.state}
          removedDate={guardian.removedDate}
          isDark={isDark}
        />
      ))}
    </View>
  );
};
