import { Feather } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAppTheme } from "@theme";

type Props = {
  pin: string;
  length?: number;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
};

type Key = string;

// Explicit rows + flex:1 cells. This is the layout pattern used by every
// stable React Native pin/dialer (Stripe Identity, Plaid Link, etc.). flexWrap
// + gap silently breaks on Huawei / Tecno / older Android — never use it for
// fixed-column grids.
const ROWS: ReadonlyArray<ReadonlyArray<Key>> = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "back"],
];

// Responsive: scale the key size to ~28% of screen width but clamp it. This
// keeps the keypad readable on small phones (Pixel 4a, iPhone SE) and prevents
// it from looking comical on tablets.
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const KEY_SIZE = Math.max(60, Math.min(78, Math.round(SCREEN_WIDTH * 0.2)));
const ROW_GAP = 16;

const PinKeypad: React.FC<Props> = ({
  pin,
  length = 6,
  onDigit,
  onBackspace,
  disabled,
}) => {
  const { theme } = useAppTheme();
  const { colors, mode } = theme;

  const handlePress = useCallback(
    (key: string) => {
      if (disabled) return;
      if (key === "back") onBackspace();
      else if (key) onDigit(key);
    },
    [disabled, onDigit, onBackspace],
  );

  const dotFilled = colors.accent;
  const dotEmptyBorder = mode === "dark" ? `${colors.border}CC` : `${colors.border}DD`;
  const dotEmptyFill = mode === "dark" ? `${colors.surfaceMuted}55` : `${colors.surfaceMuted}77`;

  const keyFill = mode === "dark" ? colors.surfaceCard : `${colors.surfaceElevated}FA`;
  const keyFillPressed = mode === "dark" ? `${colors.accent}33` : `${colors.accent}1F`;
  const keyBorder = mode === "dark" ? `${colors.border}99` : `${colors.border}77`;

  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {Array.from({ length }, (_, i) => {
          const filled = i < pin.length;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: filled ? dotFilled : dotEmptyFill,
                  borderColor: filled ? dotFilled : dotEmptyBorder,
                  transform: filled ? [{ scale: 1.15 }] : [{ scale: 1 }],
                },
              ]}
            />
          );
        })}
      </View>

      <View style={styles.keypad}>
        {ROWS.map((row, rowIdx) => (
          <View
            key={rowIdx}
            style={[
              styles.keypadRow,
              rowIdx < ROWS.length - 1 ? { marginBottom: ROW_GAP } : null,
            ]}
          >
            {row.map((key, colIdx) => (
              <View key={colIdx} style={styles.cell}>
                {key ? (
                  <Pressable
                    onPress={() => handlePress(key)}
                    disabled={disabled}
                    android_ripple={{
                      color: `${colors.accent}44`,
                      borderless: false,
                      radius: KEY_SIZE / 2,
                    }}
                    style={({ pressed }) => [
                      styles.keyBtn,
                      {
                        backgroundColor: pressed ? keyFillPressed : keyFill,
                        borderColor: keyBorder,
                        opacity: disabled ? 0.4 : 1,
                      },
                    ]}
                  >
                    {key === "back" ? (
                      <Feather
                        name="delete"
                        size={Math.round(KEY_SIZE * 0.32)}
                        color={colors.textPrimary}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.keyText,
                          {
                            color: colors.textPrimary,
                            fontSize: Math.round(KEY_SIZE * 0.38),
                          },
                        ]}
                      >
                        {key}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

export default PinKeypad;

const KEYPAD_WIDTH = Math.min(SCREEN_WIDTH * 0.85, KEY_SIZE * 3 + 56);

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 24,
  },
  dot: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1.2,
    marginHorizontal: 7,
  },
  keypad: {
    width: KEYPAD_WIDTH,
    maxWidth: "100%",
  },
  keypadRow: {
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: KEY_SIZE,
  },
  keyBtn: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    overflow: "hidden",
  },
  keyText: {
    fontWeight: "700",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
});
