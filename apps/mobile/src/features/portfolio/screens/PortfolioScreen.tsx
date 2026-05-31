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
import { TabScreenContainer, InteractiveChart } from "@shared/components";
import { FontFamilies } from "@shared/components/TokenRegistry";
import { TokenIcon } from "@shared/components/visuals/TokenIcon";
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
import type { TokenDetailModalHandle } from "../components/TokenDetailModal";
import type { TokenBalance } from "../services/PortfolioService";
import { usePortfolioSnapshots } from "../hooks/usePortfolioSnapshots";
import { enabledPeriods, disabledPeriodMessage, valueChange } from "../utils/portfolioChart";
import type { Period } from "../utils/portfolioChart";
import { computeAllocation } from "../utils/allocation";
import { popularTestnetTokens } from "../utils/popularTestnet";
import { resolveNetworkKey, type SupportedChainId } from "@/src/integration/networks";

const { width } = Dimensions.get("window");

// Allocation bar color palette is built from theme tokens inside the component
// (allocColorAt is a closure over theme colors, not a module-level const).
// Violet family only — no rainbow.

const PERIODS: Period[] = ["1D", "1W", "1M", "1Y", "ALL"];

const PortfolioScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Allocation bar palette resolved from theme tokens — violet family, no rainbow.
  const ALLOC_COLORS = useMemo(() => [
    colors.accent,                          // primary violet
    colors.accentAlt,                       // secondary cyan
    `${colors.accent}72`,                   // violet muted
    `${colors.accentAlt}66`,                // cyan muted
    `${colors.accent}40`,                   // violet faint
    "rgba(142, 139, 133, 0.45)",            // neutral tint (no token equivalent)
  ], [colors]);

  const allocColorAt = (index: number): string =>
    ALLOC_COLORS[index % ALLOC_COLORS.length];
  const contentBottomInset = useTabContentBottomInset();
  const navigation = useNavigation<any>();

  const { isActiveOnChain, isProvisioned } = useAccountState();
  const activeChainId = useWalletStore((s) => s.activeChainId);
  const { ref: activationSheetRef, requireActiveOnChain } = useActivationSheet();
  const { ref: setUpRef, requireProvisioned } = useSetUpWalletSheet();

  // Mirror HomeScreen: per-chain aa_wallets address is source of truth.
  const aaAccountAddress = useWalletStore((s) => s.aaAccount?.predictedAddress);
  const globalSmartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const smartAccountAddress = (aaAccountAddress ?? globalSmartAccountAddress) as string | null;

  const { totalBalanceUSD, tokens, isLoading: walletLoading } = useWalletData(smartAccountAddress ?? undefined);
  // Market feed — used for 24h change per token and 1D chart data
  const { assets: marketAssets } = useMarketData(20);

  const [selectedPeriod, setSelectedPeriod] = useState<Period>("1W");
  const tokenDetailRef = React.useRef<TokenDetailModalHandle>(null);
  const [touchedValue, setTouchedValue] = useState<number | null>(null);

  const handleAssetPress = (token: TokenBalance) => {
    tokenDetailRef.current?.open(token);
  };

  // Build displayTokens — change24h is NOT hardcoded; joined from market feed below
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
        change24h: 0, // placeholder; real value resolved from market feed per row
        decimals: (t.decimals as number) || 18,
        address: (t.token_address || "0x") as `0x${string}`,
      };
    });
  }, [tokens]);

  // 24h change map: symbol → changePercent24Hr (from market feed)
  const change24hBySymbol = useMemo(() => {
    const map: Record<string, number> = {};
    marketAssets.forEach((a) => {
      const pct = parseFloat(a.changePercent24Hr);
      if (isFinite(pct)) map[a.symbol.toUpperCase()] = pct;
    });
    return map;
  }, [marketAssets]);

  // Snapshot hook: provides walletAge + seriesForPeriod(1W/1M/1Y/ALL)
  const { walletAge, seriesForPeriod } = usePortfolioSnapshots(
    totalBalanceUSD,
    smartAccountAddress,
    typeof activeChainId === "number" ? activeChainId : undefined
  );

  // 1D series: use existing usePortfolioHistory (current holdings × intraday price feed)
  const { history: history1D, loading: loading1D } = usePortfolioHistory(displayTokens, "1D");

  // Resolve which periods are gated
  const enabled = useMemo(() => enabledPeriods(walletAge), [walletAge]);

  // Chart data: 1D from price-feed, 1W+ from snapshots
  const chartSeries = useMemo((): number[] => {
    if (selectedPeriod === "1D") return history1D;
    return seriesForPeriod(selectedPeriod);
  }, [selectedPeriod, history1D, seriesForPeriod]);

  const chartLoading = selectedPeriod === "1D" ? loading1D : false;

  // Headline change — deposit-adjusted via valueChange helper.
  // TODO: netFlows = deposits-withdrawals for the window (deposit-adjustment hook, deferred to future pass).
  const headlineChange = useMemo(() => {
    if (chartSeries.length < 2) return null;
    return valueChange(chartSeries[0], chartSeries[chartSeries.length - 1], 0);
  }, [chartSeries]);

  const isPositive = (headlineChange?.pct ?? 0) >= 0;
  const chartColor = isPositive ? colors.dataPositive : colors.dataNegative;

  const displayedBalance = touchedValue ?? totalBalanceUSD;

  const formatBalance = (val: number) =>
    val >= 1e9
      ? `${(val / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`
      : val >= 1e6
        ? `${(val / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
        : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Period picker handler — disabled periods show a warm message, do NOT switch
  const handlePeriodPress = (period: Period) => {
    if (!enabled[period]) {
      const msg = disabledPeriodMessage(period, walletAge);
      Alert.alert("Not ready yet", msg);
      return;
    }
    setSelectedPeriod(period);
    setTouchedValue(null);
  };

  // Allocation bar — from holdings
  const allocation = useMemo(() => {
    const holdings = displayTokens.map((t) => ({ symbol: t.symbol, valueUsd: t.value }));
    return computeAllocation(holdings);
  }, [displayTokens]);

  // Holdings sorted by value DESC
  const sortedHoldings = useMemo(
    () => [...displayTokens].sort((a, b) => b.value - a.value),
    [displayTokens]
  );

  const totalValue = useMemo(
    () => displayTokens.reduce((s, t) => s + t.value, 0),
    [displayTokens]
  );

  // Popular shelf — chain-aware
  let networkKey = "ethereum-sepolia"; // safe fallback
  try {
    if (typeof activeChainId === "number") {
      networkKey = resolveNetworkKey(activeChainId as SupportedChainId);
    }
  } catch {
    // keep fallback
  }
  const popularTokens = useMemo(() => popularTestnetTokens(networkKey), [networkKey]);

  const isEmpty = !walletLoading && totalBalanceUSD === 0;

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Portfolio</Text>
      <View style={styles.headerChainRow}>
        <ChainSwitcherChip
          onError={(message) => Alert.alert("Could not switch chain", message)}
        />
      </View>
    </View>
  );

  const renderPerformanceCard = () => {
    if (isEmpty) return null;

    return (
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

            {headlineChange !== null ? (
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
                  color={isPositive ? colors.dataPositive : colors.dataNegative}
                />
                <Text
                  style={[
                    styles.changeBadgeText,
                    { color: isPositive ? colors.dataPositive : colors.dataNegative },
                  ]}
                >
                  {isPositive ? "+" : ""}
                  {headlineChange.pct.toFixed(2)}%
                </Text>
              </View>
            ) : chartLoading ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : null}
          </View>

          {/* USD delta */}
          {headlineChange !== null ? (
            <Text
              style={[
                styles.perfDelta,
                { color: isPositive ? colors.dataPositive : colors.dataNegative },
              ]}
            >
              {headlineChange.delta >= 0 ? "+" : ""}$
              {Math.abs(headlineChange.delta).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Text>
          ) : !chartLoading ? (
            <Text style={[styles.perfDelta, { color: colors.textMuted }]}>
              Drag chart to explore history
            </Text>
          ) : null}

          {/* Chart */}
          <View style={styles.chartWrapper}>
            {chartLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : chartSeries.length >= 2 ? (
              <InteractiveChart
                data={chartSeries}
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
                {walletLoading ? "Loading wallet…" : "No historical data yet"}
              </Text>
            )}
          </View>

          {/* Period picker — disabled = dimmed, NO lock icon */}
          <View style={[styles.periodPicker, { backgroundColor: colors.glass }]}>
            {PERIODS.map((period) => {
              const isEnabled = enabled[period];
              const isSelected = selectedPeriod === period;
              return (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.periodPill,
                    isSelected && { backgroundColor: colors.accent },
                  ]}
                  onPress={() => handlePeriodPress(period)}
                  activeOpacity={isEnabled ? 0.7 : 0.5}
                >
                  <Text
                    style={[
                      styles.periodLabel,
                      {
                        color: isSelected
                          ? colors.textOnAccent
                          : isEnabled
                            ? colors.textSecondary
                            : colors.textMuted,
                        opacity: isEnabled ? 1 : 0.45,
                      },
                    ]}
                  >
                    {period}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderAllocation = () => {
    if (isEmpty || allocation.length === 0) return null;

    return (
      <View style={styles.sectionWrapper}>
        <View style={[styles.allocationCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ALLOCATION</Text>

          {/* Stacked horizontal bar */}
          <View style={styles.allocBar}>
            {allocation.map((seg, i) => (
              <View
                key={seg.symbol}
                style={[
                  styles.allocSegment,
                  {
                    width: `${seg.pct}%`,
                    backgroundColor: allocColorAt(i),
                    borderTopLeftRadius: i === 0 ? 8 : 0,
                    borderBottomLeftRadius: i === 0 ? 8 : 0,
                    borderTopRightRadius: i === allocation.length - 1 ? 8 : 0,
                    borderBottomRightRadius: i === allocation.length - 1 ? 8 : 0,
                  },
                ]}
              />
            ))}
          </View>

          {/* Key */}
          <View style={styles.allocKey}>
            {allocation.map((seg, i) => (
              <View key={seg.symbol} style={styles.allocKeyRow}>
                <View style={[styles.allocDot, { backgroundColor: allocColorAt(i) }]} />
                <Text style={[styles.allocKeySymbol, { color: colors.textSecondary }]}>
                  {seg.symbol}
                </Text>
                <Text style={[styles.allocKeyPct, { color: colors.textMuted }]}>
                  {seg.pct.toFixed(1)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderHoldings = () => {
    if (isEmpty) {
      // Empty state: single ETH row at 0.00 — NOT the fake multi-token AssetList placeholder
      return (
        <View style={styles.sectionWrapper}>
          <View style={[styles.holdingsCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ASSETS</Text>

            {/* Fund your wallet prompt */}
            <View style={[styles.emptyPrompt, { borderColor: colors.border }]}>
              <Text style={[styles.emptyPromptTitle, { color: colors.textPrimary }]}>
                Fund your wallet
              </Text>
              <Text style={[styles.emptyPromptSub, { color: colors.textSecondary }]}>
                Buy ETH or receive crypto to get started.
              </Text>
              <View style={styles.emptyActions}>
                <TouchableOpacity
                  style={[styles.emptyActionPrimary, { backgroundColor: colors.accent }]}
                  onPress={() =>
                    requireProvisioned(isProvisioned, () => navigation.navigate("Buy"))
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[styles.emptyActionPrimaryText, { color: colors.textOnAccent }]}>
                    Buy ETH
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.emptyActionSecondary, { borderColor: colors.border }]}
                  onPress={() =>
                    requireProvisioned(isProvisioned, () => navigation.navigate("Receive"))
                  }
                  activeOpacity={0.8}
                >
                  <Text style={[styles.emptyActionSecondaryText, { color: colors.textPrimary }]}>
                    Receive
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Single native ETH row at 0.00 — honest, not a fake list */}
            <View style={[styles.holdingRow, { borderBottomWidth: 0 }]}>
              <View style={styles.holdingLeft}>
                <TokenIcon symbol="ETH" size={44} style={{ borderRadius: 999 }} />
                <View style={styles.holdingNameBlock}>
                  <Text style={[styles.holdingSymbol, { color: colors.textPrimary }]}>ETH</Text>
                  <Text style={[styles.holdingName, { color: colors.textSecondary }]}>Ethereum</Text>
                </View>
              </View>
              <View style={styles.holdingRight}>
                <Text style={[styles.holdingValue, { color: colors.textMuted }]}>$0.00</Text>
                <Text style={[styles.holdingAmount, { color: colors.textMuted }]}>0.00 ETH</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.sectionWrapper}>
        <View style={[styles.holdingsCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ASSET HOLDINGS</Text>
          {sortedHoldings.map((token, index) => {
            const change24h = change24hBySymbol[token.symbol.toUpperCase()];
            const has24h = change24h !== undefined;
            const changePositive = has24h && change24h >= 0;
            const sharePct = totalValue > 0 ? (token.value / totalValue) * 100 : 0;
            return (
              <TouchableOpacity
                key={`${token.address}-${index}`}
                style={[
                  styles.holdingRow,
                  index !== sortedHoldings.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  },
                ]}
                onPress={() => handleAssetPress(token)}
                activeOpacity={0.7}
              >
                <View style={styles.holdingLeft}>
                  <TokenIcon
                    symbol={token.symbol}
                    address={token.address}
                    size={44}
                    style={{ borderRadius: 999 }}
                  />
                  <View style={styles.holdingNameBlock}>
                    <Text
                      style={[styles.holdingSymbol, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {token.symbol}
                    </Text>
                    <Text
                      style={[styles.holdingName, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {token.name}
                    </Text>
                  </View>
                </View>
                <View style={styles.holdingRight}>
                  <Text
                    style={[styles.holdingValue, { color: colors.textPrimary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    ${token.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <View style={styles.holdingMeta}>
                    <Text style={[styles.holdingShare, { color: colors.textMuted }]}>
                      {sharePct.toFixed(1)}%
                    </Text>
                    {has24h ? (
                      <Text
                        style={[
                          styles.holding24h,
                          {
                            color: changePositive ? colors.dataPositive : colors.dataNegative,
                          },
                        ]}
                      >
                        {changePositive ? "+" : ""}
                        {change24h.toFixed(2)}%
                      </Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderPopularShelf = () => (
    <View style={styles.sectionWrapper}>
      <View style={[styles.popularCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>POPULAR ON TESTNET</Text>
        {popularTokens.map((pt) => (
          <View
            key={pt.symbol}
            style={[
              styles.popularRow,
              {
                borderBottomWidth:
                  popularTokens.indexOf(pt) !== popularTokens.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.popularLeft}>
              <TokenIcon symbol={pt.symbol} size={40} style={{ borderRadius: 999 }} />
              <Text style={[styles.popularSymbol, { color: colors.textPrimary }]}>
                {pt.symbol}
              </Text>
            </View>
            {pt.action === "buy" ? (
              <TouchableOpacity
                style={[styles.popularActionBtn, { backgroundColor: colors.accent }]}
                onPress={() =>
                  requireProvisioned(isProvisioned, () => navigation.navigate("Buy"))
                }
                activeOpacity={0.8}
              >
                <Text style={[styles.popularActionText, { color: colors.textOnAccent }]}>
                  Buy
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.popularActionBtn, { backgroundColor: colors.accentSoft }]}
                onPress={() =>
                  requireActiveOnChain(activeChainId, isActiveOnChain(activeChainId), () =>
                    navigation.navigate("Dex", {
                      initialTab: "swap",
                      preselect: { symbol: pt.symbol, side: "out" },
                    })
                  )
                }
                activeOpacity={0.8}
              >
                <Text style={[styles.popularActionText, { color: colors.accent }]}>
                  Swap
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <TabScreenContainer includeBottomInset>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: contentBottomInset + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}
        {renderPerformanceCard()}
        {renderAllocation()}
        {renderHoldings()}
        {renderPopularShelf()}
      </ScrollView>

      <TokenDetailModal
        ref={tokenDetailRef}
        onRequestSend={(t) =>
          requireActiveOnChain(activeChainId, isActiveOnChain(activeChainId), () =>
            navigation.navigate("Send", { tokenSymbol: t.symbol })
          )
        }
        onRequestReceive={() =>
          requireProvisioned(isProvisioned, () => navigation.navigate("Receive"))
        }
        onRequestSwap={(preselect) =>
          requireActiveOnChain(activeChainId, isActiveOnChain(activeChainId), () =>
            navigation.navigate("Dex", { initialTab: "swap", preselect })
          )
        }
        onRequestBuy={() => requireProvisioned(isProvisioned, () => navigation.navigate("Buy"))}
      />

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
    // ── Header ────────────────────────────────────────────────────────────────
    header: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      marginBottom: 8,
      gap: 8,
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: "700",
      letterSpacing: -0.3,
    },
    headerChainRow: {
      flexDirection: "row",
    },
    // ── Section wrapper ───────────────────────────────────────────────────────
    sectionWrapper: {
      marginHorizontal: 20,
      marginBottom: 20,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.4,
      marginBottom: 14,
    },
    // ── Performance card ──────────────────────────────────────────────────────
    perfCard: {
      borderRadius: 28,
      padding: 20,
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
      fontFamily: FontFamilies.mono,
    },
    perfBalance: {
      fontSize: 40,
      fontWeight: "300",
      letterSpacing: -1,
      fontFamily: FontFamilies.mono,
    },
    changeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: 12, // normalized from 10 → 12 (locked scale)
      marginLeft: 8,
      marginTop: 4,
    },
    changeBadgeText: {
      fontSize: 12,
      fontWeight: "700",
      fontFamily: FontFamilies.mono,
    },
    perfDelta: {
      fontSize: 13,
      fontWeight: "500",
      marginBottom: 14,
      fontFamily: FontFamilies.mono,
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
    // ── Allocation card ───────────────────────────────────────────────────────
    allocationCard: {
      borderRadius: 20, // locked scale: glass-details/modals = 20
      padding: 20,
      borderWidth: 1,
    },
    allocBar: {
      flexDirection: "row",
      height: 12,
      borderRadius: 8,
      overflow: "hidden",
      marginBottom: 16,
    },
    allocSegment: {
      height: "100%",
    },
    allocKey: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    allocKeyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    allocDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    allocKeySymbol: {
      fontSize: 12,
      fontWeight: "600",
    },
    allocKeyPct: {
      fontSize: 12,
      fontWeight: "500",
      fontFamily: FontFamilies.mono,
    },
    // ── Holdings card ─────────────────────────────────────────────────────────
    holdingsCard: {
      borderRadius: 20, // normalized from 22 → 20 (locked scale)
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderWidth: 1,
    },
    holdingRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 14,
      minHeight: 72,
    },
    holdingLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 0.6,
      gap: 14,
    },
    holdingNameBlock: {
      flex: 1,
      justifyContent: "center",
    },
    holdingSymbol: {
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.3,
      color: colors.textPrimary,
    },
    holdingName: {
      fontSize: 12,
      fontWeight: "500",
      marginTop: 2,
    },
    holdingRight: {
      flex: 0.4,
      alignItems: "flex-end",
      justifyContent: "center",
      marginLeft: 8,
    },
    holdingValue: {
      fontSize: 15,
      fontWeight: "700",
      textAlign: "right",
      fontFamily: FontFamilies.mono,
    },
    holdingMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 3,
    },
    holdingShare: {
      fontSize: 11,
      fontWeight: "500",
      fontFamily: FontFamilies.mono,
    },
    holding24h: {
      fontSize: 11,
      fontWeight: "700",
      fontFamily: FontFamilies.mono,
    },
    holdingAmount: {
      fontSize: 12,
      fontWeight: "500",
      fontFamily: FontFamilies.mono,
      textAlign: "right",
    },
    // ── Empty state ───────────────────────────────────────────────────────────
    emptyPrompt: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 20,
      marginBottom: 16,
      alignItems: "center",
    },
    emptyPromptTitle: {
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 6,
      textAlign: "center",
    },
    emptyPromptSub: {
      fontSize: 13,
      fontWeight: "400",
      textAlign: "center",
      marginBottom: 20,
      lineHeight: 18,
    },
    emptyActions: {
      flexDirection: "row",
      gap: 12,
    },
    emptyActionPrimary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: "center",
    },
    emptyActionPrimaryText: {
      fontSize: 14,
      fontWeight: "700",
    },
    emptyActionSecondary: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1,
      alignItems: "center",
    },
    emptyActionSecondaryText: {
      fontSize: 14,
      fontWeight: "600",
    },
    // ── Popular shelf ─────────────────────────────────────────────────────────
    popularCard: {
      borderRadius: 20, // locked scale
      paddingVertical: 18,
      paddingHorizontal: 20,
      borderWidth: 1,
    },
    popularRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
    },
    popularLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
    popularSymbol: {
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: 0.3,
    },
    popularActionBtn: {
      paddingHorizontal: 20,
      paddingVertical: 8,
      borderRadius: 999,
    },
    popularActionText: {
      fontSize: 13,
      fontWeight: "700",
    },
  });

export default PortfolioScreen;
