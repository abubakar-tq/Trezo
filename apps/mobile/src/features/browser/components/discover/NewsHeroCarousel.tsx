import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  Text,
  View,
  StyleSheet,
  FlatList,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "@theme";
import { type NewsItem } from "@services/news/NewsService";
import { timeAgo } from "./relativeTime";

const SIDE_MARGIN = 16;
const ROTATE_MS = 5000;

type Props = {
  items: NewsItem[];
  onItemPress: (url: string) => void;
};

function HeroSlide({ item, width, onPress }: { item: NewsItem; width: number; onPress: () => void }) {
  return (
    <Pressable style={[styles.slide, { width }]} onPress={onPress}>
      <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.2)", "rgba(0,0,0,0.9)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{item.source.toUpperCase()}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        {!!item.publishedAt && <Text style={styles.meta}>{timeAgo(item.publishedAt)}</Text>}
      </View>
    </Pressable>
  );
}

export function NewsHeroCarousel({ items, onItemPress }: Props) {
  const { theme } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = windowWidth - SIDE_MARGIN * 2;

  const listRef = useRef<FlatList<NewsItem>>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  // Auto-advance, looping. Pauses while the user is interacting.
  useEffect(() => {
    if (paused || items.length <= 1 || cardWidth <= 0) return;
    const id = setInterval(() => {
      const next = (indexRef.current + 1) % items.length;
      listRef.current?.scrollToOffset({ offset: next * cardWidth, animated: true });
      setIndex(next);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, items.length, cardWidth]);

  function onMomentumEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = cardWidth > 0 ? Math.round(e.nativeEvent.contentOffset.x / cardWidth) : 0;
    setIndex(Math.max(0, Math.min(i, items.length - 1)));
    setPaused(false);
  }

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: cardWidth, offset: cardWidth * i, index: i })}
        onScrollBeginDrag={() => setPaused(true)}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <HeroSlide item={item} width={cardWidth} onPress={() => onItemPress(item.url)} />
        )}
      />

      {items.length > 1 && (
        <View style={styles.dots}>
          {items.map((item, i) => (
            <View
              key={item.id}
              style={[
                styles.dot,
                i === index
                  ? { width: 18, backgroundColor: theme.colors.accent }
                  : { width: 6, backgroundColor: theme.colors.border },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  slide: {
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: "#1a1d24",
  },
  badge: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  textWrap: { padding: 16, gap: 4 },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", lineHeight: 23 },
  meta: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { height: 6, borderRadius: 3 },
});
