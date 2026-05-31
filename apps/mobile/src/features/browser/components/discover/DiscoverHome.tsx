import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { marketService } from "@services/MarketService";
import type { MarketAsset } from "@services/MarketService";
import { TokenDetailModal } from "@features/portfolio/components/TokenDetailModal";
import type { TokenDetailModalHandle } from "@features/portfolio/components/TokenDetailModal";
import type { TokenBalance } from "@features/portfolio/services/PortfolioService";
import type { TokenCategoryId } from "../../data/tokenCategories";
import { TRENDING_SITES } from "../../data/trendingSites";

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

// ─── Compact search result row (used when query ≥ 2 chars) ──────────────────

function SearchResultRow({
  token,
  onPress,
}: {
  token: MarketAsset;
  onPress: (t: TokenBalance) => void;
}) {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const price = parseFloat(token.priceUsd);
  const change = parseFloat(token.changePercent24Hr);
  const changeColor = change >= 0 ? colors.dataPositive : colors.dataNegative;

  return (
    <TouchableOpacity
      style={[styles.searchResultRow, { borderBottomColor: colors.border }]}
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
      <View style={styles.searchResultLeft}>
        <TokenIcon symbol={token.symbol} size={36} style={{ borderRadius: 999 }} />
        <View>
          <Text style={[styles.searchResultSymbol, { color: colors.textPrimary }]}>
            {token.symbol}
          </Text>
          <Text style={[styles.searchResultName, { color: colors.textSecondary }]} numberOfLines={1}>
            {token.name}
          </Text>
        </View>
      </View>
      <View style={styles.searchResultRight}>
        <Sparkline
          data={change >= 0 ? [10, 12, 11, 13, 14, 15] : [15, 14, 16, 14, 12, 10]}
          width={48}
          height={20}
          color={changeColor}
          strokeWidth={1.5}
        />
        <View style={styles.searchResultPrices}>
          <Text style={[styles.searchResultPrice, { color: colors.textPrimary }]}>
            $
            {price > 1
              ? price.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : price.toFixed(4)}
          </Text>
          <Text style={[styles.searchResultChange, { color: changeColor }]}>
            {change > 0 ? "+" : ""}
            {change.toFixed(2)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Merged Markets section ──────────────────────────────────────────────────
// Replaces the old separate Trending section + old vertical Market list.
// Layout: token-category chips → search input → strip or results

type MarketsSectionProps = {
  category: TokenCategoryId | null;
  onCategoryChange: (id: TokenCategoryId | null) => void;
  onTokenPress: (assetId: string) => void;
  onTokenDetailOpen: (t: TokenBalance) => void;
};

function MarketsSection({
  category,
  onCategoryChange,
  onTokenPress,
  onTokenDetailOpen,
}: MarketsSectionProps) {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MarketAsset[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a live market snapshot so we can look up tokens when a card is pressed.
  const { assets: marketAssets } = useMarketData(20);

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await marketService.searchAssets(text.trim());
      setSearchResults(results.slice(0, 6));
      setSearchLoading(false);
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const isSearching = query.trim().length >= 2;

  // When a card in TrendingTokensRow is pressed (assetId string), look it up in
  // the live market snapshot and open the TokenDetail sheet.
  const handleStripTokenPress = useCallback(
    (assetId: string) => {
      const asset = marketAssets.find((a) => a.id === assetId);
      if (asset) {
        onTokenDetailOpen({
          symbol: asset.symbol,
          name: asset.name,
          amount: 0,
          price: parseFloat(asset.priceUsd),
          value: 0,
          change24h: parseFloat(asset.changePercent24Hr),
          address: asset.id as `0x${string}`,
          decimals: 18,
        });
      } else {
        // Fallback: route through the browser's assetId path
        onTokenPress(assetId);
      }
    },
    [marketAssets, onTokenDetailOpen, onTokenPress]
  );

  return (
    <View style={styles.marketsContainer}>
      {/* Token category chips */}
      <CategoriesRow selected={category} onSelect={onCategoryChange} />

      {/* Compact "search any coin" input */}
      <View
        style={[
          styles.marketsSearch,
          { backgroundColor: colors.glass, borderColor: colors.border },
        ]}
      >
        <Feather name="search" size={14} color={colors.textMuted} />
        <TextInput
          style={[styles.marketsSearchInput, { color: colors.textPrimary }]}
          placeholder="Search any coin…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={handleQueryChange}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleQueryChange("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Content: search results list OR horizontal movers strip */}
      {isSearching ? (
        searchLoading ? (
          <View style={styles.marketsLoader}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.marketsEmpty}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600" }}>
              No tokens match "{query}"
            </Text>
          </View>
        ) : (
          <View style={[styles.marketsResults, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {searchResults.map((token) => (
              <SearchResultRow key={token.id} token={token} onPress={onTokenDetailOpen} />
            ))}
          </View>
        )
      ) : (
        /* Default: horizontal movers strip, filtered by selected category */
        <TrendingTokensRow categoryFilter={category} onTokenPress={handleStripTokenPress} />
      )}
    </View>
  );
}

// ─── Apps dApp category chips ────────────────────────────────────────────────

function AppsCategoryRow({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (cat: string | null) => void;
}) {
  const { theme } = useAppTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.appsCategoryList}
    >
      {APP_CATEGORIES.map((cat) => {
        const isActive = selected === cat;
        const fg = isActive ? theme.colors.textOnAccent : theme.colors.textSecondary;
        return (
          <TouchableOpacity
            key={cat}
            style={[
              styles.appsCategoryChip,
              {
                backgroundColor: isActive ? theme.colors.accent : theme.colors.surfaceElevated,
                borderColor: isActive ? theme.colors.accent : theme.colors.border,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => onSelect(isActive ? null : cat)}
          >
            <Text style={[styles.appsCategoryLabel, { color: fg }]}>{cat}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ─── Main DiscoverHome ────────────────────────────────────────────────────────

// Derive distinct app categories from the static TRENDING_SITES list.
const APP_CATEGORIES = Array.from(new Set(TRENDING_SITES.map((s) => s.category)));

export function DiscoverHome({ onSubmitSearch, onOpenTabs, onTokenPress, onSitePress }: Props) {
  const [category, setCategory] = useState<TokenCategoryId | null>(null);
  const [appsCategory, setAppsCategory] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const tokenDetailRef = React.useRef<TokenDetailModalHandle>(null);

  useEffect(() => {
    let active = true;
    NewsService.fetchTop(12).then((items) => {
      if (active) setNews(items);
    });
    return () => {
      active = false;
    };
  }, []);

  function handleTokenDetailOpen(token: TokenBalance) {
    tokenDetailRef.current?.open(token);
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

        {/* 2. Markets — merged Trending + Market: category chips, coin search, horizontal strip */}
        <View style={styles.section}>
          <SectionHeader>Markets</SectionHeader>
          <MarketsSection
            category={category}
            onCategoryChange={setCategory}
            onTokenPress={onTokenPress}
            onTokenDetailOpen={handleTokenDetailOpen}
          />
        </View>

        {/* 3. Apps (dApp list) — separate dApp category chips, independent of token chips */}
        <View style={styles.section}>
          <SectionHeader>Apps</SectionHeader>
          <AppsCategoryRow selected={appsCategory} onSelect={setAppsCategory} />
          <TrendingSitesRow onPress={onSitePress} categoryFilter={appsCategory} />
        </View>

        {/* 4. News — hides when feed is empty */}
        {news.length > 0 && (
          <View style={styles.section}>
            <SectionHeader>News</SectionHeader>
            <NewsFeed items={news} onItemPress={onSitePress} />
          </View>
        )}
      </ScrollView>

      {/* Token detail bottom-sheet — modal lives outside the ScrollView */}
      <TokenDetailModal ref={tokenDetailRef} />
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
  // Merged Markets section
  marketsContainer: { gap: 10 },
  marketsSearch: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginHorizontal: 16,
  },
  marketsSearchInput: { flex: 1, fontSize: 13, fontWeight: "500" },
  marketsLoader: { height: 60, alignItems: "center", justifyContent: "center" },
  marketsEmpty: { paddingVertical: 16, paddingHorizontal: 16, alignItems: "center" },
  // Compact search results container
  marketsResults: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  // Search result row
  searchResultRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchResultLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchResultSymbol: { fontSize: 14, fontWeight: "700" },
  searchResultName: { fontSize: 11, fontWeight: "500", marginTop: 1, maxWidth: 140 },
  searchResultRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchResultPrices: { alignItems: "flex-end", minWidth: 68 },
  searchResultPrice: { fontSize: 13, fontWeight: "700" },
  searchResultChange: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  // Apps category chips
  appsCategoryList: { paddingHorizontal: 16, gap: 8 },
  appsCategoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  appsCategoryLabel: { fontSize: 13, fontWeight: "600" },
});
