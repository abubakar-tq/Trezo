import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { MarketAsset } from "@services/MarketService";
import { TokenIcon } from "@shared/components";
import { FontFamilies } from "@shared/components/TokenRegistry";
import { useAppTheme } from "@theme";
import type { TokenBalance } from "../../../portfolio/services/PortfolioService";

type Filter = "gainers" | "losers";

type Props = {
  assets: MarketAsset[];
  onTokenPress?: (token: TokenBalance) => void;
};

function toTokenBalance(item: MarketAsset): TokenBalance {
  return {
    symbol: item.symbol,
    name: item.name,
    amount: 0,
    price: parseFloat(item.priceUsd),
    value: 0,
    change24h: parseFloat(item.changePercent24Hr),
    address: item.id as `0x${string}`,
    decimals: 18,
  };
}

function formatPrice(price: number): string {
  if (price >= 1000)
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1)
    return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${price.toFixed(4)}`;
}

type RowProps = {
  item: MarketAsset;
  filter: Filter;
  onPress?: () => void;
};

function MoverRow({ item, filter, onPress }: RowProps) {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const price = parseFloat(item.priceUsd);
  const change = parseFloat(item.changePercent24Hr);
  const isGainer = filter === "gainers";
  const changeColor = isGainer ? colors.success : colors.danger;

  return (
    <Pressable
      onPress={onPress}
      style={styles.row}
      android_ripple={{ color: `${colors.accent}18` }}
    >
      <TokenIcon symbol={item.symbol} size={36} style={{ borderRadius: 10 }} />

      <View style={styles.nameBlock}>
        <Text style={[styles.symbol, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.symbol}
        </Text>
        <Text style={[styles.tokenName, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.name}
        </Text>
      </View>

      <Text style={[styles.colPrice, { color: colors.textPrimary, fontFamily: FontFamilies.mono }]}>
        {formatPrice(price)}
      </Text>
      <Text style={[styles.colChange, { color: changeColor, fontFamily: FontFamilies.mono }]}>
        {isGainer ? "+" : ""}{change.toFixed(2)}%
      </Text>
    </Pressable>
  );
}

export function TopMovers({ assets, onTokenPress }: Props) {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [filter, setFilter] = useState<Filter>("gainers");

  const { gainers, losers } = useMemo(() => {
    const valid = assets.filter((a) => isFinite(parseFloat(a.changePercent24Hr)));
    const sorted = [...valid].sort(
      (a, b) => parseFloat(b.changePercent24Hr) - parseFloat(a.changePercent24Hr),
    );
    return {
      gainers: sorted.slice(0, 5),
      losers: [...sorted].reverse().slice(0, 5),
    };
  }, [assets]);

  const displayed = filter === "gainers" ? gainers : losers;

  if (gainers.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.glass, borderColor: colors.borderMuted }]}>
        {(["gainers", "losers"] as Filter[]).map((f) => {
          const active = filter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              activeOpacity={0.7}
              style={[styles.filterTab, active && { backgroundColor: colors.surfaceCard }]}
            >
              <Text style={[styles.filterLabel, { color: active ? colors.textPrimary : colors.textMuted }]}>
                {f === "gainers" ? "Top Gainers" : "Top Losers"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Column headers */}
      <View style={styles.colHeader}>
        <Text style={[styles.colLabel, { color: colors.textMuted }]}>Token</Text>
        <View style={styles.colHeaderRight}>
          <Text style={[styles.colLabel, { color: colors.textMuted, width: 80, textAlign: "right" }]}>Price</Text>
          <Text style={[styles.colLabel, { color: colors.textMuted, width: 64, textAlign: "right" }]}>24h %</Text>
        </View>
      </View>

      {/* Rows */}
      {displayed.map((item) => (
        <MoverRow
          key={item.id}
          item={item}
          filter={filter}
          onPress={() => onTokenPress?.(toTokenBalance(item))}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 0,
  },
  filterRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 12,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  colHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 2,
  },
  colLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  symbol: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  tokenName: {
    fontSize: 11,
    fontWeight: "500",
  },
  colPrice: {
    width: 80,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
  },
  colChange: {
    width: 64,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "700",
  },
  colHeaderRight: {
    flexDirection: "row",
  },
});
