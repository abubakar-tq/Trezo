/**
 * GuardianListItem Component
 * Renders a single guardian in one of 7 lifecycle states
 * All states designed per recovery-ux skill constraints
 */

import React from "react";
import { ActivityIndicator, View, TouchableOpacity, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

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
  editable?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}

export const GuardianListItem: React.FC<GuardianListItemProps> = ({
  name,
  contact,
  state,
  removedDate,
  editable,
  onEdit,
  onRemove,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const getStateStyles = (state: GuardianState) => {
    const styles: Record<
      GuardianState,
      { color: string; icon: string; label: string; borderStyle?: any }
    > = {
      invited: {
        color: colors.warning,
        icon: "⏳",
        label: "Awaiting confirmation",
        borderStyle: { borderStyle: "dashed" as const },
      },
      pending: {
        color: colors.accent,
        icon: "⟳",
        label: "Securing your setup...",
      },
      active: {
        color: colors.success,
        icon: "✓",
        label: "Actively protecting",
      },
      recovering: {
        color: colors.accentAlt,
        icon: "↔",
        label: "Helping you recover",
      },
      inactive: {
        color: colors.textMuted,
        icon: "⚠",
        label: "Connection lost",
      },
      removed: {
        color: colors.textMuted,
        icon: "✗",
        label: "Removed",
      },
      expired: {
        color: colors.danger,
        icon: "🔄",
        label: "Invitation expired",
      },
    };

    return styles[state];
  };

  const { color, icon, label } = getStateStyles(state);
  const isInvited = state === "invited";

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: colors.surfaceCard,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: isInvited ? colors.warning : colors.borderMuted,
        borderStyle: isInvited ? "dashed" : "solid",
        gap: 12,
      }}
    >
      {/* Avatar + Info */}
      <View style={{ flex: 1, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: withAlpha(color, 0.1),
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 1,
              borderColor: withAlpha(color, 0.2),
            }}
          >
            <Text style={{ fontSize: 18, color: color }}>{icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              {name}
            </Text>
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 1 }}>
              {contact}
            </Text>
          </View>
        </View>

        {/* Status Label */}
        <View style={{ paddingLeft: 56, gap: 4 }}>
          <Text 
            style={{ 
              fontSize: 10, 
              fontWeight: '800', 
              letterSpacing: 0.5,
              color: color 
            }}
          >
            {label.toUpperCase()}
          </Text>
          {removedDate && (
            <Text style={{ fontSize: 11, color: colors.textMuted }}>
              {removedDate}
            </Text>
          )}
        </View>
      </View>

      {/* Actions or Indicator */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {editable && (
          <>
            <TouchableOpacity 
              onPress={onEdit} 
              activeOpacity={0.7}
              style={{ 
                padding: 8,
                borderRadius: 12,
                backgroundColor: withAlpha(colors.textPrimary, 0.03)
              }}
            >
              <Feather name="edit-2" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={onRemove} 
              activeOpacity={0.7}
              style={{ 
                padding: 8,
                borderRadius: 12,
                backgroundColor: withAlpha(colors.danger, 0.05)
              }}
            >
              <Feather name="trash-2" size={16} color={colors.danger} />
            </TouchableOpacity>
          </>
        )}
        {(state === "pending" || state === "recovering") && (
          <ActivityIndicator color={color} size="small" />
        )}
      </View>
    </View>
  );
};

/**
 * Guardian List Showcase
 * Renders all 7 states for visual QA
 */
export const GuardianListShowcase: React.FC = () => {
  const { theme } = useAppTheme();
  
  const mockGuardians: Array<any> = [
    {
      name: "Alice Smith",
      contact: "alice@example.com",
      state: "active",
    },
    {
      name: "Bob Johnson",
      contact: "+1 234 567 8900",
      state: "invited",
    },
    {
      name: "Carol Williams",
      contact: "carol@example.com",
      state: "pending",
    },
    {
      name: "David Brown",
      contact: "david@example.com",
      state: "recovering",
    },
    {
      name: "Eve Davis",
      contact: "eve@example.com",
      state: "inactive",
    },
    {
      name: "Frank Miller",
      contact: "frank@example.com",
      state: "removed",
      removedDate: "Removed on April 20, 2026",
    },
    {
      name: "Grace Lee",
      contact: "grace@example.com",
      state: "expired",
    },
  ];

  return (
    <View style={{ gap: 12 }}>
      {mockGuardians.map((guardian, idx) => (
        <GuardianListItem
          key={idx}
          name={guardian.name}
          contact={guardian.contact}
          state={guardian.state}
          removedDate={guardian.removedDate}
        />
      ))}
    </View>
  );
};

