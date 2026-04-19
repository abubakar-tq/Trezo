import React from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";

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
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      <View style={styles.iconContainer}>{icon}</View>
      <Text style={styles.text}>{displayLabel}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1f1b23",
    borderColor: "#1c1c1c",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disabled: {
    opacity: 0.6,
  },
  iconContainer: {
    marginRight: 12,
  },
  text: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "500",
  },
});

export default SocialButton;
