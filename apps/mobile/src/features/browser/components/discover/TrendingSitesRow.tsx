import React, { useState } from "react";
import { FlatList, Pressable, Text, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useAppTheme } from "@theme";
import { TRENDING_SITES } from "../../data/trendingSites";

type Props = {
  onPress: (url: string) => void;
};

const ACCENT_PALETTE = ["#6C63FF", "#3DDC84", "#FF6B6B", "#F7C948", "#4FC3F7", "#FF7043"];

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Real site favicon from DuckDuckGo, falling back to a colored letter badge. */
function SiteIcon({ url, name, color }: { url: string; name: string; color: string }) {
  const [failed, setFailed] = useState(false);
  const host = hostOf(url);

  if (!host || failed) {
    return (
      <View style={[styles.iconCircle, { backgroundColor: `${color}22` }]}>
        <Text style={[styles.iconLetter, { color }]}>{name.charAt(0)}</Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: `https://icons.duckduckgo.com/ip3/${host}.ico` }}
      style={styles.iconImg}
      contentFit="contain"
      transition={150}
      onError={() => setFailed(true)}
    />
  );
}

export function TrendingSitesRow({ onPress }: Props) {
  const { theme } = useAppTheme();

  return (
    <FlatList
      horizontal
      data={TRENDING_SITES}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item, index }) => {
        const color = ACCENT_PALETTE[index % ACCENT_PALETTE.length];
        return (
          <Pressable
            style={[
              styles.card,
              { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
            ]}
            onPress={() => onPress(item.url)}
          >
            <SiteIcon url={item.url} name={item.name} color={color} />
            <Text style={[styles.name, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.category, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {item.category}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  iconImg: { width: 40, height: 40, borderRadius: 20, marginBottom: 2 },
  iconLetter: { fontSize: 18, fontWeight: "700" },
  name: { fontSize: 12, fontWeight: "700" },
  category: { fontSize: 11, fontWeight: "500" },
});
