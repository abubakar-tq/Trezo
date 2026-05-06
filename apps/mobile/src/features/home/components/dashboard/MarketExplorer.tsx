import React, { useMemo, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import { Sparkline, MeshBackground, TokenIcon } from '@shared/components';
import { useMarketData } from '@hooks/useMarketData';
import type { TokenBalance } from '../../../portfolio/services/PortfolioService';

const TokenItem = React.memo<{ token: any, colors: any, onPress?: () => void }>(({ token, colors, onPress }) => {
  const price = parseFloat(token.priceUsd);
  const change = parseFloat(token.changePercent24Hr);

  return (
    <TouchableOpacity style={styles.tokenItem} activeOpacity={0.7} onPress={onPress}>
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
        <View style={styles.sparklineWrap}>
          <Sparkline 
            data={change >= 0 ? [10, 12, 11, 13, 14, 15] : [15, 14, 16, 14, 12, 10]} 
            width={60} 
            height={24} 
            color={change >= 0 ? colors.accent : colors.danger} 
            strokeWidth={2} 
          />
        </View>
        <View style={{ alignItems: 'flex-end', width: 80 }}>
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
});

interface MarketExplorerProps {
  onTokenPress?: (token: TokenBalance) => void;
}

export const MarketExplorer = forwardRef<any, MarketExplorerProps>(({ onTokenPress }, ref) => {
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => ({
    focusSearch: () => inputRef.current?.focus(),
  }));
  const { theme, resolvedMode } = useAppTheme();
  const { colors } = theme;
  const { assets, loading, refresh } = useMarketData(10);
  const [filter, setFilter] = useState<'all' | 'ethereum' | 'base' | 'polygon'>('all');
  const [search, setSearch] = useState('');

  const filteredData = useMemo(() => {
    if (!assets) return [];
    
    return assets.filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) || 
                           t.symbol.toLowerCase().includes(search.toLowerCase());
      
      if (!matchesSearch) return false;
      if (filter === 'all') return true;

      const sym = t.symbol.toUpperCase();
      
      // Heuristic mapping for networks based on top assets
      if (filter === 'ethereum') {
        const ethAssets = ['ETH', 'USDC', 'USDT', 'DAI', 'LINK', 'WBTC', 'SHIB', 'PEPE', 'UNI', 'LDO'];
        return ethAssets.includes(sym);
      }
      
      if (filter === 'polygon') {
        const polyAssets = ['MATIC', 'POL', 'QUICK', 'AAVE'];
        return polyAssets.includes(sym);
      }

      if (filter === 'base') {
        const baseAssets = ['OP', 'ARB', 'AERO', 'BASE']; // Mocking for demo/L2 grouping
        return baseAssets.includes(sym);
      }

      return true;
    });
  }, [assets, search, filter]);

  const isDark = resolvedMode === 'dark';

  if (loading && assets.length === 0) {
    return (
      <View style={[styles.container, { padding: 40, alignItems: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }


  return (
    <View style={styles.container}>
      {/* Search Bar - Integrated in Section */}
      <View style={[styles.searchContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : colors.surfaceMuted, borderColor: colors.border }]}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Search tokens..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['all', 'ethereum', 'base', 'polygon'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setFilter(f)}
            style={[
              styles.pill,
              { 
                borderColor: filter === f ? colors.accent : colors.border,
                backgroundColor: filter === f ? colors.accent : 'transparent'
              }
            ]}
          >
            <Text style={[
              styles.pillText, 
              { color: filter === f ? colors.textOnAccent : colors.textSecondary }
            ]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Token List */}
      <View style={styles.tokenList}>
        {filteredData.length === 0 ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>
              No assets found{search ? ` matching "${search}"` : ''} for {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </View>
        ) : (
          filteredData.map((token) => (
            <TokenItem
              key={token.id}
              token={token}
              colors={colors}
              onPress={() => onTokenPress?.({
                symbol: token.symbol,
                name: token.name,
                amount: 0,
                price: parseFloat(token.priceUsd),
                value: 0,
                change24h: parseFloat(token.changePercent24Hr),
                address: token.id,
              })}
            />
          ))
        )}
        {/* End of list condition handled by ternary above */}
      </View>
    </View>
  );
});

// styles remain below

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  filterRow: {
    gap: 10,
    marginBottom: 20,
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '800',
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
