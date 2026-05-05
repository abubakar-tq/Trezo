import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Animated as RNAnimated,
} from "react-native";
import {
    Canvas,
    Circle,
    RadialGradient,
    vec,
} from "@shopify/react-native-skia";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
  withSpring,
} from "react-native-reanimated";

import { AuthStackParamList } from "@/src/types/navigation";
import { AuthBackground } from "@/assets/components";
import MultiChainScene from "@shared/components/visuals/onboarding/MultiChainScene";
import PasskeyOrbScene from "@shared/components/visuals/onboarding/PasskeyOrbScene";
import ShieldScene from "@shared/components/visuals/onboarding/ShieldScene";
import { AuthGradientButton } from "@features/auth/components";
import { useUserStore } from "@store/useUserStore";
import { useAppLockStore } from "@store/useAppLockStore";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

const { width, height } = Dimensions.get("window");

const LOGO = require("@/assets/images/icon_nobackground.png");

const PAGES = [
  {
    id: "1",
    title: "Security, redefined.",
    Scene: PasskeyOrbScene,
    accent: "#8B5CF6",
    accentLight: "#C4B5FD",
    kicker: "TREZO SAFE",
  },
  {
    id: "2",
    title: "Trade with precision.",
    Scene: MultiChainScene,
    accent: "#06B6D4",
    accentLight: "#67E8F9",
    kicker: "TREZO CORE",
  },
  {
    id: "3",
    title: "Unified across chains.",
    Scene: ShieldScene,
    accent: "#10B981",
    accentLight: "#6EE7B7",
    kicker: "TREZO MESH",
  },
];

// ─── SKIA BACKGROUND COMPONENT ───────────────────────────────────────────────
const AnimatedBg: React.FC<{ accent: string; accentLight: string }> = ({ accent, accentLight }) => {
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Extremely subtle ambient glow */}
      <Circle cx={width / 2} cy={height / 2} r={height / 2}>
        <RadialGradient
          c={vec(width / 2, height / 2)}
          r={height / 2}
          colors={[
            "rgba(255,255,255,0.03)",
            "rgba(0,0,0,0)",
          ]}
        />
      </Circle>
    </Canvas>
  );
};

// ─── ORBITAL RING COMPONENT ───────────────────────────────────────────────────
const OrbitalRing: React.FC<{ size: number; duration: number; reverse?: boolean; dotColor: string; opacity?: number }> = ({
  size,
  duration,
  reverse = false,
  dotColor,
  opacity = 1,
}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(reverse ? -360 : 360, {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.07)",
          width: size,
          height: size,
          borderRadius: size / 2,
          opacity,
        },
        ringStyle,
      ]}
    >
      <View
        style={{
          position: "absolute",
          width: 6,
          height: 6,
          borderRadius: 3,
          top: -3,
          alignSelf: "center",
          backgroundColor: dotColor,
          shadowColor: dotColor,
          shadowOpacity: 0.8,
          shadowRadius: 6,
          elevation: 6,
        }}
      />
    </Animated.View>
  );
};

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const { isLoggedIn, profile } = useUserStore();
  const authenticate = useAppLockStore((state) => state.authenticate);
  const { theme } = useAppTheme();
  const { colors } = theme;

  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new RNAnimated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // Animation values for 3D feel
  const logoScale = useSharedValue(1);

  useEffect(() => {
    // Gentle pulse animation for the logo
    logoScale.value = withRepeat(
      withTiming(1.05, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
  }));

  const handleQuickLogin = async () => {
    const success = await authenticate();
    if (success) {
      // @ts-ignore
      navigation.getParent()?.reset({
        index: 0,
        routes: [{ name: "TabNavigation" }],
      });
    }
  };

  const handleOnboardingComplete = () => {
    navigation.navigate("Register");
  };

  const renderItem = ({ item, index }: { item: typeof PAGES[0]; index: number }) => {
    return (
      <View style={styles.page}>
        <View style={styles.illustrationWrapper}>
          <item.Scene width={width} height={width * 0.95} />
        </View>

        <View style={styles.textContainer}>
          <Animated.Text entering={FadeInDown.delay(600)} style={styles.kicker}>{item.kicker}</Animated.Text>
          <Animated.Text entering={FadeInDown.delay(700)} style={styles.title}>{item.title}</Animated.Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      
      {/* DEEP PURPLE TOPOGRAPHIC BACKGROUND */}
      <View style={styles.backgroundLayer}>
        <AuthBackground width={width} height={height} opacity={0.4} />
        <LinearGradient
          colors={["rgba(46, 16, 101, 0.3)", "rgba(10, 10, 20, 0.9)", "#04030a"]}
          style={StyleSheet.absoluteFill}
        />
        <AnimatedBg 
          accent={PAGES[currentIndex].accent} 
          accentLight={PAGES[currentIndex].accentLight} 
        />
      </View>

      <SafeAreaView style={styles.safeArea}>
        {/* MAJESTIC TOP BAR */}
        <Animated.View entering={FadeInDown.duration(800)} style={styles.topBar}>
          <Image source={LOGO} style={styles.miniLogo} contentFit="contain" />
          <Text style={styles.brandName}>TREZO</Text>
        </Animated.View>

        <FlatList
          ref={flatListRef}
          data={PAGES}
          renderItem={renderItem}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={RNAnimated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentIndex(index);
          }}
          scrollEventThrottle={16}
          keyExtractor={(item) => item.id}
        />

        <View style={styles.footerContainer}>
          {/* PROGRESS INDICATORS */}
          <View style={styles.indicatorContainer}>
            {PAGES.map((_, i) => {
              const opacity = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [0.2, 1, 0.2],
                extrapolate: "clamp",
              });
              const dotWidth = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [8, 24, 8],
                extrapolate: "clamp",
              });
              return (
                <RNAnimated.View
                  key={i}
                  style={[
                    styles.indicator,
                    { 
                      opacity, 
                      width: dotWidth,
                      backgroundColor: PAGES[currentIndex].accent 
                    },
                  ]}
                />
              );
            })}
          </View>

          {/* CTAs */}
          <View style={styles.actionSection}>
            {isLoggedIn ? (
              <TouchableOpacity 
                onPress={handleQuickLogin}
                activeOpacity={0.9}
                style={styles.glassQuickLogin}
              >
                <LinearGradient
                  colors={["rgba(139, 92, 246, 0.12)", "rgba(139, 92, 246, 0.03)"]}
                  start={{x:0, y:0}} end={{x:1, y:1}}
                  style={styles.quickLoginGradient}
                >
                  <View style={[styles.avatarGlow, { shadowColor: PAGES[currentIndex].accent }]}>
                    <Text style={[styles.avatarText, { color: PAGES[currentIndex].accent }]}>
                      {profile?.username?.charAt(0).toUpperCase() || "T"}
                    </Text>
                  </View>
                  <View style={styles.quickLoginInfo}>
                    <Text style={styles.welcomeText}>WELCOME BACK,</Text>
                    <Text style={styles.profileText}>{profile?.username || "User"}</Text>
                  </View>
                  <View style={[styles.unlockCircle, { backgroundColor: PAGES[currentIndex].accent }]}>
                    <Feather name="unlock" size={18} color="#000" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <View style={styles.authGroup}>
                <AuthGradientButton 
                  label={currentIndex === PAGES.length - 1 ? "CREATE WALLET" : "CONTINUE"}
                  onPress={currentIndex === PAGES.length - 1 ? handleOnboardingComplete : () => flatListRef.current?.scrollToIndex({ index: currentIndex + 1 })}
                  colors={[PAGES[currentIndex].accent, withAlpha(PAGES[currentIndex].accent, 0.7)]}
                />
                <TouchableOpacity 
                  onPress={() => navigation.navigate("Login")}
                  style={styles.signInLink}
                >
                  <Text style={styles.signInLabel}>
                    ALREADY HAVE A WALLET? <Text style={styles.signInHighlight}>SIGN IN</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    gap: 8,
  },
  miniLogo: {
    width: 32,
    height: 32,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 4,
  },
  page: {
    width,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  illustrationWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: "center",
    alignItems: "center",
    overflow: "visible",
  },
  textContainer: {
    paddingHorizontal: 40,
    alignItems: 'center',
    marginBottom: height * 0.12,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 6,
    marginBottom: 12,
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: "300",
    color: "#FFF",
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.3)",
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 30,
  },
  footerContainer: {
    paddingBottom: 40,
  },
  indicatorContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 32,
  },
  indicator: {
    height: 6,
    borderRadius: 3,
  },
  actionSection: {
    paddingHorizontal: 24,
  },
  authGroup: {
    gap: 24,
  },
  signInLink: {
    alignItems: "center",
  },
  signInLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    letterSpacing: 1,
  },
  signInHighlight: {
    color: "#FFF",
    fontWeight: "900",
  },
  glassQuickLogin: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  quickLoginGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 16,
  },
  avatarGlow: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 10,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "900",
  },
  quickLoginInfo: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "700",
    letterSpacing: 1,
  },
  profileText: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFF",
  },
  unlockCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default OnboardingScreen;
