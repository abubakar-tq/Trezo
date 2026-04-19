import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from "react-native-reanimated";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "gradient";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
  colors?: readonly [string, string, ...string[]];
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  icon,
  fullWidth = false,
  colors,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95);
    opacity.value = withSpring(0.8);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
    opacity.value = withSpring(1);
  };

  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return { paddingVertical: 8, paddingHorizontal: 16 };
      case "large":
        return { paddingVertical: 14, paddingHorizontal: 32 };
      default:
        return { paddingVertical: 16, paddingHorizontal: 24 };
    }
  };

  const getTextSizeStyles = () => {
    switch (size) {
      case "small":
        return { fontSize: 14 };
      case "large":
        return { fontSize: 20 };
      default:
        return { fontSize: 18 };
    }
  };

  const getVariantStyles = () => {
    if (disabled) {
      return { backgroundColor: '#9ca3af' };
    }

    switch (variant) {
      case "secondary":
        return { backgroundColor: '#4b5563' };
      case "outline":
        return { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#ffffff' };
      case "gradient":
        return {};
      default:
        return { backgroundColor: '#ffffff' };
    }
  };

  const getTextVariantStyles = () => {
    if (disabled) {
      return { color: '#4b5563' };
    }

    switch (variant) {
      case "outline":
      case "secondary":
      case "gradient":
        return { color: '#ffffff' };
      default:
        return { color: '#111827' };
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
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text
        style={[
          styles.text,
          getTextSizeStyles(),
          getTextVariantStyles(),
        ]}
      >
        {loading ? "Loading..." : title}
      </Text>
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
        disabled={disabled || loading}
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
      disabled={disabled || loading}
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
  },
  fullWidth: {
    width: '100%',
  },
  iconContainer: {
    marginRight: 8,
  },
  text: {
    fontWeight: '600',
  },
  button: {
    borderRadius: 24,
  },
  gradient: {
    borderRadius: 24,
  },
});

export default Button;
