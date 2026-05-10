import React, { useMemo } from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

type SocialButtonProps = {
  label: string;
  icon: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
};

const SocialButton: React.FC<SocialButtonProps> = ({
  label,
  icon,
  onPress,
  style,
  testID,
  disabled = false,
  loading = false,
  loadingLabel,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const displayLabel = loading ? loadingLabel ?? "Connecting..." : label;

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.container, style]}
    >
      <LinearGradient
        colors={[`${colors.textPrimary}14`, `${colors.textPrimary}08`] as const}
        style={[styles.button, (disabled || loading) && styles.disabled]}
      >
        <View style={styles.iconContainer}>{icon}</View>
        <Text style={styles.text}>{displayLabel.toUpperCase()}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    borderRadius: 20,
    overflow: "hidden",
    height: 48,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderColor: `${colors.textPrimary}1A`,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.4,
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
});

export default SocialButton;
