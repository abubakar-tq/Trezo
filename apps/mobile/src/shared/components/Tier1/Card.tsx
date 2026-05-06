import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { View, ViewProps } from "react-native";
import { useAppTheme } from "@theme";
import { BorderRadius, Shadows, Spacing } from "../TokenRegistry";

type CardVariant = "default" | "elevated" | "glass" | "hero";
type CardSize = "sm" | "md" | "lg";

interface CardProps extends ViewProps {
  variant?: CardVariant;
  size?: CardSize;
  children: React.ReactNode;
}

const getPadding = (size: CardSize): number => {
  switch (size) {
    case "sm": return Spacing.sp3;
    case "lg": return Spacing.sp6;
    default:   return Spacing.sp4;
  }
};

export const Card: React.FC<CardProps> = ({
  variant = "default",
  size = "md",
  children,
  style,
  ...props
}) => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;
  const padding = getPadding(size);

  if (variant === "hero") {
    return (
      <LinearGradient
        colors={gradients.hero}
        style={[{ borderRadius: BorderRadius.lg, padding }, style as any]}
      >
        {children}
      </LinearGradient>
    );
  }

  const bgMap: Record<Exclude<CardVariant, "hero">, string> = {
    default:  colors.surfaceCard,
    elevated: colors.surfaceElevated,
    glass:    colors.glass,
  };

  const borderMap: Record<Exclude<CardVariant, "hero">, string | undefined> = {
    default:  colors.border,
    elevated: undefined,
    glass:    colors.glassBorder,
  };

  const shadowStyle = variant === "elevated" ? Shadows.level1 : {};
  const borderColor = borderMap[variant as Exclude<CardVariant, "hero">];

  return (
    <View
      style={[
        {
          backgroundColor: bgMap[variant as Exclude<CardVariant, "hero">],
          borderRadius: BorderRadius.lg,
          padding,
          borderWidth: borderColor ? 1 : 0,
          borderColor,
          ...shadowStyle,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};
