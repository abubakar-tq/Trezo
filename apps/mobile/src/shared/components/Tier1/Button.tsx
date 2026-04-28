import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";
import { Colors, BorderRadius, OpacityStates } from "../TokenRegistry";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "outline" | "gradient" | "ghost" | "tertiary";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  colors?: readonly [string, string, ...string[]];
  isDark?: boolean;
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
  colors,
  isDark = true,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
    opacity.value = withSpring(0.9);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withSpring(1);
  };

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return { paddingVertical: 8, paddingHorizontal: 16, minHeight: 32 };
      case "lg":
        return { paddingVertical: 16, paddingHorizontal: 32, minHeight: 56 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 24, minHeight: 44 };
    }
  };

  const getTextSizeStyles = () => {
    switch (size) {
      case "sm":
        return { fontSize: 13 };
      case "lg":
        return { fontSize: 18 };
      default:
        return { fontSize: 15 };
    }
  };

  const getVariantStyles = () => {
    if (disabled || isLoading) {
      return { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' };
    }

    switch (variant) {
      case "secondary":
        return { backgroundColor: isDark ? Colors.surface : Colors.lightSurface, borderWidth: 1, borderColor: Colors.primary };
      case "tertiary":
        return { backgroundColor: isDark ? Colors.surfaceMid : Colors.lightCard };
      case "outline":
        return { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: isDark ? '#ffffff' : Colors.primary };
      case "ghost":
        return { backgroundColor: 'transparent' };
      case "gradient":
        return {};
      default:
        return { backgroundColor: isDark ? Colors.primary : Colors.primary };
    }
  };

  const getTextColor = () => {
    if (disabled || isLoading) {
      return isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
    }

    switch (variant) {
      case "primary":
      case "gradient":
      case "secondary":
        return "#ffffff";
      case "outline":
        return isDark ? '#ffffff' : Colors.primary;
      default:
        return isDark ? Colors.textPrimary : Colors.lightTextPrimary;
    }
  };

  const buttonContent = (
    <View
      style={[
        styles.buttonContent,
        getSizeStyles(),
        fullWidth && styles.fullWidth,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              getTextSizeStyles(),
              { color: getTextColor() },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  if (variant === "gradient") {
    const defaultColors: readonly [string, string, string] = [
      "#1877f2",
      "#6945ed",
      "#8b5cf6",
    ];
    const gradientColors = colors || defaultColors;

    return (
      <AnimatedTouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || isLoading}
        style={[animatedStyle, fullWidth && styles.fullWidth]}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
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
      style={[
        animatedStyle,
        styles.button,
        getVariantStyles(),
        fullWidth && styles.fullWidth,
      ]}
    >
      {buttonContent}
    </AnimatedTouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullWidth: {
    width: '100%',
  },
  iconContainer: {
    // marginRight is handled by gap
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  button: {
    borderRadius: BorderRadius.lg,
  },
  gradient: {
    borderRadius: BorderRadius.lg,
  },
});

export const PrimaryButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="primary" {...props} />;
export const SecondaryButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="secondary" {...props} />;
export const TertiaryButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="tertiary" {...props} />;
export const GhostButton: React.FC<Omit<ButtonProps, "variant">> = (props) => <Button variant="ghost" {...props} />;
