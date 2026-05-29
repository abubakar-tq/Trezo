import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { formatUnits } from "viem";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import { TabScreenContainer, Sparkline, InteractiveChart } from "@shared/components";
import { AssetList } from "../../home/components/dashboard";
import { useWalletData } from "@hooks/useWalletData";
import { useMarketData } from "@hooks/useMarketData";
import { usePortfolioHistory } from "@hooks/usePortfolioHistory";
import { useTabContentBottomInset } from "@hooks";
import { useUserStore } from "../../../store/useUserStore";
import { useNavigation } from "@react-navigation/native";
import { ActivationSheet } from "@features/wallet/components/ActivationSheet";
import { ChainSwitcherChip } from "@features/wallet/components/ChainSwitcherChip";
import { SetUpWalletSheet } from "@features/wallet/components/SetUpWalletSheet";
import { useAccountState } from "@features/wallet/hooks/useAccountState";
import { useActivationSheet } from "@features/wallet/hooks/useActivationSheet";
import { useSetUpWalletSheet } from "@features/wallet/hooks/useSetUpWalletSheet";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { TokenDetailModal } from "../components/TokenDetailModal";
import type { TokenBalance } from "../services/PortfolioService";
import { TokenIcon } from "@shared/components/visuals/TokenIcon";

const { width } = Dimensions.get("window");

const PortfolioScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const contentBottomInset = useTabContentBottomInset();
  const navigation = useNavigation<any>();

  const { isActiveOnChain, isProvisioned } = useAccountState();
  const activeChainId = useWalletStore((s) => s.activeChainId);
  const { ref: activationSheetRef, requireActiveOnChain } = useActivationSheet();
  const { ref: setUpRef, requireProvisioned } = useSetUpWalletSheet();

  // Mirror HomeScreen: per-chain aa_wallets address is the source of truth.
  // Global smartAccountAddress is the legacy fallback (also kept in sync with
  // the active chain by useChainSwitcher). Never fall back to a random demo
  // address - that used to query an empty wallet and cache the empty result
  // for 30s, hiding the user's real holdings.
  const aaAccountAddress = useWalletStore((s) => s.aaAccount?.predictedAddress);
  const globalSmartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const smartAccountAddress = (aaAccountAddress ?? globalSmartAccountAddress) as string | null;
  const { totalBalanceUSD, tokens, isLoading: walletLoading } = useWalletData(smartAccountAddress ?? undefined);
  const { assets: marketAssets, loading: marketLoading, refresh: refreshMarket } = useMarketData(5);

  const [selectedPeriod, setSelectedPeriod] = useState("1W");
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [touchedValue, setTouchedValue] = useState<number | null>(null);

  const handleAssetPress = (token: TokenBalance) => {
    setSelectedToken(token);
    setModalVisible(true);
  };

  const displayTokens = useMemo(() => {
    return tokens.map((t: any) => {
      const balance =
        t.balance_formatted ||
        (t.balance ? formatUnits(t.balance, t.decimals || 18) : "0");
      return {
        symbol: t.symbol || "UNKNOWN",
        name: t.name || "Unknown Token",
        amount: parseFloat(balance),
        price: t.usd_price || 0,
        value: t.usd_value || 0,
        change24h: 0,
        decimals: (t.decimals as number) || 18,
        address: (t.token_address || "0x") as `0x${string}`,
      };
    });
  }, [tokens]);

  const { history: portfolioHistory, loading: historyLoading, periodChange, periodDelta } =
    usePortfolioHistory(displayTokens, selectedPeriod);

  const isPositive = (periodChange ?? 0) >= 0;
  const chartColor = isPositive ? colors.success : colors.danger;

  const periodLabel: Record<string, string> = {
    "1D": "today",
    "1W": "this week",
    "1M": "this month",
    "1Y": "this year",
    ALL: "all time",
  };

  const displayedBalance = touchedValue ?? totalBalanceUSD;

  const formatBalance = (val: number) =>
    val >= 1e9
      ? `${(val / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`
      : val >= 1e6
        ? `${(val / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
        : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <TabScreenContainer includeBottomInset>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerKicker}>MY VAULT</Text>
            <Text style={styles.headerBrand}>PERFORMANCE</Text>
            <View style={styles.headerChainRow}>
              <ChainSwitcherChip
                onError={(message) => Alert.alert("Could not switch chain", message)}
              />
            </View>
          </View>
        </View>

        {/* Performance Card */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.perfCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            {/* Balance row */}
            <View style={styles.perfHeader}>
              <View style={styles.perfBalanceBlock}>
                <Text style={[styles.perfLabel, { color: colors.textMuted }]}>
                  {touchedValue ? "Portfolio at point" : "Total Portfolio"}
                </Text>
                <View style={styles.perfBalanceRow}>
                  <Text style={[styles.perfCurrency, { color: colors.textSecondary }]}>$</Text>
                  <Text
                    style={[styles.perfBalance, { color: colors.textPrimary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {walletLoading ? "---" : formatBalance(displayedBalance)}
                  </Text>
                </View>
              </View>

              {periodChange !== null ? (
                <View
                  style={[
                    styles.changeBadge,
                    {
                      backgroundColor: isPositive ? colors.successSoft : colors.dangerSoft,
                    },
                  ]}
                >
                  <Feather
                    name={isPositive ? "trending-up" : "trending-down"}
                    size={11}
                    color={isPositive ? colors.success : colors.danger}
                  />
                  <Text style={[styles.changeBadgeText, { color: isPositive ? colors.success : colors.danger }]}>
                    {isPositive ? "+" : ""}{periodChange.toFixed(2)}%
                  </Text>
                </View>
              ) : historyLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : null}
            </View>

            {/* Period delta */}
            {periodDelta !== null ? (
              <Text style={[styles.perfDelta, { color: isPositive ? colors.success : colors.danger }]}>
                {periodDelta >= 0 ? "+" : ""}$
                {Math.abs(periodDelta).toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
                {periodLabel[selectedPeriod] ?? ""}
              </Text>
            ) : !historyLoading ? (
              <Text style={[styles.perfDelta, { color: colors.textMuted }]}>
                Drag chart to explore history
              </Text>
            ) : null}

            {/* Chart */}
            <View style={styles.chartWrapper}>
              {historyLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : portfolioHistory.length >= 2 ? (
                <InteractiveChart
                  data={portfolioHistory}
                  chartWidth={width - 80}
                  chartHeight={120}
                  color={chartColor}
                  onTouchValue={setTouchedValue}
                  formatTooltip={(v) =>
                    `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  }
                />
              ) : (
                <Text style={[styles.chartEmpty, { color: colors.textMuted }]}>
                  {walletLoading ? "Loading wallet…" : "No historical data available"}
                </Text>
              )}
            </View>

            {/* Period Picker */}
            <View style={[styles.periodPicker, { backgroundColor: colors.glass }]}>
              {["1D", "1W", "1M", "1Y", "ALL"].map((period) => (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodPill,
                    selectedPeriod === period && { backgroundColor: colors.accent },
                  ]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text
                    style={[
                      styles.periodLabel,
                      { color: selectedPeriod === period ? colors.textOnAccent : colors.textSecondary },
                    ]}
                  >
                    {period}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Market Trends */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeadRow}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>MARKET TRENDS</Text>
            <TouchableOpacity onPress={() => refreshMarket()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.refreshLabel, { color: colors.accent }]}>Refresh</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.marketScrollContent}
          >
            {marketLoading && marketAssets.length === 0 ? (
              <View style={styles.marketLoadingWrapper}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              marketAssets.map((asset) => {
                const price = parseFloat(asset.priceUsd);
                const change = parseFloat(asset.changePercent24Hr);
                const changePositive = change >= 0;

                return (
                  <TouchableOpacity
                    key={asset.id}
                    style={[styles.marketCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
                    onPress={() =>
                      handleAssetPress({
                        symbol: asset.symbol,
                        name: asset.name,
                        amount: 0,
                        price,
                        value: 0,
                        change24h: change,
                        decimals: 18,
                        address: asset.id as `0x${string}`,
                      })
                    }
                    activeOpacity={0.75}
                  >
                    <View style={styles.marketCardHeader}>
                      <TokenIcon symbol={asset.symbol} size={32} />
                      <View
                        style={[
                          styles.marketChangePill,
                          {
                            backgroundColor: changePositive ? colors.successSoft : colors.dangerSoft,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.marketChangeText,
                            { color: changePositive ? colors.success : colors.danger },
                          ]}
                        >
                          {changePositive ? "+" : ""}
                          {change.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.marketName, { color: colors.textPrimary }]} numberOfLines={1}>
                      {asset.name}
                    </Text>
                    <Text style={[styles.marketPrice, { color: colors.textSecondary }]}>
                      ${price > 1
                        ? price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : price.toFixed(3)}
                    </Text>
                    <View style={styles.sparklineWrapper}>
                      <Sparkline
                        data={changePositive ? [10, 12, 11, 13, 14, 15] : [15, 14, 16, 14, 12, 10]}
                        width={100}
                        height={30}
                        color={changePositive ? colors.success : colors.danger}
                        strokeWidth={2}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Holdings */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.holdingsCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ASSET HOLDINGS</Text>
            <AssetList
              assets={displayTokens}
              formatPrice={(p) => `$${p.toLocaleString()}`}
              predictedAddress={smartAccountAddress}
              onAssetPress={handleAssetPress}
            />
          </View>
        </View>
      </ScrollView>

      {selectedToken && (
        <TokenDetailModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          token={selectedToken}
          onRequestSend={(t) =>
            requireActiveOnChain(activeChainId, isActiveOnChain(activeChainId), () =>
              navigation.navigate('Send', { tokenSymbol: t.symbol }),
            )
          }
          onRequestReceive={() => requireProvisioned(isProvisioned, () => navigation.navigate('Receive'))}
          onRequestSwap={(preselect) =>
            requireActiveOnChain(activeChainId, isActiveOnChain(activeChainId), () =>
              navigation.navigate('Dex', { initialTab: 'swap', preselect }),
            )
          }
        />
      )}

      <ActivationSheet ref={activationSheetRef} />
      <SetUpWalletSheet ref={setUpRef} />
    </TabScreenContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 8,
    },
    header: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      marginBottom: 8,
    },
    headerKicker: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 2,
      color: colors.accent,
      marginBottom: 2,
    },
    headerBrand: {
      fontSize: 26,
      fontWeight: "900",
      letterSpacing: 2,
      color: colors.textPrimary,
    },
    headerLeft: {
      flex: 1,
      gap: 4,
    },
    headerChainRow: {
      flexDirection: "row",
      marginTop: 8,
    },
    sectionWrapper: {
      marginHorizontal: 20,
      marginBottom: 20,
    },
    perfCard: {
      borderRadius: 28,
      padding: 22,
      borderWidth: 1,
    },
    perfHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 6,
    },
    perfBalanceBlock: {
      flex: 1,
    },
    perfLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    perfBalanceRow: {
      flexDirection: "row",
      alignItems: "baseline",
    },
    perfCurrency: {
      fontSize: 22,
      fontWeight: "700",
      marginRight: 3,
    },
    perfBalance: {
      fontSize: 40,
      fontWeight: "800",
      letterSpacing: -1,
    },
    changeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 10,
      marginLeft: 8,
      marginTop: 4,
    },
    changeBadgeText: {
      fontSize: 12,
      fontWeight: "700",
    },
    perfDelta: {
      fontSize: 13,
      fontWeight: "500",
      marginBottom: 14,
    },
    chartWrapper: {
      height: 120,
      justifyContent: "center",
      alignItems: "center",
      marginVertical: 8,
    },
    chartEmpty: {
      fontSize: 13,
    },
    periodPicker: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderRadius: 16,
      padding: 4,
      marginTop: 14,
    },
    periodPill: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      minWidth: 44,
      alignItems: "center",
    },
    periodLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    sectionHeadRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
      paddingHorizontal: 2,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.4,
      marginBottom: 14,
    },
    refreshLabel: {
      fontSize: 13,
      fontWeight: "600",
    },
    marketScrollContent: {
      paddingRight: 4,
    },
    marketLoadingWrapper: {
      width: width - 40,
      height: 140,
      justifyContent: "center",
      alignItems: "center",
    },
    marketCard: {
      width: 150,
      padding: 16,
      borderRadius: 22,
      borderWidth: 1,
      marginRight: 12,
    },
    marketCardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    marketChangePill: {
      paddingHorizontal: 6,
      paddingVertical: 4,
      borderRadius: 8,
    },
    marketChangeText: {
      fontSize: 10,
      fontWeight: "700",
    },
    marketName: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 3,
    },
    marketPrice: {
      fontSize: 13,
      fontWeight: "500",
      marginBottom: 10,
    },
    sparklineWrapper: {
      height: 30,
    },
    holdingsCard: {
      borderRadius: 22,
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderWidth: 1,
    },
  });

export default PortfolioScreen;
