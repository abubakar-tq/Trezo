import React, { useEffect, useState } from "react";
import { ScrollView, View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@theme";
import { UnifiedSearchBar, type SearchIntent } from "./UnifiedSearchBar";
import { TrendingTokensRow } from "./TrendingTokensRow";
import { CategoriesRow } from "./CategoriesRow";
import { TrendingSitesRow } from "./TrendingSitesRow";
import { NewsFeed } from "./NewsFeed";
import { NewsService, type NewsItem } from "@services/news/NewsService";
import type { TokenCategoryId } from "../../data/tokenCategories";

type Props = {
  onSubmitSearch: (intent: SearchIntent) => void;
  onOpenTabs: () => void;
  onTokenPress: (assetId: string) => void;
  onSitePress: (url: string) => void;
};

export function DiscoverHome({ onSubmitSearch, onOpenTabs, onTokenPress, onSitePress }: Props) {
  const [category, setCategory] = useState<TokenCategoryId | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const { theme } = useAppTheme();

  useEffect(() => {
    let active = true;
    NewsService.fetchTop(12).then((items) => {
      if (active) setNews(items);
    });
    return () => {
      active = false;
    };
  }, []);

  function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
      <Text style={[styles.sectionHeader, { color: theme.colors.textSecondary }]}>
        {children}
      </Text>
    );
  }

  return (
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

      {/* 3. Categories */}
      <View style={styles.section}>
        <SectionHeader>Categories</SectionHeader>
        <CategoriesRow selected={category} onSelect={setCategory} />
      </View>

      {/* 4. Trending sites */}
      <View style={styles.section}>
        <SectionHeader>Sites</SectionHeader>
        <TrendingSitesRow onPress={onSitePress} />
      </View>

      {/* 5. News — entire section (header included) hides when the feed is empty */}
      {news.length > 0 && (
        <View style={styles.section}>
          <SectionHeader>News</SectionHeader>
          <NewsFeed items={news} onItemPress={onSitePress} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingVertical: 16, gap: 20 },
  searchWrapper: { paddingHorizontal: 16 },
  section: { gap: 10 },
  sectionHeader: {
    paddingHorizontal: 16,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    opacity: 0.6,
  },
});
