import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

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
        locations={[0, 0.45, 1]}
        style={styles.gradient}
      >
        <Text style={styles.text}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default AuthGradientButton;
