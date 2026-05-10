import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { TokenIcon, InteractiveChart } from '@shared/components';
import type { TokenBalance } from '@features/portfolio/services/PortfolioService';
import { marketService } from '@services/MarketService';
import { useAssetHistory } from '@hooks/useMarketData';
import { useUserHoldsToken } from '@features/wallet/hooks/useUserHoldsToken';
import { isTokenSwappableOnTestnet } from '@services/market/testnetBias';

const { width } = Dimensions.get('window');

interface TokenDetailModalProps {
  visible: boolean;
  onClose: () => void;
  token: TokenBalance | null;
  onRequestSend?: (token: TokenBalance) => void;
  onRequestReceive?: () => void;
  onRequestSwap?: (preselect: { symbol: string; side: 'in' | 'out' }) => void;
}

export const TokenDetailModal: React.FC<TokenDetailModalProps> = ({
  visible,
  onClose,
  token,
  onRequestSend,
  onRequestReceive,
  onRequestSwap,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const symbol = token?.symbol ?? '';
  const swappable = isTokenSwappableOnTestnet(symbol);
  const userHolds = useUserHoldsToken(symbol);

  const [selectedPeriod, setSelectedPeriod] = React.useState('1W');
  const [marketDetails, setMarketDetails] = React.useState<any>(null);

  const coinId = React.useMemo(() => {
    if (!token) return '';
    const map: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'SOL': 'solana',
      'BNB': 'binance-coin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'AVAX': 'avalanche',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'MATIC': 'polygon',
      'POL': 'polygon',
      'OP': 'optimism',
      'ARB': 'arbitrum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'multi-collateral-dai',
      'TAO': 'bittensor',
    };
    return map[token.symbol] || token.name.toLowerCase().replace(/\s+/g, '-');
  }, [token]);

  const { history: chartData, loading: chartLoading } = useAssetHistory(coinId, selectedPeriod);

  // Period % change — computed from first/last chart data points
  const periodChange = React.useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    if (!first) return null;
    return ((last - first) / first) * 100;
  }, [chartData]);

  // Fallback: use 24h from API or token prop until chartData loads
  const displayChange = periodChange ?? parseFloat(marketDetails?.changePercent24Hr ?? String(token?.change24h ?? 0));
  const isPositive = displayChange >= 0;
  const chartColor = isPositive ? colors.success : colors.danger;

  React.useEffect(() => {
    if (visible && coinId) {
      setMarketDetails(null);
      marketService.getAssetDetails(coinId).then((details: any) => {
        if (details) setMarketDetails(details);
      });
    }
  }, [visible, coinId]);

  if (!token) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismissOverlay} onPress={onClose} activeOpacity={1} />
        <View style={[styles.content, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <TokenIcon symbol={token.symbol} size={28} />
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{token.name}</Text>
                <Text style={[styles.headerSymbol, { color: colors.textSecondary }]}>{token.symbol}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.glass }]}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Price + change badge */}
            <View style={styles.priceHero}>
              <Text style={[styles.currentPrice, { color: colors.textPrimary }]}>
                ${(token.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              <View style={[styles.priceChange, { backgroundColor: isPositive ? colors.successSoft : colors.dangerSoft }]}>
                <Text style={[styles.priceChangeText, { color: isPositive ? colors.success : colors.danger }]}>
                  {isPositive ? '+' : ''}{displayChange.toFixed(2)}%
                </Text>
              </View>
            </View>

            {/* Holdings row (portfolio tokens only) */}
            {token.value > 0 && (
              <View style={[styles.holdingRow, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.holdingLabel, { color: colors.textMuted }]}>MY HOLDING</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.holdingValue, { color: colors.textPrimary }]}>
                    ${token.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Text>
                  <Text style={[styles.holdingAmount, { color: colors.textSecondary }]}>
                    {token.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {token.symbol}
                  </Text>
                </View>
              </View>
            )}

            {/* Interactive chart */}
            <View style={styles.chartContainer}>
              {chartLoading ? (
                <View style={{ height: 140, justifyContent: 'center' }}>
                  <ActivityIndicator color={colors.accent} size="small" />
                </View>
              ) : (
                <InteractiveChart
                  data={chartData.length > 0 ? chartData : [0, 0]}
                  chartWidth={width - 80}
                  chartHeight={140}
                  color={chartColor}
                />
              )}
              {/* Period selector */}
              <View style={styles.chartFilters}>
                {['1D', '1W', '1M', '1Y'].map(p => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setSelectedPeriod(p)}
                    style={[styles.filterPill, selectedPeriod === p && { backgroundColor: `${colors.accent}1A` }]}
                  >
                    <Text style={[styles.filterText, { color: selectedPeriod === p ? colors.accent : colors.textSecondary }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Stats grid */}
            <View style={[styles.statsGrid, { borderTopColor: colors.border }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>MARKET CAP</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {(() => {
                    const cap = marketDetails ? parseFloat(marketDetails.marketCapUsd) : 0;
                    if (!cap) return '---';
                    if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
                    return `$${(cap / 1e6).toFixed(2)}M`;
                  })()}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>24H VOLUME</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {(() => {
                    const vol = marketDetails ? parseFloat(marketDetails.volumeUsd24Hr) : 0;
                    if (!vol) return '---';
                    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`;
                    return `$${(vol / 1e6).toFixed(2)}M`;
                  })()}
                </Text>
              </View>
            </View>

            {/* Send / Receive / Swap action row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionTile, { backgroundColor: `${colors.accent}1A` }]}
                onPress={() => { onClose(); onRequestSend?.(token); }}
                activeOpacity={0.75}
              >
                <Feather name="arrow-up-right" size={20} color={colors.accent} />
                <Text style={[styles.actionTileLabel, { color: colors.accent }]}>Send</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionTile, { backgroundColor: `${colors.accent}1A` }]}
                onPress={() => { onClose(); onRequestReceive?.(); }}
                activeOpacity={0.75}
              >
                <Feather name="arrow-down-left" size={20} color={colors.accent} />
                <Text style={[styles.actionTileLabel, { color: colors.accent }]}>Receive</Text>
              </TouchableOpacity>

              {swappable ? (
                <TouchableOpacity
                  style={[styles.actionTile, { backgroundColor: `${colors.accent}1A` }]}
                  onPress={() => { onClose(); onRequestSwap?.({ symbol: token.symbol, side: userHolds ? 'in' : 'out' }); }}
                  activeOpacity={0.75}
                >
                  <Feather name="repeat" size={20} color={colors.accent} />
                  <Text style={[styles.actionTileLabel, { color: colors.accent }]}>Swap</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.actionTile, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.notAvailableText, { color: colors.textMuted }]}>Not available</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    width: width * 0.88,
    borderRadius: 28,
    borderWidth: 1,
    paddingTop: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSymbol: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.6,
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  priceHero: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
    gap: 10,
  },
  currentPrice: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  priceChange: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  priceChangeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  holdingLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  holdingValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  holdingAmount: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  chartContainer: {
    marginVertical: 10,
    alignItems: 'center',
  },
  chartFilters: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  filterText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 24,
    paddingTop: 20,
    borderTopWidth: 1,
  },
  statItem: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    marginBottom: 8,
  },
  actionTile: {
    flex: 1,
    height: 64,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionTileLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  notAvailableText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
