import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme } from '@theme';
import { FontFamilies } from '@shared/components/TokenRegistry';
import { TokenIcon } from '@shared/components';
import type { TokenBalance } from '@features/portfolio/services/PortfolioService';

interface AssetListProps {
  assets: TokenBalance[];
  predictedAddress: string | null;
  formatPrice: (value: number) => string;
  onAssetPress?: (asset: TokenBalance) => void;
  /** Map of symbol → 24h change %. Omit or pass null/undefined for a token when unknown. */
  change24hBySymbol?: Record<string, number | undefined>;
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
  change24hBySymbol,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  // Spec §5.1 EMPTY state: Home owns its empty state — do NOT render a fake
  // multi-token placeholder list. Home renders a "Fund your wallet" card + a
  // single native ETH row instead. AssetList simply renders nothing when empty.
  if (assets.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {assets.map((token, index) => {
          const pct = change24hBySymbol?.[token.symbol.toUpperCase()];
          const hasPct = typeof pct === "number" && isFinite(pct);
          const isPositive = hasPct && (pct as number) >= 0;

          return (
            <TouchableOpacity
              key={`${token.address}-${index}`}
              style={[
                styles.item,
                index !== assets.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }
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
                  // Spec §3: radius scale — 12 for token chips (was offending 14)
                  style={{ borderRadius: 12 }}
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

              {/* Right Section: USD Value, Token Amount, and 24h change */}
              <View style={styles.itemRight}>
                <Text
                  style={[styles.value, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatCompactPrice(token.value ?? 0)}
                </Text>
                <Text
                  style={[styles.amount, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {formatCompactNumber(token.amount)} <Text style={styles.amountSymbol}>{token.symbol}</Text>
                </Text>
                {/* 24h change — only when real data; never fake 0 */}
                {hasPct ? (
                  <View style={styles.changeRow}>
                    <Feather
                      name={isPositive ? "trending-up" : "trending-down"}
                      size={10}
                      color={isPositive ? colors.dataPositive : colors.dataNegative}
                    />
                    <Text
                      style={[
                        styles.changeText,
                        { color: isPositive ? colors.dataPositive : colors.dataNegative },
                      ]}
                    >
                      {isPositive ? "+" : ""}{(pct as number).toFixed(2)}%
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
});

AssetList.displayName = "AssetList";

const styles = StyleSheet.create({
  container: {
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
    flex: 0.6,
    gap: 16,
  },
  nameWrapper: {
    flex: 1,
    justifyContent: 'center',
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
    gap: 2,
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
    fontFamily: FontFamilies.mono,
    textAlign: 'right',
  },
  amountSymbol: {
    fontSize: 10,
    fontWeight: '600',
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  changeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
