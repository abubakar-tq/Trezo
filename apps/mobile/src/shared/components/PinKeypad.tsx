import { Feather } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@theme";

type Props = {
  pin: string;
  length?: number;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
};

const KEYS: ReadonlyArray<string> = [
  "1", "2", "3",
  "4", "5", "6",
  "7", "8", "9",
  "", "0", "back",
];

const PinKeypad: React.FC<Props> = ({ pin, length = 6, onDigit, onBackspace, disabled }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const handlePress = useCallback(
    (key: string) => {
      if (disabled) return;
      if (key === "back") onBackspace();
      else if (key) onDigit(key);
    },
    [disabled, onDigit, onBackspace],
  );

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i < pin.length ? colors.accent : "transparent",
                borderColor: i < pin.length ? colors.accent : colors.border,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {KEYS.map((key, idx) => {
          if (!key) return <View key={idx} style={styles.keyBtn} />;
          const isBack = key === "back";
          return (
            <Pressable
              key={idx}
              onPress={() => handlePress(key)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.keyBtn,
                {
                  backgroundColor: pressed ? colors.surfaceCard : `${colors.surfaceCard}99`,
                  borderColor: colors.border,
                  opacity: disabled ? 0.4 : 1,
                },
              ]}
            >
              {isBack ? (
                <Feather name="delete" size={22} color={colors.textPrimary} />
              ) : (
                <Text style={[styles.keyText, { color: colors.textPrimary }]}>{key}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default PinKeypad;

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    gap: 26,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 14,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
  },
  keypad: {
    width: 264,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
  },
  keyBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  keyText: {
    fontSize: 26,
    fontWeight: "700",
  },
});
