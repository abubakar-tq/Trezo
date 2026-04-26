/**
 * WalletBalanceCard Component
 * Displays current wallet balance with trust markers
 */

import React from "react";
import { View, ViewProps } from "react-native";
import { Surface } from "../Tier1/Surface";
import { BodyText, CaptionText, HeadlineText, TitleText } from "../Tier1/Text";
import { Colors } from "../TokenRegistry";

interface WalletBalanceCardProps extends Omit<ViewProps, "style"> {
  balance: string; // formatted as "1,234.56"
  symbol: string; // "ETH", "USDC", etc.
  usdValue: string; // "$2,345.67"
  isDark?: boolean;
  icon?: React.ReactNode;
}

export const WalletBalanceCard: React.FC<WalletBalanceCardProps> = ({
  balance,
  symbol,
  usdValue,
  isDark = true,
  icon,
  ...props
}) => {
  return (
    <Surface isDark={isDark} elevation={2}>
      <View style={{ gap: 12 }} {...props}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TitleText isDark={isDark}>Wallet Balance</TitleText>
          {/* Trust Marker */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              backgroundColor: isDark ? Colors.surface : Colors.lightSurface,
              borderRadius: 6,
            }}
          >
            <CaptionText color={Colors.success}>🛡</CaptionText>
            <CaptionText isDark={isDark} color={Colors.success}>
              Verified
            </CaptionText>
          </View>
        </View>

        {/* Balance */}
        <View style={{ gap: 4 }}>
          <View
            style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}
          >
            <HeadlineText isDark={isDark}>{balance}</HeadlineText>
            <TitleText
              isDark={isDark}
              color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
            >
              {symbol}
            </TitleText>
          </View>
          <BodyText isDark={isDark} color={Colors.success}>
            {usdValue}
          </BodyText>
        </View>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: isDark ? Colors.surface : Colors.lightCard,
            marginVertical: 4,
          }}
        />

        {/* Trust Indicator */}
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <CaptionText color={Colors.success}>✓</CaptionText>
            <CaptionText isDark={isDark}>Protected by your device</CaptionText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <CaptionText color={Colors.success}>✓</CaptionText>
            <CaptionText isDark={isDark}>Verified and encrypted</CaptionText>
          </View>
        </View>
      </View>
    </Surface>
  );
};
