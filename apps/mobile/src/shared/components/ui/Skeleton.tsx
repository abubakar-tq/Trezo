/**
 * Reusable skeleton loading components
 * Provides consistent loading states across the app
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

/**
 * Base skeleton element with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 800 }),
        withTiming(0.3, { duration: 800 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: withAlpha(colors.textPrimary, 0.12),
        },
        animatedStyle,
        style,
      ]}
    />
  );
};

/**
 * Market token list item skeleton
 */
export const MarketTokenSkeleton: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = createMarketStyles(colors);

  return (
    <View style={styles.container}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Skeleton width="40%" height={16} />
          <Skeleton width={60} height={14} style={styles.priceShimmer} />
        </View>
        <View style={styles.detailRow}>
          <Skeleton width="30%" height={14} />
          <Skeleton width={50} height={14} />
        </View>
      </View>
    </View>
  );
};

/**
 * Card skeleton for dashboard cards
 */
export const CardSkeleton: React.FC<{ height?: number }> = ({ height = 120 }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  return (
    <View
      style={{
        height,
        backgroundColor: colors.surfaceCard,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <Skeleton width="60%" height={20} style={{ marginBottom: 12 }} />
      <Skeleton width="40%" height={16} style={{ marginBottom: 8 }} />
      <Skeleton width="80%" height={14} />
    </View>
  );
};

/**
 * Avatar skeleton
 */
export const AvatarSkeleton: React.FC<{ size?: number }> = ({ size = 48 }) => {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
};

/**
 * Text line skeleton
 */
export const TextLineSkeleton: React.FC<{
  width?: number | string;
  height?: number;
}> = ({ width = "100%", height = 16 }) => {
  return <Skeleton width={width} height={height} borderRadius={4} />;
};

const createMarketStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.surfaceCard,
      marginBottom: 8,
      borderRadius: 12,
    },
    content: {
      flex: 1,
      marginLeft: 12,
    },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    priceShimmer: {
      marginLeft: 8,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
  });
