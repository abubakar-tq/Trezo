/**
 * Button Component
 * Variants: Primary (filled), Secondary (outline), Tertiary (ghost), Ghost (text-only)
 * States: Default, Loading, Disabled
 */

import React from "react";
import {
    ActivityIndicator,
    TouchableOpacity,
    View,
    ViewProps,
} from "react-native";
import { BodyText } from "./Text";
import { BorderRadius, Colors, OpacityStates } from "../TokenRegistry";

type ButtonVariant = "primary" | "secondary" | "tertiary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<ViewProps, "style"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label: string;
  onPress?: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  isDark?: boolean;
  icon?: React.ReactNode;
}

const getButtonStyles = (
  variant: ButtonVariant,
  isDark: boolean,
  size: ButtonSize,
) => {
  const sizeMap = {
    sm: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 32 },
    md: { paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 },
    lg: { paddingVertical: 16, paddingHorizontal: 20, minHeight: 56 },
  };

  const baseStyles = {
    borderRadius: BorderRadius.md,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    flexDirection: "row" as const,
    gap: 8,
    ...sizeMap[size],
  };

  switch (variant) {
    case "primary":
      return {
        ...baseStyles,
        backgroundColor: Colors.primary,
      };

    case "secondary":
      return {
        ...baseStyles,
        backgroundColor: isDark ? Colors.surface : Colors.lightSurface,
        borderWidth: 1,
        borderColor: Colors.primary,
      };

    case "tertiary":
      return {
        ...baseStyles,
        backgroundColor: isDark ? Colors.surfaceMid : Colors.lightCard,
      };

    case "ghost":
      return {
        ...baseStyles,
        backgroundColor: "transparent",
      };

    default:
      return baseStyles;
  }
};

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  label,
  onPress,
  isLoading = false,
  disabled = false,
  isDark = true,
  icon,
  ...props
}) => {
  const isDisabled = disabled || isLoading;
  const styles = getButtonStyles(variant, isDark, size);

  const textColor =
    variant === "primary"
      ? "#ffffff"
      : isDark
        ? Colors.textPrimary
        : Colors.lightTextPrimary;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={OpacityStates.active}
    >
      <View
        style={[
          styles,
          {
            opacity: isDisabled
              ? OpacityStates.disabled
              : OpacityStates.default,
          },
        ]}
        {...props}
      >
        {isLoading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          <>
            {icon}
            <BodyText color={textColor}>{label}</BodyText>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

/**
 * Convenience factories
 */
export const PrimaryButton: React.FC<Omit<ButtonProps, "variant">> = (
  props,
) => <Button variant="primary" {...props} />;

export const SecondaryButton: React.FC<Omit<ButtonProps, "variant">> = (
  props,
) => <Button variant="secondary" {...props} />;

export const TertiaryButton: React.FC<Omit<ButtonProps, "variant">> = (
  props,
) => <Button variant="tertiary" {...props} />;

export const GhostButton: React.FC<Omit<ButtonProps, "variant">> = (props) => (
  <Button variant="ghost" {...props} />
);
