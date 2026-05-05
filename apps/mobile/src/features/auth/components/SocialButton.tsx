import React from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
        colors={["rgba(255,255,255,0.08)", "rgba(255,255,255,0.03)"]}
        style={[styles.button, (disabled || loading) && styles.disabled]}
      >
        <View style={styles.iconContainer}>{icon}</View>
        <Text style={styles.text}>{displayLabel.toUpperCase()}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
    borderColor: "rgba(255,255,255,0.1)",
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
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
});

export default SocialButton;
