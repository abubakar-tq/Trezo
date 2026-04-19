import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";

type PageIndicatorProps = {
  totalPages: number;
  currentPage: number;
  activeColor?: string;
  inactiveColor?: string;
  size?: "small" | "medium" | "large";
  spacing?: number;
};

type IndicatorDotProps = {
  isActive: boolean;
  width: number;
  height: number;
  activeWidth: number;
  spacing: number;
  activeColor: string;
  inactiveColor: string;
};

const PageIndicator: React.FC<PageIndicatorProps> = ({
  totalPages,
  currentPage,
  activeColor = "#ffffff",
  inactiveColor = "rgba(255, 255, 255, 0.4)",
  size = "medium",
  spacing = 4,
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return { width: 6, height: 6, activeWidth: 20 };
      case "large":
        return { width: 12, height: 12, activeWidth: 36 };
      default:
        return { width: 8, height: 8, activeWidth: 32 };
    }
  };

  const { width, height, activeWidth } = getSizeStyles();

  return (
    <View style={styles.container}>
      {Array.from({ length: totalPages }).map((_, index) => (
        <IndicatorDot
          key={index}
          isActive={index === currentPage}
          width={width}
          height={height}
          activeWidth={activeWidth}
          spacing={spacing}
          activeColor={activeColor}
          inactiveColor={inactiveColor}
        />
      ))}
    </View>
  );
};

const IndicatorDot: React.FC<IndicatorDotProps> = ({
  isActive,
  width,
  height,
  activeWidth,
  spacing,
  activeColor,
  inactiveColor,
}) => {
  const animatedStyle = useAnimatedStyle(
    () => ({
      width: withSpring(isActive ? activeWidth : width),
      height,
      backgroundColor: isActive ? activeColor : inactiveColor,
      borderRadius: height / 2,
      marginHorizontal: spacing / 2,
    }),
    [isActive, width, height, activeWidth, spacing, activeColor, inactiveColor],
  );

  return <Animated.View style={animatedStyle} />;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
  },
});

export default PageIndicator;
