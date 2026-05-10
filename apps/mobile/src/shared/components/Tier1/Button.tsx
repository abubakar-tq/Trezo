import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useAppTheme } from "@theme";
import {
  BorderRadius,
  CeremonialColors,
  GlowShadows,
  SpringConfig,
  TouchTargets,
} from "../TokenRegistry";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "tertiary" | "outline" | "ghost" | "danger" | "gradient" | "ceremonial";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
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
  iconRight,
  fullWidth = false,
  gradientColors,
}) => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, SpringConfig.interaction);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, SpringConfig.interaction);
  };

  const getHeight = () => {
    switch (size) {
      case "sm": return TouchTargets.min;        // 44
      case "lg": return 56;
      default:   return TouchTargets.comfort;    // 52
    }
  };

  const getHorizontalPad = () => {
    switch (size) {
      case "sm": return 16;
      case "lg": return 36;
      default:   return 28;
    }
  };

  const getTextSize = () => {
    switch (size) {
      case "sm": return 13;
      case "lg": return 17;
      default:   return 15;
    }
  };

  const getBorderRadius = () => {
    switch (variant) {
      case "primary":
      case "gradient":
      case "ceremonial":
        return BorderRadius.xl;   // 24 — pill-like for primary CTAs
      default:
        return BorderRadius.lg;   // 16 — contained for secondary actions
    }
  };

  const getVariantBg = (): string => {
    if (disabled || isLoading) return colors.surfaceMuted;
    switch (variant) {
      case "primary":    return colors.accent;
      case "secondary":  return colors.accentSoft;
      case "tertiary":   return colors.surfaceCard;
      case "danger":     return colors.dangerSoft;
      case "ceremonial": return CeremonialColors.goldSoft;
      default:           return "transparent";
    }
  };

  const getTextColor = (): string => {
    if (disabled || isLoading) return colors.textMuted;
    switch (variant) {
      case "primary":    return colors.textOnAccent;
      case "secondary":  return colors.accent;
      case "danger":     return colors.danger;
      case "gradient":   return colors.textOnHero;
      case "ceremonial": return CeremonialColors.gold;
      default:           return colors.text;
    }
  };

  const getBorderStyle = (): object => {
    if (disabled || isLoading) return {};
    switch (variant) {
      case "secondary":  return { borderWidth: 1, borderColor: colors.border };
      case "outline":    return { borderWidth: 1.5, borderColor: `${colors.text}33` };
      case "danger":     return { borderWidth: 1, borderColor: colors.danger };
      case "ceremonial": return { borderWidth: 1, borderColor: CeremonialColors.goldHairline };
      case "ghost":      return { borderWidth: 1, borderColor: colors.borderMuted };
      default:           return {};
    }
  };

  const getGlowStyle = (): object => {
    if (disabled || isLoading) return {};
    switch (variant) {
      case "primary":
      case "gradient":   return GlowShadows.violet;
      case "ceremonial": return GlowShadows.gold;
      default:           return {};
    }
  };

  const contentStyle = {
    height: getHeight(),
    paddingHorizontal: getHorizontalPad(),
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
  };

  const labelStyle = {
    fontSize: getTextSize(),
    fontWeight: "600" as const,
    color: getTextColor(),
    letterSpacing: variant === "primary" || variant === "ceremonial" ? 0.5 : 0.3,
  };

  const innerContent = isLoading ? (
    <ActivityIndicator color={getTextColor()} size="small" />
  ) : (
    <>
      {icon && <View>{icon}</View>}
      <Text style={labelStyle}>{label}</Text>
      {iconRight && <View>{iconRight}</View>}
    </>
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
        style={[animatedStyle, fullWidth && styles.fullWidth, getGlowStyle()]}
      >
        <LinearGradient
          colors={gc}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[{ borderRadius: getBorderRadius() }, fullWidth && styles.fullWidth]}
        >
          <View style={[contentStyle, fullWidth && styles.fullWidth]}>
            {innerContent}
          </View>
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
        {
          backgroundColor: getVariantBg(),
          borderRadius: getBorderRadius(),
        },
        getBorderStyle(),
        getGlowStyle(),
        fullWidth && styles.fullWidth,
      ]}
    >
      <View style={[contentStyle, fullWidth && styles.fullWidth]}>
        {innerContent}
      </View>
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  fullWidth: { width: "100%" },
});

export const PrimaryButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="primary" {...props} />;
export const SecondaryButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="secondary" {...props} />;
export const TertiaryButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="tertiary" {...props} />;
export const GhostButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="ghost" {...props} />;
export const CeremonialButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="ceremonial" {...props} />;
