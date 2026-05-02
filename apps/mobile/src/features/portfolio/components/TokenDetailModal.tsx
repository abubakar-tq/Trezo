import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import { TokenIcon, Sparkline } from '@shared/components';
import type { TokenBalance } from '@features/portfolio/services/PortfolioService';
import { marketService } from '@services/MarketService';
import { useAssetHistory } from '@hooks/useMarketData';
import { ActivityIndicator } from 'react-native';

const { width, height } = Dimensions.get('window');

interface TokenDetailModalProps {
  visible: boolean;
  onClose: () => void;
  token: TokenBalance | null;
}

export const TokenDetailModal: React.FC<TokenDetailModalProps> = ({ visible, onClose, token }) => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;

  const isDark = resolvedMode === 'dark';
  const glassBackground = isDark ? 'rgba(25, 25, 25, 0.95)' : '#FFFFFF';

  // State for chart filter
  const [selectedPeriod, setSelectedPeriod] = React.useState('1W');
  const [marketDetails, setMarketDetails] = React.useState<any>(null);

  // Map symbol to CoinCap ID (simplified for top assets)
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

  React.useEffect(() => {
    if (visible && coinId) {
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
        <View style={[styles.content, { backgroundColor: glassBackground, borderColor: colors.border }]}>
          {/* Header Compact */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <TokenIcon symbol={token.symbol} address={token.address} size={28} />
              <View>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{token.name}</Text>
                <Text style={[styles.headerSymbol, { color: colors.textSecondary }]}>{token.symbol}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
 
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Price Hero Compact */}
            <View style={styles.priceHero}>
              <Text style={[styles.currentPrice, { color: colors.textPrimary }]}>
                ${(token.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              <View style={[styles.priceChange, { backgroundColor: withAlpha(parseFloat(marketDetails?.changePercent24Hr || '0') >= 0 ? colors.success : colors.danger, 0.1) }]}>
                <Text style={[styles.priceChangeText, { color: parseFloat(marketDetails?.changePercent24Hr || '0') >= 0 ? colors.success : colors.danger }]}>
                  {parseFloat(marketDetails?.changePercent24Hr || '0') >= 0 ? '+' : ''}{parseFloat(marketDetails?.changePercent24Hr || '0').toFixed(2)}%
                </Text>
              </View>
            </View>
 
            {/* Minimal Chart */}
            <View style={styles.chartContainer}>
              {chartLoading ? (
                <View style={{ height: 100, justifyContent: 'center' }}>
                  <ActivityIndicator color={colors.accent} size="small" />
                </View>
              ) : (
                <Sparkline 
                  data={chartData.length > 0 ? chartData : [0,0]} 
                  width={width - 80} 
                  height={100} 
                  color={parseFloat(marketDetails?.changePercent24Hr || '0') >= 0 ? colors.accent : colors.danger} 
                  strokeWidth={2.5} 
                />
              )}
              <View style={styles.chartFilters}>
                {['1D', '1W', '1M', '1Y'].map(p => (
                  <TouchableOpacity 
                    key={p} 
                    onPress={() => setSelectedPeriod(p)}
                    style={[styles.filterPill, selectedPeriod === p && { backgroundColor: withAlpha(colors.accent, 0.1) }]}
                  >
                    <Text style={[styles.filterText, { color: selectedPeriod === p ? colors.accent : colors.textSecondary }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Pinpoint Stats Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>MARKET CAP</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  ${marketDetails ? (parseFloat(marketDetails.marketCapUsd) / 1000000000).toFixed(2) + 'B' : '---'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>24H VOLUME</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                   ${marketDetails ? (parseFloat(marketDetails.volumeUsd24Hr) / 1000000).toFixed(2) + 'M' : '---'}
                </Text>
              </View>
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
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    borderTopColor: 'rgba(255,255,255,0.05)',
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
  tradeButton: {
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tradeButtonText: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});
