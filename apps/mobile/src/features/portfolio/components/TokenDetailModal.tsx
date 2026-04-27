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

  if (!token) return null;

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
      'BNB': 'binancecoin',
      'XRP': 'ripple',
      'ADA': 'cardano',
      'AVAX': 'avalanche-2',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'MATIC': 'polygon',
      'OP': 'optimism',
      'ARB': 'arbitrum',
    };
    return map[token.symbol] || token.name.toLowerCase().replace(/\s+/g, '-');
  }, [token]);

  const { history: chartData, loading: chartLoading } = useAssetHistory(coinId, selectedPeriod);

  React.useEffect(() => {
    if (visible && coinId) {
      marketService.getAssetDetails(coinId).then(details => {
        if (details) setMarketDetails(details);
      });
    }
  }, [visible, coinId]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: glassBackground, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTitleRow}>
              <TokenIcon symbol={token.symbol} address={token.address} size={32} />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{token.name}</Text>
            </View>
            <TouchableOpacity style={styles.actionIcon}>
              <Feather name="star" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
 
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* Price Hero */}
            <View style={styles.priceHero}>
              <Text style={[styles.currentPrice, { color: colors.textPrimary }]}>
                ${(token.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </Text>
              <View style={[styles.priceChange, { backgroundColor: withAlpha(parseFloat(marketDetails?.changePercent24Hr || '0') >= 0 ? colors.success : colors.danger, 0.1) }]}>
                <Feather name={parseFloat(marketDetails?.changePercent24Hr || '0') >= 0 ? "trending-up" : "trending-down"} size={14} color={parseFloat(marketDetails?.changePercent24Hr || '0') >= 0 ? colors.success : colors.danger} />
                <Text style={[styles.priceChangeText, { color: parseFloat(marketDetails?.changePercent24Hr || '0') >= 0 ? colors.success : colors.danger }]}>
                  {parseFloat(marketDetails?.changePercent24Hr || '0').toFixed(2)}% (24h)
                </Text>
              </View>
            </View>
 
            {/* Main Chart */}
            <View style={styles.chartContainer}>
              {chartLoading ? (
                <View style={{ height: 180, justifyContent: 'center' }}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : (
                <Sparkline 
                  data={chartData.length > 0 ? chartData : [0,0]} 
                  width={width - 48} 
                  height={180} 
                  color={parseFloat(marketDetails?.changePercent24Hr || '0') >= 0 ? colors.accentAlt : colors.danger} 
                  strokeWidth={3} 
                />
              )}
              <View style={styles.chartFilters}>
                {['1D', '1W', '1M', '1Y', 'ALL'].map(p => (
                  <TouchableOpacity 
                    key={p} 
                    onPress={() => setSelectedPeriod(p)}
                    style={[styles.filterPill, selectedPeriod === p && { backgroundColor: colors.accent }]}
                  >
                    <Text style={[styles.filterText, { color: selectedPeriod === p ? colors.textOnAccent : colors.textSecondary }]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Holdings Card */}
            <View style={[styles.infoCard, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}>
              <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>YOUR BALANCE</Text>
              <View style={styles.holdingRow}>
                <View>
                  <Text style={[styles.holdingValue, { color: colors.textPrimary }]}>
                    {token.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} {token.symbol}
                  </Text>
                  <Text style={[styles.holdingFiat, { color: colors.textSecondary }]}>
                    ${token.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </View>
                <TouchableOpacity style={[styles.tradeButton, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.tradeButtonText, { color: colors.textOnAccent }]}>Swap</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Token Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Market Cap</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  ${marketDetails ? (parseFloat(marketDetails.marketCapUsd) / 1000000000).toFixed(2) + 'B' : '---'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>24h Volume</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                   ${marketDetails ? (parseFloat(marketDetails.volumeUsd24Hr) / 1000000).toFixed(2) + 'M' : '---'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Supply</Text>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                  {marketDetails ? (parseFloat(marketDetails.supply) / 1000000).toFixed(1) + 'M' : '---'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Rank</Text>
                <Text style={[styles.statValue, { color: colors.accentAlt }]}>
                  #{marketDetails?.rank || '---'}
                </Text>
              </View>
            </View>

            {/* About Section */}
            <View style={styles.aboutSection}>
              <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>MARKET INSIGHT</Text>
              <Text style={[styles.aboutText, { color: colors.textSecondary }]}>
                {token.name} ({token.symbol}) is currently ranked #{marketDetails?.rank} in the global crypto market. 
                Its price has shifted {parseFloat(marketDetails?.changePercent24Hr || '0').toFixed(2)}% in the last 24 hours 
                with a trading volume of ${marketDetails ? (parseFloat(marketDetails.volumeUsd24Hr) / 1000000).toFixed(2) + 'M' : '---'}.
              </Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  content: {
    height: height * 0.85,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: 1,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollBody: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  priceHero: {
    alignItems: 'center',
    marginVertical: 20,
    gap: 8,
  },
  currentPrice: {
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
  },
  priceChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priceChangeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  chartContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  chartFilters: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    marginVertical: 10,
    gap: 12,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  holdingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  holdingValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  holdingFiat: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  tradeButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
  },
  tradeButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 20,
    gap: 16,
  },
  statItem: {
    width: (width - 64) / 2,
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  aboutSection: {
    gap: 12,
    marginTop: 10,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
  },
});
