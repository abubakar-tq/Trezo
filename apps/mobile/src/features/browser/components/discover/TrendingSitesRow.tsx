import React, { useState } from "react";
import { FlatList, Pressable, Text, View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useAppTheme } from "@theme";
import { TRENDING_SITES } from "../../data/trendingSites";

type Props = {
  onPress: (url: string) => void;
};

// On-brand violet constants — no rainbow palette.
const ICON_BG = "rgba(124,58,237,0.14)";
const ICON_GLYPH = "#c4b5fd";

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

/** Real site favicon from DuckDuckGo, falling back to a violet letter badge. */
function SiteIcon({ url, name }: { url: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const host = hostOf(url);

  if (!host || failed) {
    return (
      <View style={[styles.iconCircle, { backgroundColor: ICON_BG }]}>
        <Text style={[styles.iconLetter, { color: ICON_GLYPH }]}>{name.charAt(0)}</Text>
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
      renderItem={({ item }) => (
        <Pressable
          style={[
            styles.card,
            { backgroundColor: theme.colors.surfaceElevated, borderColor: theme.colors.border },
          ]}
          onPress={() => onPress(item.url)}
        >
          <SiteIcon url={item.url} name={item.name} />
          <Text style={[styles.name, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.category, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {item.category}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
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
