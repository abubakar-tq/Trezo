import React, { useState } from "react";
import { TextInput, Pressable, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";

export type SearchIntent = { kind: "url" | "ticker" | "search"; value: string };

type Props = {
  onSubmit: (intent: SearchIntent) => void;
  onTabsPress: () => void;
};

const URL_PATTERN = /^(https?:\/\/|[\w-]+\.[a-z]{2,})/i;
const TICKER_PATTERN = /^\$?[A-Za-z]{2,10}$/;

export function UnifiedSearchBar({ onSubmit, onTabsPress }: Props) {
  const [value, setValue] = useState("");
  const { theme } = useAppTheme();

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    if (URL_PATTERN.test(v)) {
      onSubmit({ kind: "url", value: v.startsWith("http") ? v : `https://${v}` });
    } else if (TICKER_PATTERN.test(v)) {
      onSubmit({ kind: "ticker", value: v.replace(/^\$/, "").toUpperCase() });
    } else {
      onSubmit({ kind: "search", value: v });
    }
  };

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: theme.colors.surfaceCard,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Feather name="search" size={18} color={theme.colors.textSecondary} />
      <TextInput
        style={[styles.input, { color: theme.colors.textPrimary }]}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submit}
        placeholder="Search sites, tokens, or URLs"
        placeholderTextColor={theme.colors.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      <Pressable onPress={onTabsPress} hitSlop={10}>
        <Feather name="layers" size={20} color={theme.colors.textPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 999,
    gap: 8,
    borderWidth: 1,
  },
  input: { flex: 1, fontSize: 14 },
});
