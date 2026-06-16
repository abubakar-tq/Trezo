// Splash motion: wordmark sheen (single pass, 1100ms). Per docs/plans/App-improvements-brief.md §1.1.
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { AuthBackground } from "@/assets/components";

const { width, height } = Dimensions.get("window");

const SplashScreen: React.FC = () => {
  const sheen = useSharedValue(-1);

  useEffect(() => {
    sheen.value = withTiming(1, {
      duration: 1100,
      easing: Easing.out(Easing.cubic),
    });
  }, [sheen]);

  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheen.value * 80 }],
    opacity: 0.5 - Math.abs(sheen.value) * 0.5,
  }));

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="transparent" translucent />

      {/* Same background stack as OnboardingScreen */}
      <View style={StyleSheet.absoluteFill}>
        <AuthBackground width={width} height={height} opacity={0.4} />
        <LinearGradient
          colors={["rgba(46, 16, 101, 0.3)", "rgba(10, 10, 20, 0.9)", "#04030a"]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.center}>
        <View style={styles.wordmarkWrap}>
          <Text style={styles.wordmark}>
            TREZO
          </Text>
          <Animated.View style={[styles.sheen, sheenStyle]} />
        </View>
        <Text style={styles.tagline}>
          SECURE DIGITAL FINANCE
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#04030a",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmarkWrap: {
    overflow: "hidden",
  },
  wordmark: {
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 6,
    color: "#ffffff",
  },
  sheen: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: -40,
    right: -40,
    backgroundColor: "rgba(255,255,255,0.18)",
    transform: [{ skewX: "-20deg" }],
  },
  tagline: {
    marginTop: 12,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 6,
    color: "rgba(255,255,255,0.5)",
  },
});

export default SplashScreen;
