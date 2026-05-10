import React from "react";
import { FlatList, Pressable, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { useAppTheme } from "@theme";
import { useMarketData } from "@hooks/useMarketData";
import { biasToTestnetTradeable } from "@services/market/testnetBias";

type Props = {
  categoryFilter?: string | null;
  onTokenPress: (assetId: string) => void;
};

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
  const { assets, loading } = useMarketData(20);

  const biased = biasToTestnetTradeable(assets);
  // Category filter is best-effort — CoinCap assets don't carry category tags.
  // When categoryFilter is set, show all (no-op until assets have categories).
  const displayed = biased.slice(0, 12);

  if (loading && displayed.length === 0) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="small" color={theme.colors.accent} />
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
            <View style={[styles.iconCircle, { backgroundColor: `${theme.colors.accent}22` }]}>
              <Text style={[styles.iconLetter, { color: theme.colors.accent }]}>
                {item.symbol.charAt(0)}
              </Text>
            </View>
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
  loader: { height: 110, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, gap: 10 },
  card: {
    width: 90,
    padding: 10,
    borderRadius: 14,
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
  iconLetter: { fontSize: 16, fontWeight: "700" },
  symbol: { fontSize: 12, fontWeight: "700" },
  price: { fontSize: 11, fontWeight: "500" },
  change: { fontSize: 11, fontWeight: "600" },
});
