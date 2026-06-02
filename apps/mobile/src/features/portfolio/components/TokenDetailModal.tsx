import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { type BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useAppTheme } from '@theme';
import { TokenIcon, InteractiveChart } from '@shared/components';
import { TrezoBottomSheet } from '@shared/components/sheets/TrezoBottomSheet';
import type { TokenBalance } from '@features/portfolio/services/PortfolioService';
import { marketService } from '@services/MarketService';
import { useAssetHistory } from '@hooks/useMarketData';
import { useUserHoldsToken } from '@features/wallet/hooks/useUserHoldsToken';
import { isTokenSwappableOnTestnet } from '@services/market/testnetBias';
import { useWalletStore } from '@features/wallet/store/useWalletStore';
import { resolveNetworkKey, type SupportedChainId } from '@/src/integration/networks';

export type TokenDetailModalHandle = {
  open: (t: TokenBalance) => void;
  close: () => void;
};

interface TokenDetailModalProps {
  onClose?: () => void;
  onRequestSend?: (token: TokenBalance) => void;
  onRequestReceive?: () => void;
  onRequestSwap?: (preselect: { symbol: string; side: 'in' | 'out' }) => void;
  onRequestBuy?: () => void;
}

export const TokenDetailModal = React.forwardRef<TokenDetailModalHandle, TokenDetailModalProps>(
  function TokenDetailModal({ onClose, onRequestSend, onRequestReceive, onRequestSwap, onRequestBuy }, ref) {
    const { theme } = useAppTheme();
    const { colors } = theme;
    const navigation = useNavigation<any>();

    const sheetRef = React.useRef<BottomSheetModal>(null);
    const [token, setToken] = React.useState<TokenBalance | null>(null);

    React.useImperativeHandle(ref, () => ({
      open: (t: TokenBalance) => {
        setToken(t);
        // Defer present() so the token state update is committed before the sheet opens,
        // ensuring fresh content on every open (including reopen of same sheet).
        requestAnimationFrame(() => sheetRef.current?.present());
      },
      close: () => sheetRef.current?.dismiss(),
    }));

    const symbol = token?.symbol ?? '';
    const swappable = isTokenSwappableOnTestnet(symbol);
    const userHolds = useUserHoldsToken(symbol);

    const activeChainId = useWalletStore((s) => s.activeChainId);
    let networkKey: string | undefined;
    try {
      networkKey = typeof activeChainId === 'number'
        ? resolveNetworkKey(activeChainId as SupportedChainId)
        : undefined;
    } catch {
      networkKey = undefined;
    }

    // LINK has a real pool only on base-sepolia; block swap on other chains
    const isLink = symbol.toUpperCase() === 'LINK';
    const swapAllowedHere = swappable && (!isLink || networkKey === 'base-sepolia');

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
      if (coinId) {
        setMarketDetails(null);
        marketService.getAssetDetails(coinId).then((details: any) => {
          if (details) setMarketDetails(details);
        });
      }
    }, [coinId]);

    // Responsive chart width: TrezoBottomSheet body already applies paddingHorizontal: 20 on each side
    const chartWidth = Dimensions.get('window').width - 40; // TrezoBottomSheet body: 20 + 20

    // Determine the third action tile
    const isEth = symbol.toUpperCase() === 'ETH';

    const handleDismiss = () => {
      onClose?.();
    };

    return (
      <TrezoBottomSheet
        ref={sheetRef}
        snapPoints={['85%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        onDismiss={handleDismiss}
      >
        {token ? (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <TokenIcon symbol={token.symbol} size={28} />
                <View>
                  <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{token.name}</Text>
                  <Text style={[styles.headerSymbol, { color: colors.textSecondary }]}>{token.symbol}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => { sheetRef.current?.dismiss(); onClose?.(); }} style={[styles.closeButton, { backgroundColor: colors.glass }]}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
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
              {(token.value ?? 0) > 0 && (
                <View style={[styles.holdingRow, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.holdingLabel, { color: colors.textMuted }]}>MY HOLDING</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.holdingValue, { color: colors.textPrimary }]}>
                      ${(token.value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                    chartWidth={chartWidth}
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

              {/* Action row — gated: no dead tiles */}
              <View style={styles.actionRow}>
                {/* Send — always shown */}
                <TouchableOpacity
                  style={[styles.actionTile, { backgroundColor: `${colors.accent}1A` }]}
                  onPress={() => { sheetRef.current?.dismiss(); onClose?.(); onRequestSend?.(token); }}
                  activeOpacity={0.75}
                >
                  <Feather name="arrow-up-right" size={20} color={colors.accent} />
                  <Text style={[styles.actionTileLabel, { color: colors.accent }]}>Send</Text>
                </TouchableOpacity>

                {/* Receive — always shown */}
                <TouchableOpacity
                  style={[styles.actionTile, { backgroundColor: `${colors.accent}1A` }]}
                  onPress={() => { sheetRef.current?.dismiss(); onClose?.(); onRequestReceive?.(); }}
                  activeOpacity={0.75}
                >
                  <Feather name="arrow-down-left" size={20} color={colors.accent} />
                  <Text style={[styles.actionTileLabel, { color: colors.accent }]}>Receive</Text>
                </TouchableOpacity>

                {/* Third tile: Buy (ETH) | Swap (swappable here) | nothing (no dead tile) */}
                {isEth ? (
                  <TouchableOpacity
                    style={[styles.actionTile, { backgroundColor: `${colors.accent}1A` }]}
                    onPress={() => { sheetRef.current?.dismiss(); onClose?.(); onRequestBuy ? onRequestBuy() : navigation.navigate('Buy'); }}
                    activeOpacity={0.75}
                  >
                    <Feather name="shopping-cart" size={20} color={colors.accent} />
                    <Text style={[styles.actionTileLabel, { color: colors.accent }]}>Buy</Text>
                  </TouchableOpacity>
                ) : swapAllowedHere ? (
                  <TouchableOpacity
                    style={[styles.actionTile, { backgroundColor: `${colors.accent}1A` }]}
                    onPress={() => {
                      sheetRef.current?.dismiss();
                      onClose?.();
                      onRequestSwap
                        ? onRequestSwap({ symbol: token.symbol, side: userHolds ? 'in' : 'out' })
                        : navigation.navigate('Dex', { initialTab: 'swap', preselect: { symbol: token.symbol, side: userHolds ? 'in' : 'out' } });
                    }}
                    activeOpacity={0.75}
                  >
                    <Feather name="repeat" size={20} color={colors.accent} />
                    <Text style={[styles.actionTileLabel, { color: colors.accent }]}>Swap</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </BottomSheetScrollView>
          </>
        ) : null}
      </TrezoBottomSheet>
    );
  },
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    borderRadius: 16,
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
    borderRadius: 12,
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
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionTileLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
