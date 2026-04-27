import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import { Sparkline, MeshBackground, TokenIcon } from '@shared/components';
import { useMarketData } from '@hooks/useMarketData';

export const MarketExplorer: React.FC = () => {
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const { assets, loading, refresh } = useMarketData(10);
  const [filter, setFilter] = useState<'all' | 'ethereum' | 'base' | 'polygon'>('all');
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!assets) return [];
    return assets.filter(t => {
      // CoinCap doesn't give chain info easily in this endpoint, so we default to 'all' or mock mapping
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || t.symbol.toLowerCase().includes(search.toLowerCase());
      return matchesSearch;
    });
  }, [assets, search]);

  const isDark = resolvedMode === 'dark';

  if (loading && assets.length === 0) {
    return (
      <View style={[styles.container, { padding: 40, alignItems: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!filteredData || filteredData.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>Market Trends</Text>
        <TouchableOpacity onPress={refresh}>
          <Text style={[styles.seeAll, { color: colors.accent }]}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Data Sourcing Attribution */}
      <View style={styles.attributionRow}>
        <View style={[styles.sourcePill, { backgroundColor: withAlpha(colors.accent, 0.05), borderColor: withAlpha(colors.accent, 0.2) }]}>
          <Text style={[styles.sourceText, { color: colors.accent }]}>LIVE FEED: BINANCE & COINCAP</Text>
        </View>
      </View>

      {/* Token List */}
      <View style={styles.tokenList}>
        {filteredData.map((token) => {
          const price = parseFloat(token.priceUsd);
          const change = parseFloat(token.changePercent24Hr);
          
          return (
            <TouchableOpacity key={token.id} style={styles.tokenItem} activeOpacity={0.7}>
              <View style={styles.tokenLeft}>
                <TokenIcon 
                  symbol={token.symbol} 
                  size={40}
                  style={{ borderRadius: 12 }}
                />
                <View>
                  <Text style={[styles.tokenName, { color: colors.textPrimary }]}>{token.name}</Text>
                  <Text style={[styles.tokenSymbol, { color: colors.textSecondary }]}>{token.symbol}</Text>
                </View>
              </View>
              
              <View style={styles.tokenRight}>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.tokenPrice, { color: colors.textPrimary }]}>
                    ${price > 1 ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : price.toFixed(4)}
                  </Text>
                  <Text style={[styles.tokenChange, { color: change < 0 ? colors.danger : colors.success }]}>
                    {change > 0 ? '+' : ''}{change.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  attributionRow: {
    marginBottom: 16,
    flexDirection: 'row',
  },
  sourcePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  filterRow: {
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 2,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  tokenList: {
    gap: 12,
  },
  tokenItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tokenLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  iconText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  tokenName: {
    fontSize: 15,
    fontWeight: '700',
  },
  tokenSymbol: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  tokenRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  sparklineWrap: {
    marginRight: 4,
  },
  tokenPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  tokenChange: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
