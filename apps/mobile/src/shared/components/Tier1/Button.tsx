import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { BorderRadius, OpacityStates } from "../TokenRegistry";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger" | "gradient";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  gradientColors?: readonly [string, string, ...string[]];
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  isLoading = false,
  icon,
  fullWidth = false,
  gradientColors,
}) => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;

  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
    opacity.value = withSpring(OpacityStates.hover);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withSpring(OpacityStates.default);
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm": return { paddingVertical: 8, paddingHorizontal: 16, minHeight: 32 };
      case "lg": return { paddingVertical: 16, paddingHorizontal: 32, minHeight: 56 };
      default:   return { paddingVertical: 12, paddingHorizontal: 24, minHeight: 44 };
    }
  };

  const getTextSize = () => {
    switch (size) {
      case "sm": return 13;
      case "lg": return 18;
      default:   return 15;
    }
  };

  const getVariantBg = (): string => {
    if (disabled || isLoading) return colors.surfaceMuted;
    switch (variant) {
      case "primary":   return colors.accent;
      case "secondary": return colors.surface;
      case "tertiary":  return colors.surfaceCard;
      case "danger":    return colors.danger;
      default:          return "transparent";
    }
  };

  const getTextColor = (): string => {
    if (disabled || isLoading) return colors.textMuted;
    switch (variant) {
      case "primary":   return colors.textOnAccent;
      case "secondary": return colors.accent;
      case "danger":    return "#ffffff";
      case "gradient":  return "#ffffff";
      default:          return colors.text;
    }
  };

  const getBorderStyle = () => {
    switch (variant) {
      case "secondary": return { borderWidth: 1, borderColor: colors.accent };
      case "outline":   return { borderWidth: 1.5, borderColor: withAlpha(colors.text, 0.35) };
      default:          return {};
    }
  };

  const buttonContent = (
    <View style={[styles.content, getSizeStyles(), fullWidth && styles.fullWidth]}>
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text style={[styles.label, { fontSize: getTextSize(), color: getTextColor() }]}>
            {label}
          </Text>
        </>
      )}
    </View>
  );

  if (variant === "gradient") {
    const gc = gradientColors ?? (gradients.brand as readonly [string, string, ...string[]]);
    return (
      <AnimatedTouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        activeOpacity={1}
        style={[animatedStyle, fullWidth && styles.fullWidth]}
      >
        <LinearGradient
          colors={gc}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, fullWidth && styles.fullWidth]}
        >
          {buttonContent}
        </LinearGradient>
      </AnimatedTouchableOpacity>
    );
  }

  return (
    <AnimatedTouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || isLoading}
      activeOpacity={1}
      style={[
        animatedStyle,
        styles.button,
        { backgroundColor: getVariantBg() },
        getBorderStyle(),
        fullWidth && styles.fullWidth,
      ]}
    >
      {buttonContent}
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button:   { borderRadius: BorderRadius.lg },
  content:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  fullWidth: { width: "100%" },
  label:    { fontWeight: "700", letterSpacing: 0.3 },
});

export const PrimaryButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="primary" {...props} />;
export const SecondaryButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="secondary" {...props} />;
export const TertiaryButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="tertiary" {...props} />;
export const GhostButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="ghost" {...props} />;
