import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';
import type { TokenBalance } from '@features/portfolio/services/PortfolioService';

interface AssetListProps {
  assets: TokenBalance[];
  predictedAddress: string | null;
  formatPrice: (value: number) => string;
}

export const AssetList: React.FC<AssetListProps> = ({
  assets,
  predictedAddress,
  formatPrice,
}) => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;

  if (assets.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Spotlight holdings</Text>
        <View style={[styles.noAssets, { backgroundColor: withAlpha(colors.surfaceElevated, 0.4), borderColor: colors.borderMuted }]}>
          <Text style={[styles.noAssetsText, { color: colors.textSecondary }]}>
            {predictedAddress
              ? "Your holdings will appear here once you receive tokens."
              : "Connect a wallet to see your holdings."}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Spotlight holdings</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {assets.map((token) => (
          <LinearGradient
            key={token.address}
            colors={gradients.card}
            style={[styles.assetCard, { borderColor: colors.border }]}
          >
            <View style={styles.assetHeader}>
              <View style={[styles.assetBadge, { backgroundColor: withAlpha(colors.accent, 0.16) }]}>
                <Text style={[styles.assetBadgeText, { color: colors.accent }]}>
                  {token.symbol.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.assetAmount, { color: colors.textSecondary }]}>
                {token.amount.toFixed(4)}
              </Text>
            </View>
            <Text style={[styles.assetName, { color: colors.textPrimary }]}>{token.name}</Text>
            <Text style={[styles.assetValue, { color: colors.textPrimary }]}>
              {formatPrice(token.value)}
            </Text>
            <Text style={[styles.assetAllocation, { color: colors.textSecondary }]}>
              {`@${formatPrice(token.price)}`}
            </Text>
          </LinearGradient>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  scrollContent: {
    paddingHorizontal: 4,
    columnGap: 14,
  },
  assetCard: {
    padding: 20,
    borderRadius: 22,
    minWidth: 210,
    borderWidth: 1,
  },
  assetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assetBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  assetBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  assetAmount: {
    fontWeight: '700',
    fontSize: 13,
  },
  assetName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  assetValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  assetAllocation: {
    fontSize: 12,
    marginTop: 4,
  },
  noAssets: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
  },
  noAssetsText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
