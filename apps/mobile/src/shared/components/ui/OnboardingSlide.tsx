import { BlurMask, Canvas, Circle } from "@shopify/react-native-skia";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_W } = Dimensions.get("window");

type OnboardingSlideProps = {
  ImageComponent: React.ComponentType<{ width: string | number; height: string | number }>;
  title: string;
  subtitle: string;
  badge: string;
  index: number;
  isActive: boolean;
  accentColor: string;
  glowColor: string;
};

const IMAGE_SIZE = SCREEN_W * 0.74;

const OnboardingSlide: React.FC<OnboardingSlideProps> = ({
  ImageComponent,
  title,
  subtitle,
  badge,
  isActive,
  accentColor,
  glowColor,
}) => {
  const floatY = useSharedValue(0);
  const floatRotate = useSharedValue(-2);

  const imageX = useSharedValue(80);
  const imageScale = useSharedValue(0.8);
  const titleX = useSharedValue(-60);
  const badgeOpacity = useSharedValue(0);
  const badgeY = useSharedValue(18);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(14);

  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-20, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    floatRotate.value = withRepeat(
      withTiming(2, { duration: 3800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [floatY, floatRotate]);

  useEffect(() => {
    if (isActive) {
      imageX.value = withSpring(0, { damping: 18, stiffness: 75 });
      imageScale.value = withSpring(1, { damping: 16, stiffness: 65 });
      titleX.value = withDelay(100, withSpring(0, { damping: 22, stiffness: 90 }));
      badgeOpacity.value = withDelay(200, withTiming(1, { duration: 320 }));
      badgeY.value = withDelay(200, withSpring(0, { damping: 20, stiffness: 100 }));
      subtitleOpacity.value = withDelay(300, withTiming(1, { duration: 380 }));
      subtitleY.value = withDelay(300, withSpring(0, { damping: 20, stiffness: 90 }));
    } else {
      imageX.value = 80;
      imageScale.value = 0.8;
      titleX.value = -60;
      badgeOpacity.value = 0;
      badgeY.value = 18;
      subtitleOpacity.value = 0;
      subtitleY.value = 14;
    }
  }, [isActive, imageX, imageScale, titleX, badgeOpacity, badgeY, subtitleOpacity, subtitleY]);

  const imageAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: imageX.value },
      { translateY: floatY.value },
      { scale: imageScale.value },
      { rotate: `${floatRotate.value}deg` },
    ],
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: titleX.value }],
  }));

  const badgeAnimStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeY.value }],
  }));

  const subtitleAnimStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleY.value }],
  }));

  const glowCx = SCREEN_W / 2;

  return (
    <View style={styles.slide}>
      {/* Skia glow blobs — static, GPU-composited, essentially free */}
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Circle cx={glowCx} cy={220} r={IMAGE_SIZE * 0.52} color={glowColor}>
          <BlurMask blur={90} style="normal" />
        </Circle>
        <Circle cx={glowCx} cy={220} r={IMAGE_SIZE * 0.28} color={glowColor}>
          <BlurMask blur={45} style="normal" />
        </Circle>
        {/* Floating accent dots for depth */}
        <Circle cx={SCREEN_W * 0.12} cy={160} r={7} color={`${accentColor}55`}>
          <BlurMask blur={8} style="normal" />
        </Circle>
        <Circle cx={SCREEN_W * 0.88} cy={260} r={5} color={`${accentColor}45`}>
          <BlurMask blur={6} style="normal" />
        </Circle>
        <Circle cx={SCREEN_W * 0.08} cy={380} r={4} color={`${accentColor}38`}>
          <BlurMask blur={5} style="normal" />
        </Circle>
        <Circle cx={SCREEN_W * 0.92} cy={340} r={6} color={`${accentColor}40`}>
          <BlurMask blur={7} style="normal" />
        </Circle>
        <Circle cx={SCREEN_W * 0.2} cy={70} r={3} color={`${accentColor}30`}>
          <BlurMask blur={4} style="normal" />
        </Circle>
      </Canvas>

      {/* Image area */}
      <View style={styles.imageArea}>
        <Animated.View style={imageAnimStyle}>
          <ImageComponent width={IMAGE_SIZE} height={IMAGE_SIZE} />
        </Animated.View>
      </View>

      {/* Text area */}
      <View style={styles.textArea}>
        <Animated.View style={[styles.badge, { backgroundColor: `${accentColor}1A`, borderColor: `${accentColor}55` }, badgeAnimStyle]}>
          <View style={[styles.badgeDot, { backgroundColor: accentColor }]} />
          <Text style={[styles.badgeText, { color: accentColor }]}>{badge}</Text>
        </Animated.View>

        <Animated.Text style={[styles.title, titleAnimStyle]}>
          {title}
        </Animated.Text>

        <Animated.Text style={[styles.subtitle, subtitleAnimStyle]}>
          {subtitle}
        </Animated.Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  slide: {
    width: SCREEN_W,
    flex: 1,
  },
  imageArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  textArea: {
    paddingHorizontal: 28,
    paddingBottom: 32,
    gap: 10,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    gap: 7,
    marginBottom: 2,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 38,
    fontWeight: "700",
    lineHeight: 46,
    letterSpacing: -0.8,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.55)",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "400",
  },
});

export default OnboardingSlide;
