import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import { TokenIcon } from '@shared/components';
import type { TokenBalance } from '@features/portfolio/services/PortfolioService';

interface AssetListProps {
  assets: TokenBalance[];
  predictedAddress: string | null;
  formatPrice: (value: number) => string;
  onAssetPress?: (asset: TokenBalance) => void;
}

/**
 * Formats large numbers into a human-readable compact format (e.g., 1.2B, 3.4M)
 */
const formatCompactNumber = (value: number) => {
  if (value >= 1e12) return (value / 1e12).toFixed(2) + 'T';
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K';
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
};

/**
 * Formats USD value with compact notation for very large numbers
 */
const formatCompactPrice = (value: number) => {
  if (value >= 1e9) {
    return '$' + (value / 1e9).toFixed(2) + 'B';
  }
  if (value >= 1e6) {
    return '$' + (value / 1e6).toFixed(2) + 'M';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
};

export const AssetList = React.memo<AssetListProps>(({
  assets,
  formatPrice,
  onAssetPress,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  if (assets.length === 0) {
    // Show professional placeholders if empty to avoid blank screen
    const placeholders = [
      { symbol: 'ETH', name: 'Ethereum', amount: 0, price: 0, value: 0 },
      { symbol: 'USDC', name: 'USD Coin', amount: 0, price: 0, value: 0 },
      { symbol: 'USDT', name: 'Tether', amount: 0, price: 0, value: 0 },
      { symbol: 'WBTC', name: 'Wrapped Bitcoin', amount: 0, price: 0, value: 0 },
    ];
    
    return (
      <View style={styles.container}>
        <View style={styles.list}>
          {placeholders.map((token, index) => (
            <View 
              key={`placeholder-${index}`} 
              style={[
                styles.item, 
                { opacity: 0.3 },
                index !== placeholders.length - 1 && { borderBottomWidth: 1, borderBottomColor: withAlpha(colors.accent, 0.08) }
              ]}
            >
              <View style={styles.itemLeft}>
                <TokenIcon symbol={token.symbol} size={44} style={{ borderRadius: 14 }} />
                <View style={styles.nameWrapper}>
                  <Text style={[styles.symbol, { color: colors.textSecondary }]}>{token.symbol}</Text>
                  <Text style={[styles.name, { color: colors.textMuted }]}>{token.name}</Text>
                </View>
              </View>
              <View style={styles.itemRight}>
                <Text style={[styles.value, { color: colors.textMuted }]}>$0.00</Text>
                <Text style={[styles.amount, { color: colors.textMuted }]}>0.00 {token.symbol}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {assets.map((token, index) => (
          <TouchableOpacity 
            key={`${token.address}-${index}`} 
            style={[
              styles.item, 
              index !== assets.length - 1 && { borderBottomWidth: 1, borderBottomColor: withAlpha(colors.accent, 0.08) }
            ]}
            onPress={() => onAssetPress?.(token)}
            activeOpacity={0.7}
          >
            {/* Left Section: Icon and Token Name */}
            <View style={styles.itemLeft}>
              <TokenIcon 
                symbol={token.symbol} 
                address={token.address} 
                size={44}
                style={{ borderRadius: 14 }}
              />
              <View style={styles.nameWrapper}>
                <Text 
                  style={[styles.symbol, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {token.symbol}
                </Text>
                <Text 
                  style={[styles.name, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {token.name}
                </Text>
              </View>
            </View>

            {/* Right Section: USD Value and Token Amount */}
            <View style={styles.itemRight}>
              <Text 
                style={[styles.value, { color: colors.textPrimary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatCompactPrice(token.value)}
              </Text>
              <Text 
                style={[styles.amount, { color: colors.textSecondary }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {formatCompactNumber(token.amount)} <Text style={styles.amountSymbol}>{token.symbol}</Text>
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  list: {
    gap: 0,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    minHeight: 80,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 0.6, // Give more space to the name section if needed, but allow right side to grow
    gap: 16,
  },
  nameWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconText: {
    fontSize: 16,
    fontWeight: '900',
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  itemRight: {
    flex: 0.4,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  amount: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 4,
    fontFamily: 'monospace',
    textAlign: 'right',
  },
  amountSymbol: {
    fontSize: 10,
    fontWeight: '600',
  },
  placeholderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  emptyState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
