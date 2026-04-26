/**
 * WalletSummary.tsx
 *
 * Displays wallet balance with trust markers at the top of HomeScreen.
 * Uses F-Pattern: This is the TOP critical data point.
 *
 * Constraints Applied:
 * - F-Pattern: Top position (most critical data)
 * - Trust Markers: Shield icon + "Verified and encrypted" microcopy
 * - Rule of One: No actions (display only)
 * - Microcopy: "Your funds are safe" (security reassurance)
 * - Dark/Light mode support
 */

import React from "react";
import { View, Text } from "react-native";
import { Surface } from "../../../shared/components/Tier1/Surface";
import {
    BodyText,
    CaptionText,
    DisplayText,
} from "../../../shared/components/Tier1/Text";
import { Colors, Spacing } from "../../../shared/components/TokenRegistry";

interface WalletSummaryProps {
  isDark?: boolean;
  balance?: string;
  currency?: string;
}

export const WalletSummary: React.FC<WalletSummaryProps> = ({
  isDark = true,
  balance = "$12,450.50",
  currency = "USD",
}) => {
  return (
    <Surface isDark={isDark} elevation={1}>
      <View style={{ gap: Spacing.sp4, alignItems: "center" }}>
        {/* BALANCE DISPLAY */}
        <View style={{ gap: Spacing.sp1, alignItems: "center" }}>
          <CaptionText
            color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
          >
            Total Balance
          </CaptionText>
          <DisplayText isDark={isDark}>{balance}</DisplayText>
          <BodyText
            color={isDark ? Colors.textTertiary : Colors.lightTextSecondary}
            style={{ fontSize: 14 }}
          >
            {currency}
          </BodyText>
        </View>

        {/* TRUST MARKER */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: Spacing.sp1,
            paddingVertical: Spacing.sp2,
            paddingHorizontal: Spacing.sp3,
            backgroundColor: isDark ? Colors.surfaceMid : "#f0fdf4",
            borderRadius: 6,
          }}
        >
          <Text style={{ fontSize: 14 }}>🛡</Text>
          <BodyText
            isDark={isDark}
            color={Colors.success}
            style={{ fontSize: 12 }}
          >
            Verified and encrypted
          </BodyText>
        </View>

        {/* REASSURANCE MICROCOPY */}
        <BodyText
          isDark={isDark}
          color={isDark ? Colors.textTertiary : Colors.lightTextSecondary}
          style={{ fontSize: 12, textAlign: "center", marginTop: Spacing.sp1 }}
        >
          Your funds are safe and secured by your device.
        </BodyText>
      </View>
    </Surface>
  );
};

export default WalletSummary;
