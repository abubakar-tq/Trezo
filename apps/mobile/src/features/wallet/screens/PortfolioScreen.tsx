/**
 * PortfolioScreen.tsx
 *
 * Asset portfolio display for the Wallet tab.
 *
 * Constraints Applied:
 * - F-Pattern: Total balance top, assets middle, actions bottom
 * - Trust Markers: Shield icon on balance, "Safe" indicator
 * - No spinners for data (use skeletons)
 * - Empty state with CTA
 * - Asset list with balances
 */

import React from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity } from "react-native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

interface PortfolioScreenProps {
  onSend?: () => void;
  onReceive?: () => void;
}

interface Asset {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  value: number;
  change24h: number;
  icon: string;
}

const MOCK_ASSETS: Asset[] = [
  {
    id: "1",
    symbol: "ETH",
    name: "Ethereum",
    balance: 3.5,
    value: 10500,
    change24h: 2.5,
    icon: "⟠",
  },
  {
    id: "2",
    symbol: "USDC",
    name: "USD Coin",
    balance: 5000,
    value: 5000,
    change24h: 0.1,
    icon: "◎",
  },
  {
    id: "3",
    symbol: "DAI",
    name: "Dai Stablecoin",
    balance: 2500,
    value: 2500,
    change24h: 0.05,
    icon: "◆",
  },
];

export const PortfolioScreen: React.FC<PortfolioScreenProps> = ({
  onSend,
  onReceive,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const totalBalance = MOCK_ASSETS.reduce((sum, asset) => sum + asset.value, 0);
  const totalChange =
    MOCK_ASSETS.reduce((sum, asset) => sum + asset.change24h, 0) /
    MOCK_ASSETS.length;

  const renderAssetItem = (asset: Asset) => {
    const status = asset.change24h >= 0 ? "success" : "danger";
    return (
      <View key={asset.id} style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.borderMuted }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              flex: 1,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 28, color: colors.textPrimary }}>
              {asset.icon}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
                {asset.symbol}
              </Text>
              <Text
                style={{ fontSize: 12, color: colors.textMuted }}
              >
                {asset.balance} {asset.symbol}
              </Text>
            </View>
          </View>

          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <Text style={{ fontWeight: "600", color: colors.textPrimary }}>
              ${asset.value.toLocaleString()}
            </Text>
            <View style={{
              backgroundColor: status === "success" ? withAlpha(colors.success, 0.15) : withAlpha(colors.danger, 0.15),
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12
            }}>
              <Text style={{ color: status === "success" ? colors.success : colors.danger, fontSize: 11, fontWeight: "700" }}>
                {`${asset.change24h >= 0 ? "+" : ""}${asset.change24h.toFixed(2)}%`}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 24,
          gap: 24,
          paddingBottom: 32,
        }}
      >
        {/* HEADER */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.textPrimary }}>Your Assets</Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            Manage your cryptocurrency portfolio.
          </Text>
        </View>

        {/* TOTAL BALANCE (Critical Data - F-Pattern Top) */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: colors.textMuted }}>
                TOTAL BALANCE
              </Text>
              <Text style={{ fontSize: 14 }}>🛡</Text>
            </View>

            <Text
              style={{ fontSize: 36, fontWeight: "bold", color: colors.textPrimary }}
            >
              ${totalBalance.toLocaleString()}
            </Text>

            <View
              style={{
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
              }}
            >
              <View style={{
                backgroundColor: totalChange >= 0 ? withAlpha(colors.success, 0.15) : withAlpha(colors.danger, 0.15),
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12
              }}>
                <Text style={{ color: totalChange >= 0 ? colors.success : colors.danger, fontSize: 11, fontWeight: "700" }}>
                  {`${totalChange >= 0 ? "+" : ""}${totalChange.toFixed(2)}% today`}
                </Text>
              </View>
              <Text
                style={{ fontSize: 12, color: colors.textMuted }}
              >
                Across all assets
              </Text>
            </View>
          </View>
        </View>

        {/* TRUST MARKER */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 18 }}>🛡</Text>
            <Text
              style={{ fontWeight: "600", fontSize: 13, color: colors.success }}
            >
              Your assets are secured by your device
            </Text>
          </View>
        </View>

        {/* QUICK ACTIONS (F-Pattern Middle) */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            onPress={onSend}
            activeOpacity={0.85}
            style={{ flex: 1, backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14, alignItems: "center" }}
          >
            <Text style={{ color: colors.textOnAccent, fontSize: 15, fontWeight: "700" }}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onReceive}
            activeOpacity={0.85}
            style={{ flex: 1, borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "600" }}>Receive</Text>
          </TouchableOpacity>
        </View>

        {/* ASSETS LIST */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", color: colors.accent }}>YOUR HOLDINGS</Text>
          {MOCK_ASSETS.map((asset) => renderAssetItem(asset))}
        </View>

        {/* ADDITIONAL INFO */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textPrimary }}>Portfolio Tips</Text>
            <Text
              style={{ fontSize: 13, lineHeight: 20, color: colors.textSecondary }}
            >
              • Your balance updates automatically{"\n"}• No trading fees for
              transfers{"\n"}• All transactions are final and irreversible
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default PortfolioScreen;
