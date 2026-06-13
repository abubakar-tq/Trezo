import { LinearGradient } from "expo-linear-gradient";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

type GradientColors =
  | readonly [string, string]
  | readonly [string, string, string];

type AuthGradientButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  colors?: GradientColors;
  testID?: string;
};

const DEFAULT_GRADIENT: GradientColors = ["#7955a0", "#6d52d6", "#0088ff"];

const AuthGradientButton: React.FC<AuthGradientButtonProps> = ({
  label,
  onPress,
  disabled = false,
  colors = DEFAULT_GRADIENT,
  testID,
}) => {
  const { theme } = useAppTheme();
  const { colors: themeColors } = theme;
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.9}
      disabled={disabled}
      onPress={onPress}
      style={[styles.container, disabled && styles.disabled]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradient}
      >
        <Text style={styles.text}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    borderRadius: 999,
    overflow: "hidden",
  },
  disabled: {
    opacity: 0.6,
  },
  gradient: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  text: {
    color: colors.textOnAccent,
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default AuthGradientButton;
