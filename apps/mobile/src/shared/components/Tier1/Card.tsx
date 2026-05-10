import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { View, ViewProps } from "react-native";
import { useAppTheme } from "@theme";
import { BorderRadius, Phi, Shadows } from "../TokenRegistry";

type CardVariant = "default" | "elevated" | "glass" | "hero";
type CardSize = "sm" | "md" | "lg";

interface CardProps extends ViewProps {
  variant?: CardVariant;
  size?: CardSize;
  children: React.ReactNode;
}

const getPadding = (size: CardSize): number => {
  switch (size) {
    case "sm": return Phi.phi3;   // 12
    case "lg": return Phi.phi5;   // 32
    default:   return Phi.phi4;   // 20 — golden ratio default (up from 16)
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
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          {
            borderRadius: BorderRadius.lg,
            padding,
            borderWidth: 1,
            borderColor: colors.glassBorder,
          },
          style as any,
        ]}
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

  const borderMap: Record<Exclude<CardVariant, "hero">, string> = {
    default:  colors.border,
    elevated: colors.border,       // elevated now has border too
    glass:    colors.glassBorder,
  };

  const shadowStyle = variant === "elevated" ? Shadows.level2 : Shadows.level1;

  return (
    <View
      style={[
        {
          backgroundColor: bgMap[variant as Exclude<CardVariant, "hero">],
          borderRadius: BorderRadius.lg,
          padding,
          borderWidth: 1,
          borderColor: borderMap[variant as Exclude<CardVariant, "hero">],
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
