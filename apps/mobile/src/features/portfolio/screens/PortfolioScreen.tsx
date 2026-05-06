import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { TabScreenContainer, MeshBackground, Sparkline, InteractiveChart } from "@shared/components";
import { AssetList } from "../../home/components/dashboard";
import { useWalletData } from "@hooks/useWalletData";
import { useMarketData } from "@hooks/useMarketData";
import { usePortfolioHistory } from "@hooks/usePortfolioHistory";
import { useTabContentBottomInset } from "@hooks";
import { useUserStore } from "../../../store/useUserStore";
import { withAlpha } from "@utils/color";
import { TokenDetailModal } from "../components/TokenDetailModal";
import type { TokenBalance } from "../services/PortfolioService";
import { TokenIcon } from "@shared/components/visuals/TokenIcon";
import { ActivityIndicator } from "react-native";
import { formatUnits } from "viem";

const { width } = Dimensions.get("window");


const PortfolioScreen: React.FC = () => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const contentBottomInset = useTabContentBottomInset();
  const isDark = resolvedMode === 'dark';

  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress) ?? "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
  const { totalBalanceUSD, tokens, isLoading: walletLoading } = useWalletData(smartAccountAddress);
  const { assets: marketAssets, loading: marketLoading, refresh: refreshMarket } = useMarketData(5);

  const [selectedPeriod, setSelectedPeriod] = useState('1W');
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [touchedValue, setTouchedValue] = useState<number | null>(null);

  const handleAssetPress = (token: TokenBalance) => {
    setSelectedToken(token);
    setModalVisible(true);
  };

  // Format tokens for AssetList
  const displayTokens = useMemo(() => {
    return tokens.map((t: any) => {
      const balance = t.balance_formatted || (t.balance ? formatUnits(t.balance, t.decimals || 18) : "0");
      return {
        symbol: t.symbol || "UNKNOWN",
        name: t.name || "Unknown Token",
        amount: parseFloat(balance),
        price: t.usd_price || 0,
        value: t.usd_value || 0,
        change24h: 0,
        address: t.token_address || "0x"
      };
    });
  }, [tokens]);

  const { history: portfolioHistory, loading: historyLoading, periodChange, periodDelta } =
    usePortfolioHistory(displayTokens, selectedPeriod);

  const isPositive = (periodChange ?? 0) >= 0;
  const chartColor = isPositive ? colors.accent : colors.danger;

  const periodLabel: Record<string, string> = {
    '1D': 'today', '1W': 'this week', '1M': 'this month', '1Y': 'this year', 'ALL': 'all time',
  };

  // While dragging the chart, show historical value; otherwise show live total
  const displayedBalance = touchedValue ?? totalBalanceUSD;

  return (
    <TabScreenContainer includeBottomInset>
      <MeshBackground intensity={isDark ? 0.3 : 0.8} />
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentBottomInset + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.headerKicker, { color: colors.accent }]}>MY VAULT</Text>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>PERFORMANCE</Text>
          </View>
          
        </View>

        {/* Unified Institutional Performance Card */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.omniCard, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.surface, borderColor: colors.border }]}>
            {/* Top Row: Balance & Growth */}
            <View style={styles.omniHeader}>
              <View>
                <Text style={[styles.omniLabel, { color: colors.textSecondary }]}>
                  {touchedValue ? 'Portfolio at point' : 'Total Portfolio'}
                </Text>
                <View style={styles.omniBalanceRow}>
                  <Text style={[styles.omniCurrency, { color: colors.textSecondary }]}>$</Text>
                  <Text style={[styles.omniBalance, { color: colors.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
                    {walletLoading ? "---" : (displayedBalance >= 1e9
                      ? `${(displayedBalance / 1e9).toLocaleString(undefined, { maximumFractionDigits: 2 })}B`
                      : displayedBalance >= 1e6
                        ? `${(displayedBalance / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 })}M`
                        : displayedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
                  </Text>
                </View>
              </View>
              {periodChange !== null ? (
                <View style={[styles.omniGrowthBadge, { backgroundColor: withAlpha(isPositive ? colors.accent : colors.danger, 0.1) }]}>
                  <Feather name={isPositive ? "trending-up" : "trending-down"} size={12} color={isPositive ? colors.accent : colors.danger} style={{ marginRight: 4 }} />
                  <Text style={[styles.omniGrowthText, { color: isPositive ? colors.accent : colors.danger }]}>
                    {isPositive ? '+' : ''}{periodChange.toFixed(2)}%
                  </Text>
                </View>
              ) : historyLoading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : null}
            </View>

            {/* Performance delta */}
            {periodDelta !== null && (
              <Text style={[styles.omniPerformance, { color: periodDelta >= 0 ? colors.success : colors.danger }]}>
                {periodDelta >= 0 ? '+' : ''}${Math.abs(periodDelta).toLocaleString(undefined, { maximumFractionDigits: 2 })} {periodLabel[selectedPeriod] ?? ''}
              </Text>
            )}
            {periodDelta === null && !historyLoading && (
              <Text style={[styles.omniPerformance, { color: colors.textSecondary }]}>
                Drag chart to explore history
              </Text>
            )}

            {/* Interactive portfolio chart */}
            <View style={styles.omniGraphWrapper}>
              {historyLoading ? (
                <ActivityIndicator color={colors.accent} />
              ) : portfolioHistory.length >= 2 ? (
                <InteractiveChart
                  data={portfolioHistory}
                  chartWidth={width - 80}
                  chartHeight={120}
                  color={chartColor}
                  onTouchValue={setTouchedValue}
                  formatTooltip={v => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                />
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '600' }}>
                  {walletLoading ? 'Loading wallet…' : 'No historical data available'}
                </Text>
              )}
            </View>
            
            {/* Period Picker */}
            <View style={styles.omniPeriodPicker}>
              {['1D', '1W', '1M', '1Y', 'ALL'].map((period) => (
                <TouchableOpacity 
                  key={period} 
                  style={[styles.omniPeriodPill, selectedPeriod === period && { backgroundColor: colors.accent }]}
                  onPress={() => setSelectedPeriod(period)}
                >
                  <Text style={[styles.omniPeriodText, { color: selectedPeriod === period ? colors.textOnAccent : colors.textSecondary }]}>{period}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Market Section - The New "Market Part" */}
        <View style={styles.sectionWrapper}>
          <View style={styles.sectionHeadingRow}>
            <Text style={[styles.sectionHeading, { color: colors.textPrimary }]}>MARKET TRENDS</Text>
            <TouchableOpacity onPress={() => refreshMarket()}>
              <Text style={[styles.seeAll, { color: colors.accent }]}>Refresh</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.marketScroll}>
            {marketLoading && marketAssets.length === 0 ? (
              <View style={{ width: width - 40, height: 140, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              marketAssets.map((asset) => {
                const price = parseFloat(asset.priceUsd);
                const change = parseFloat(asset.changePercent24Hr);
                
                return (
                  <TouchableOpacity 
                    key={asset.id} 
                    style={[styles.marketCard, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.surface, borderColor: colors.border }]}
                    onPress={() => handleAssetPress({
                      symbol: asset.symbol,
                      name: asset.name,
                      amount: 0,
                      price: price,
                      value: 0,
                      change24h: change,
                      address: asset.id
                    })}
                  >
                    <View style={styles.marketHeader}>
                      <TokenIcon symbol={asset.symbol} size={32} />
                      <View style={[styles.miniChange, { backgroundColor: withAlpha(change >= 0 ? colors.accent : colors.danger, 0.1) }]}>
                        <Text style={[styles.miniChangeText, { color: change >= 0 ? colors.accent : colors.danger }]}>
                          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.marketName, { color: colors.textPrimary }]} numberOfLines={1}>{asset.name}</Text>
                    <Text style={[styles.marketPrice, { color: colors.textSecondary }]}>
                      ${price > 1 ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : price.toFixed(3)}
                    </Text>
                    <View style={styles.miniGraph}>
                       <Sparkline 
                         data={change >= 0 ? [10, 12, 11, 13, 14, 15] : [15, 14, 16, 14, 12, 10]} 
                         width={100} 
                         height={30} 
                         color={change >= 0 ? colors.accent : colors.danger} 
                         strokeWidth={2} 
                       />
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* Holdings Section */}
        <View style={styles.sectionWrapper}>
          <View style={[styles.glassSection, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Asset Holdings</Text>
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
        />
      )}
    </TabScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  headerKicker: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 1,
  },
  headerRight: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  balanceContainer: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionWrapper: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  omniCard: {
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0,
  },
  omniHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  omniLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  omniBalanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  omniCurrency: {
    fontSize: 20,
    fontWeight: '800',
    marginRight: 2,
  },
  omniBalance: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1,
  },
  omniGrowthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 4,
  },
  omniGrowthText: {
    fontSize: 13,
    fontWeight: '800',
  },
  omniPerformance: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  omniGraphWrapper: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 8,
  },
  omniPeriodPicker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 18,
    padding: 4,
    marginTop: 12,
  },
  omniPeriodPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    minWidth: 48,
    alignItems: 'center',
  },
  omniPeriodText: {
    fontSize: 12,
    fontWeight: '800',
  },
  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  seeAll: {
    fontSize: 13,
    fontWeight: '700',
  },
  assetCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  marketScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  marketCard: {
    width: 150,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    marginRight: 12,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  marketName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  marketPrice: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  miniChange: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  miniChangeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  miniGraph: {
    height: 30,
    marginTop: 4,
  },
  assetsContainer: {
    borderRadius: 30,
    padding: 12,
    borderWidth: 1,
  },
  glassSection: {
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 25,
    borderWidth: 1,
    shadowOpacity: 0,
    elevation: 0, 
    overflow: 'visible',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 16,
  },
});

export default PortfolioScreen;
