import React, { useEffect, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { CryptoPanicService, type NewsItem } from "@services/news/CryptoPanicService";

type Props = {
  onItemPress: (url: string) => void;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function NewsFeed({ onItemPress }: Props) {
  const { theme } = useAppTheme();
  const [items, setItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    CryptoPanicService.fetchTop(12).then(setItems);
  }, []);

  // Graceful hide when token is missing or fetch returns nothing
  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      {items.map((item, idx) => (
        <Pressable
          key={item.id}
          style={[
            styles.row,
            { backgroundColor: theme.colors.surfaceElevated },
            idx < items.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderMuted },
          ]}
          onPress={() => onItemPress(item.url)}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={[styles.meta, { color: theme.colors.textSecondary }]}>
              {item.source}
              {item.publishedAt ? `  •  ${formatDate(item.publishedAt)}` : ""}
            </Text>
          </View>
          <Feather name="chevron-right" size={14} color={theme.colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  title: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  meta: { fontSize: 11, fontWeight: "500" },
});
