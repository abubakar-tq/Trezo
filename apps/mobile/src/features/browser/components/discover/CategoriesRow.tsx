import React from "react";
import { FlatList, Pressable, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { TOKEN_CATEGORIES, type TokenCategoryId } from "../../data/tokenCategories";

type Props = {
  selected: string | null;
  onSelect: (id: TokenCategoryId | null) => void;
};

const CATEGORY_ICONS: Record<TokenCategoryId, React.ComponentProps<typeof Feather>["name"]> = {
  defi: "layers",
  l2: "git-branch",
  meme: "smile",
  stable: "dollar-sign",
  gaming: "play",
  rwa: "home",
};

export function CategoriesRow({ selected, onSelect }: Props) {
  const { theme } = useAppTheme();

  return (
    <FlatList
      horizontal
      data={TOKEN_CATEGORIES}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => {
        const isActive = selected === item.id;
        const fg = isActive ? theme.colors.textOnAccent : theme.colors.textSecondary;
        return (
          <Pressable
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? theme.colors.accent : theme.colors.surfaceElevated,
                borderColor: isActive ? theme.colors.accent : theme.colors.border,
              },
            ]}
            onPress={() => onSelect(isActive ? null : item.id)}
          >
            <Feather name={CATEGORY_ICONS[item.id]} size={13} color={fg} />
            <Text style={[styles.label, { color: fg }]}>{item.label}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: "600" },
});
