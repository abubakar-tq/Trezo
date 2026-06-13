import React, { useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useAppTheme } from "@theme";
import { type NewsItem } from "@services/news/NewsService";
import { NewsHeroCarousel } from "./NewsHeroCarousel";
import { timeAgo } from "./relativeTime";

type Props = {
  items: NewsItem[];
  onItemPress: (url: string) => void;
};

const MAX_HERO = 5;

/** Thumbnail with a graceful placeholder when the image is missing or fails. */
function NewsThumb({ uri, source }: { uri: string; source: string }) {
  const { theme } = useAppTheme();
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return (
      <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: `${theme.colors.accent}22` }]}>
        <Text style={{ color: theme.colors.accent, fontWeight: "800", fontSize: 22 }}>
          {source.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.thumb}
      contentFit="cover"
      transition={150}
      onError={() => setFailed(true)}
    />
  );
}

export function NewsFeed({ items, onItemPress }: Props) {
  const { theme } = useAppTheme();

  // Defensive: caller (DiscoverHome) already hides the section when empty.
  if (items.length === 0) return null;

  // Top items that have an image become the swipeable hero carousel;
  // everything else (incl. image-less items) becomes a thumbnail row.
  const heroItems = items.filter((i) => i.image).slice(0, MAX_HERO);
  const heroIds = new Set(heroItems.map((h) => h.id));
  const rows = items.filter((i) => !heroIds.has(i.id));

  return (
    <View style={styles.container}>
      {heroItems.length > 0 && <NewsHeroCarousel items={heroItems} onItemPress={onItemPress} />}

      {rows.map((item) => (
        <Pressable
          key={item.id}
          style={[styles.row, { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border }]}
          onPress={() => onItemPress(item.url)}
        >
          <NewsThumb uri={item.image} source={item.source} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={[styles.rowTitle, { color: theme.colors.textPrimary }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.rowMeta, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {item.source}
              {item.publishedAt ? `  •  ${timeAgo(item.publishedAt)}` : ""}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 76, height: 76, borderRadius: 12 },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 14, fontWeight: "700", lineHeight: 19 },
  rowMeta: { fontSize: 11, fontWeight: "600" },
});
