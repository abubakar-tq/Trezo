import { useTabContentBottomInset } from "@app/hooks";
import { TabScreenContainer } from "@shared/components";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import { PortfolioService, type PortfolioData } from "@/src/features/portfolio/services/PortfolioService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

const portfolioAssets: Array<{ symbol: string; name: string; price: number; amount: number; value: number }> = [
  { symbol: "ETH", name: "Ethereum", price: 3245.32, amount: 0, value: 0 },
];

const allocationGroups: Array<{ label: string; percentage: number }> = [
  // { label: "Layer 1", percentage: 46 },
  // { label: "Layer 2", percentage: 24 },
  // { label: "DeFi", percentage: 18 },
  // { label: "Stablecoins", percentage: 12 },
];

const yieldPositions: Array<{ protocol: string; asset: string; apy: string; tvl: string }> = [
  // { protocol: "Lido", asset: "stETH", apy: "4.7%", tvl: "$25.4B" },
  // { protocol: "Marinade", asset: "mSOL", apy: "7.2%", tvl: "$512M" },
  // { protocol: "Aave v3", asset: "USDC", apy: "3.4%", tvl: "$6.1B" },
];

const PortfolioScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;
  const aaAccount = useWalletStore((state) => state.aaAccount);
  
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  const styles = useMemo(() => createStyles(colors), [colors]);
  const contentBottomInset = useTabContentBottomInset();
  const allocationPalette = useMemo(
    () => [colors.accent, colors.accentAlt, colors.warning, colors.success],
    [colors],
  );
  
  // Load portfolio data from blockchain
  useEffect(() => {
    const loadPortfolio = async () => {
      if (!aaAccount?.predictedAddress) {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      const data = await PortfolioService.getPortfolio(aaAccount.predictedAddress);
      setPortfolio(data);
      setLoading(false);
    };
    
    loadPortfolio();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadPortfolio, 30000);
    return () => clearInterval(interval);
  }, [aaAccount?.predictedAddress]);
  
  const portfolioAssets = portfolio?.tokens || [];

  return (
    <TabScreenContainer style={styles.screen}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: contentBottomInset }}
        showsVerticalScrollIndicator={false}
      >
      <LinearGradient colors={gradients.hero} style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Net worth</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.accent} style={{ marginVertical: 20 }} />
        ) : (
          <>
            <Text style={styles.summaryValue}>
              {PortfolioService.formatUSD(portfolio?.totalValue || 0)}
            </Text>
            <Text style={styles.summaryChange}>
              {portfolio?.change24h || 0}% over 24 hours
            </Text>

            <View style={styles.pillRow}>
              <View style={styles.summaryPill}>
                <Text style={styles.pillLabel}>Cost basis</Text>
                <Text style={styles.pillValue}>
                  {PortfolioService.formatUSD(portfolio?.costBasis || 0)}
                </Text>
              </View>
              <View style={styles.summaryPill}>
                <Text style={styles.pillLabel}>Unrealized P&L</Text>
                <Text style={[
                  styles.pillValue, 
                  { color: (portfolio?.unrealizedPnL || 0) > 0 ? colors.success : colors.textMuted }
                ]}>
                  {portfolio?.unrealizedPnL && portfolio.unrealizedPnL > 0 ? '+' : ''}
                  {PortfolioService.formatUSD(portfolio?.unrealizedPnL || 0)}
                </Text>
              </View>
            </View>
          </>
        )}
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Asset allocation</Text>
        <View style={styles.allocationBars}>
          {allocationGroups.map((group, index) => {
            const tone = allocationPalette[index % allocationPalette.length];
            return (
              <View key={group.label} style={styles.allocationRow}>
                <View style={[styles.allocationIndicator, { backgroundColor: tone }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.allocationLabel}>{group.label}</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${group.percentage}%`, backgroundColor: tone }]} />
                  </View>
                </View>
                <Text style={styles.allocationPercent}>{group.percentage}%</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Holdings</Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 1.5 }]}>Asset</Text>
          <Text style={[styles.tableCell, styles.tableAlignRight, { flex: 1 }]}>Price</Text>
          <Text style={[styles.tableCell, styles.tableAlignRight, { flex: 1 }]}>Amount</Text>
          <Text style={[styles.tableCell, styles.tableAlignRight, { flex: 1 }]}>Value</Text>
        </View>
        {portfolioAssets.map((asset, index) => (
          <View key={asset.symbol} style={[styles.tableRow, index < portfolioAssets.length - 1 && styles.tableDivider]}>
            <View style={{ flex: 1.5 }}>
              <Text style={styles.assetSymbol}>{asset.symbol}</Text>
              <Text style={styles.assetName}>{asset.name}</Text>
            </View>
            <Text style={[styles.tableValue, styles.tableAlignRight, { flex: 1 }]}>${asset.price.toLocaleString()}</Text>
            <Text style={[styles.tableValue, styles.tableAlignRight, { flex: 1 }]}>{asset.amount.toFixed(2)}</Text>
            <Text style={[styles.tableValue, styles.tableAlignRight, { flex: 1 }]}>${asset.value.toLocaleString()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Yield strategies</Text>
        {yieldPositions.map((position, index) => (
          <LinearGradient
            key={position.protocol}
            colors={gradients.cardAlt}
            style={[styles.yieldCard, index > 0 && { marginTop: 12 }]}
          >
            <Text style={styles.yieldProtocol}>{position.protocol}</Text>
            <Text style={styles.yieldAsset}>{position.asset}</Text>
            <View style={styles.yieldRow}>
              <View>
                <Text style={styles.yieldLabel}>APY</Text>
                <Text style={[styles.yieldValue, { color: colors.success }]}>{position.apy}</Text>
              </View>
              <View>
                <Text style={styles.yieldLabel}>TVL</Text>
                <Text style={styles.yieldValue}>{position.tvl}</Text>
              </View>
              <View>
                <Text style={styles.yieldLabel}>Status</Text>
                <Text style={styles.yieldValue}>Auto-compounding</Text>
              </View>
            </View>
          </LinearGradient>
        ))}
      </View>
      </ScrollView>
    </TabScreenContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    summaryCard: {
      borderRadius: 28,
      padding: 24,
      marginTop: 12,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.25),
      backgroundColor: colors.surfaceElevated,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 14,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    summaryValue: {
      color: colors.textPrimary,
      fontSize: 34,
      fontWeight: "800",
      marginTop: 8,
    },
    summaryChange: {
      color: colors.success,
      fontWeight: "600",
      marginTop: 6,
    },
    pillRow: {
      flexDirection: "row",
      columnGap: 12,
      marginTop: 20,
    },
    summaryPill: {
      flex: 1,
      borderRadius: 18,
      padding: 16,
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
    },
    pillLabel: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    pillValue: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginTop: 10,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 16,
    },
    allocationBars: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 18,
    },
    allocationRow: {
      flexDirection: "row",
      alignItems: "center",
      columnGap: 14,
      marginBottom: 14,
    },
    allocationIndicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    allocationLabel: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.textMuted, 0.22),
      marginTop: 8,
      overflow: "hidden",
    },
    progressFill: {
      height: 6,
      borderRadius: 999,
    },
    allocationPercent: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    tableHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    tableCell: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    tableAlignRight: {
      textAlign: "right",
    },
    tableRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 16,
    },
    tableDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    assetSymbol: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    assetName: {
      color: colors.textMuted,
      marginTop: 4,
    },
    tableValue: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    yieldCard: {
      borderRadius: 22,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
    yieldProtocol: {
      color: colors.textMuted,
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    yieldAsset: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      marginTop: 12,
    },
    yieldRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 18,
    },
    yieldLabel: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
    },
    yieldValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
      marginTop: 6,
    },
  });

export default PortfolioScreen;
