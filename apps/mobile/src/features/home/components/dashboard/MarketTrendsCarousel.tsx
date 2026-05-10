import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useMarketData } from "@hooks/useMarketData";
import { biasToTestnetTradeable } from "@services/market/testnetBias";
import { TokenIcon } from "@shared/components";
import { BorderRadius } from "@shared/components/TokenRegistry";
import { useAppTheme } from "@theme";
import type { TokenBalance } from "../../../portfolio/services/PortfolioService";

const { width } = Dimensions.get("window");
const CARD_WIDTH = (width - 48) / 2.3;
const GAP = 12;

type Props = {
  onTokenPress?: (token: TokenBalance) => void;
};

export function MarketTrendsCarousel({ onTokenPress }: Props) {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const { assets, loading } = useMarketData(10);

  const sorted = useMemo(() => biasToTestnetTradeable(assets ?? []), [assets]);

  if (loading && sorted.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <FlatList
      data={sorted}
      keyExtractor={(item) => item.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.listContent, { gap: GAP }]}
      snapToInterval={CARD_WIDTH + GAP}
      decelerationRate="fast"
      renderItem={({ item }) => {
        const price = parseFloat(item.priceUsd);
        const change = parseFloat(item.changePercent24Hr);
        const isPositive = change >= 0;

        const formattedPrice =
          price > 1
            ? `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            : `$${price.toFixed(4)}`;

        return (
          <Pressable
            onPress={() =>
              onTokenPress?.({
                symbol: item.symbol,
                name: item.name,
                amount: 0,
                price,
                value: 0,
                change24h: change,
                address: item.id as `0x${string}`,
                decimals: 18,
              })
            }
            style={[
              styles.card,
              {
                width: CARD_WIDTH,
                backgroundColor: colors.surfaceCard,
                borderRadius: BorderRadius.lg,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <TokenIcon symbol={item.symbol} size={32} style={{ borderRadius: 10 }} />
              <View
                style={[
                  styles.changeBadge,
                  {
                    backgroundColor: isPositive ? colors.successSoft : colors.dangerSoft,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.changeText,
                    { color: isPositive ? colors.success : colors.danger },
                  ]}
                >
                  {isPositive ? "+" : ""}
                  {change.toFixed(2)}%
                </Text>
              </View>
            </View>

            <Text style={[styles.symbol, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.symbol}
            </Text>
            <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.price, { color: colors.textPrimary }]} numberOfLines={1}>
              {formattedPrice}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 2,
    paddingBottom: 4,
  },
  card: {
    padding: 12,
    gap: 4,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  changeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  changeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  symbol: {
    fontSize: 15,
    fontWeight: "700",
  },
  name: {
    fontSize: 12,
    fontWeight: "500",
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
});
