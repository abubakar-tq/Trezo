/**
 * QuickActionTray.tsx
 *
 * Three quick action buttons for common operations:
 * - Send: Initiate a transaction
 * - Receive: Generate receive address
 * - Security Center: Access recovery and guardian management
 *
 * Constraints Applied:
 * - F-Pattern: Positioned in middle section of screen
 * - Rule of One: No primary button (all equal weight)
 * - Microcopy: Simple, action-oriented labels
 * - Trust Markers: Lock icon on Send (blockchain write)
 */

import React from "react";
import { View } from "react-native";
import { TertiaryButton } from "../../../shared/components/Tier1/Button";
import { CaptionText } from "../../../shared/components/Tier1/Text";
import { Colors, Spacing } from "../../../shared/components/TokenRegistry";

interface QuickActionTrayProps {
  isDark?: boolean;
  onSend?: () => void;
  onReceive?: () => void;
  onSecurityCenter?: () => void;
}

export const QuickActionTray: React.FC<QuickActionTrayProps> = ({
  isDark = true,
  onSend,
  onReceive,
  onSecurityCenter,
}) => {
  return (
    <View
      style={{
        gap: Spacing.sp3,
      }}
    >
      {/* SECTION LABEL */}
      <CaptionText
        color={Colors.primary}
        style={{ textTransform: "uppercase" }}
      >
        Quick Actions
      </CaptionText>

      {/* ACTION BUTTONS */}
      <View
        style={{
          flexDirection: "row",
          gap: Spacing.sp2,
          justifyContent: "space-between",
        }}
      >
        {/* SEND */}
        <View style={{ flex: 1 }}>
          <TertiaryButton label="💸 Send" isDark={isDark} onPress={onSend} />
        </View>

        {/* RECEIVE */}
        <View style={{ flex: 1 }}>
          <TertiaryButton
            label="📥 Receive"
            isDark={isDark}
            onPress={onReceive}
          />
        </View>

        {/* SECURITY CENTER */}
        <View style={{ flex: 1 }}>
          <TertiaryButton
            label="🛡 Security"
            isDark={isDark}
            onPress={onSecurityCenter}
          />
        </View>
      </View>
    </View>
  );
};

export default QuickActionTray;
