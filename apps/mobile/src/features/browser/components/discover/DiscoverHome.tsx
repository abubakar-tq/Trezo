import React, { useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { Sparkline, TokenIcon } from "@shared/components";
import { UnifiedSearchBar, type SearchIntent } from "./UnifiedSearchBar";
import { TrendingTokensRow } from "./TrendingTokensRow";
import { CategoriesRow } from "./CategoriesRow";
import { TrendingSitesRow } from "./TrendingSitesRow";
import { NewsFeed } from "./NewsFeed";
import { NewsService, type NewsItem } from "@services/news/NewsService";
import { useMarketData } from "@hooks/useMarketData";
import { TokenDetailModal } from "@features/portfolio/components/TokenDetailModal";
import type { TokenBalance } from "@features/portfolio/services/PortfolioService";
import type { TokenCategoryId } from "../../data/tokenCategories";

// On-brand violet constants for Apps section fallback glyphs.
const APP_ICON_BG = "rgba(124,58,237,0.14)";
const APP_ICON_GLYPH = "#c4b5fd";

type Props = {
  onSubmitSearch: (intent: SearchIntent) => void;
  onOpenTabs: () => void;
  onTokenPress: (assetId: string) => void;
  onSitePress: (url: string) => void;
};

// ─── Inline section header — textPrimary, legible ───────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <Text style={[styles.sectionHeader, { color: theme.colors.textPrimary }]}>
      {children}
    </Text>
  );
}

// ─── Market row — reclaimed from MarketExplorer ──────────────────────────────

function MarketRow({
  token,
  onPress,
}: {
  token: any;
  onPress: (t: TokenBalance) => void;
}) {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const price = parseFloat(token.priceUsd);
  const change = parseFloat(token.changePercent24Hr);
  const changeColor = change >= 0 ? colors.dataPositive : colors.dataNegative;

  return (
    <TouchableOpacity
      style={[styles.marketRow, { borderBottomColor: colors.border }]}
      activeOpacity={0.7}
      onPress={() =>
        onPress({
          symbol: token.symbol,
          name: token.name,
          amount: 0,
          price,
          value: 0,
          change24h: change,
          address: token.id as `0x${string}`,
          decimals: 18,
        })
      }
    >
      <View style={styles.marketRowLeft}>
        <TokenIcon symbol={token.symbol} size={40} style={{ borderRadius: 12 }} />
        <View>
          <Text style={[styles.marketTokenName, { color: colors.textPrimary }]}>
            {token.name}
          </Text>
          <Text style={[styles.marketTokenSymbol, { color: colors.textSecondary }]}>
            {token.symbol}
          </Text>
        </View>
      </View>
      <View style={styles.marketRowRight}>
        <View style={styles.sparklineWrap}>
          <Sparkline
            data={change >= 0 ? [10, 12, 11, 13, 14, 15] : [15, 14, 16, 14, 12, 10]}
            width={60}
            height={24}
            color={changeColor}
            strokeWidth={2}
          />
        </View>
        <View style={styles.marketRowPrices}>
          <Text style={[styles.marketPrice, { color: colors.textPrimary }]}>
            $
            {price > 1
              ? price.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : price.toFixed(4)}
          </Text>
          <Text style={[styles.marketChange, { color: changeColor }]}>
            {change > 0 ? "+" : ""}
            {change.toFixed(2)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MarketSection({ onTokenPress }: { onTokenPress: (t: TokenBalance) => void }) {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const { assets, loading } = useMarketData(10);
  const [search, setSearch] = useState("");

  const filtered = assets.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.symbol.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && assets.length === 0) {
    return (
      <View style={styles.marketLoader}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.marketSection}>
      {/* Mini search within market */}
      <View
        style={[
          styles.marketSearch,
          { backgroundColor: colors.glass, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.marketSearchInput, { color: colors.textPrimary }]}
          placeholder="Search tokens…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.marketEmpty}>
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
            No tokens match "{search}"
          </Text>
        </View>
      ) : (
        filtered.map((token) => (
          <MarketRow key={token.id} token={token} onPress={onTokenPress} />
        ))
      )}
    </View>
  );
}

// ─── Main DiscoverHome ────────────────────────────────────────────────────────

export function DiscoverHome({ onSubmitSearch, onOpenTabs, onTokenPress, onSitePress }: Props) {
  const [category, setCategory] = useState<TokenCategoryId | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);

  useEffect(() => {
    let active = true;
    NewsService.fetchTop(12).then((items) => {
      if (active) setNews(items);
    });
    return () => {
      active = false;
    };
  }, []);

  function handleMarketTokenPress(token: TokenBalance) {
    setSelectedToken(token);
    setDetailVisible(true);
  }

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Unified search + tabs button */}
        <View style={styles.searchWrapper}>
          <UnifiedSearchBar onSubmit={onSubmitSearch} onTabsPress={onOpenTabs} />
        </View>

        {/* 2. Trending tokens */}
        <View style={styles.section}>
          <SectionHeader>Trending</SectionHeader>
          <TrendingTokensRow categoryFilter={category} onTokenPress={onTokenPress} />
        </View>

        {/* 3. Market — vertical list with search, sparklines, 24h change */}
        <View style={styles.section}>
          <SectionHeader>Market</SectionHeader>
          <MarketSection onTokenPress={handleMarketTokenPress} />
        </View>

        {/* 4. Apps (dApp list) — on-brand violet icons + category chips */}
        <View style={styles.section}>
          <SectionHeader>Apps</SectionHeader>
          <CategoriesRow selected={category} onSelect={setCategory} />
          <TrendingSitesRow onPress={onSitePress} />
        </View>

        {/* 5. News — hides when feed is empty */}
        {news.length > 0 && (
          <View style={styles.section}>
            <SectionHeader>News</SectionHeader>
            <NewsFeed items={news} onItemPress={onSitePress} />
          </View>
        )}
      </ScrollView>

      {/* Token detail bottom-sheet — modal lives outside the ScrollView */}
      <TokenDetailModal
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        token={selectedToken}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingVertical: 16, gap: 20 },
  searchWrapper: { paddingHorizontal: 16 },
  section: { gap: 10 },
  // Section header — legible textPrimary, no opacity fade
  sectionHeader: {
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  // Market section
  marketLoader: { height: 80, alignItems: "center", justifyContent: "center" },
  marketSection: { paddingHorizontal: 16, gap: 0 },
  marketSearch: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 8,
  },
  marketSearchInput: { flex: 1, fontSize: 14, fontWeight: "500" },
  marketEmpty: { padding: 20, alignItems: "center" },
  marketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  marketRowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  marketTokenName: { fontSize: 15, fontWeight: "700" },
  marketTokenSymbol: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  marketRowRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  sparklineWrap: {},
  marketRowPrices: { alignItems: "flex-end", minWidth: 72 },
  marketPrice: { fontSize: 15, fontWeight: "700" },
  marketChange: { fontSize: 12, fontWeight: "600", marginTop: 2 },
});
