import React, { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useAppTheme } from "@theme";
import { useMarketData } from "@hooks/useMarketData";
import { biasToTestnetTradeable } from "@services/market/testnetBias";
import { marketService, type MarketAsset } from "@services/MarketService";
import { getCategorySymbols, type TokenCategoryId } from "../../data/tokenCategories";

type Props = {
  categoryFilter?: TokenCategoryId | null;
  onTokenPress: (assetId: string) => void;
};

/**
 * Default (no category) shows the live, volume-ranked trending pool. Selecting a
 * category fetches that category's curated token list directly — so every
 * category is populated (incl. memecoins, which the trending pool excludes).
 */
function useTrendingTokens(categoryFilter?: TokenCategoryId | null) {
  const { assets, loading } = useMarketData(20);
  const [catAssets, setCatAssets] = useState<MarketAsset[]>([]);
  const [catLoading, setCatLoading] = useState(false);

  useEffect(() => {
    if (!categoryFilter) {
      setCatAssets([]);
      return;
    }
    let active = true;
    setCatLoading(true);
    marketService.getAssetsBySymbols(getCategorySymbols(categoryFilter)).then((a) => {
      if (active) {
        setCatAssets(a);
        setCatLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [categoryFilter]);

  if (categoryFilter) return { tokens: catAssets, loading: catLoading };
  return { tokens: biasToTestnetTradeable(assets), loading };
}

/** Real token logo from CoinCap's icon CDN, falling back to the symbol's first letter. */
function TokenIcon({ symbol }: { symbol: string }) {
  const { theme } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const uri = `https://assets.coincap.io/assets/icons/${symbol.toLowerCase()}@2x.png`;

  if (failed) {
    return (
      <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.accent}22` }]}>
        <Text style={[styles.iconLetter, { color: theme.colors.accent }]}>{symbol.charAt(0)}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.iconImg}
      contentFit="contain"
      transition={150}
      onError={() => setFailed(true)}
    />
  );
}

function formatPrice(priceUsd: string): string {
  const n = parseFloat(priceUsd);
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function formatChange(changePercent: string): string {
  const n = parseFloat(changePercent);
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export function TrendingTokensRow({ categoryFilter, onTokenPress }: Props) {
  const { theme } = useAppTheme();
  const { tokens, loading } = useTrendingTokens(categoryFilter);

  const displayed = tokens.slice(0, 12);

  if (loading && displayed.length === 0) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
      </View>
    );
  }

  // Category selected but nothing came back (e.g. network blip).
  if (categoryFilter && displayed.length === 0) {
    return (
      <View style={styles.loader}>
        <Text style={[styles.emptyText, { color: theme.colors.textMuted }]}>
          No trending tokens in this category right now
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      horizontal
      data={displayed}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const change = parseFloat(item.changePercent24Hr);
        const isPositive = change >= 0;
        const changeColor = isPositive ? theme.colors.success : theme.colors.danger;

        return (
          <Pressable
            style={[
              styles.card,
              { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
            ]}
            onPress={() => onTokenPress(item.id)}
          >
            <TokenIcon symbol={item.symbol} />
            <Text style={[styles.symbol, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {item.symbol}
            </Text>
            <Text style={[styles.price, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {formatPrice(item.priceUsd)}
            </Text>
            <Text style={[styles.change, { color: changeColor }]} numberOfLines={1}>
              {formatChange(item.changePercent24Hr)}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  loader: { height: 110, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  emptyText: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  list: { paddingHorizontal: 16, gap: 10 },
  card: {
    width: 90,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  iconImg: { width: 36, height: 36, borderRadius: 18, marginBottom: 2 },
  iconLetter: { fontSize: 16, fontWeight: "700" },
  symbol: { fontSize: 12, fontWeight: "700" },
  price: { fontSize: 11, fontWeight: "500" },
  change: { fontSize: 11, fontWeight: "600" },
});
