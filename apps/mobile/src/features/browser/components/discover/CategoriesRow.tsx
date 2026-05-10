import React from "react";
import { FlatList, Pressable, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@theme";
import { TOKEN_CATEGORIES, type TokenCategoryId } from "../../data/tokenCategories";

type Props = {
  selected: string | null;
  onSelect: (id: TokenCategoryId | null) => void;
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
            <Text
              style={[
                styles.label,
                { color: isActive ? theme.colors.textOnAccent : theme.colors.textSecondary },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: "600" },
});
