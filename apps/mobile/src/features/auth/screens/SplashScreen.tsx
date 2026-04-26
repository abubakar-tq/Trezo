import { NavigationProp, RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    FadeInDown,
    FadeInUp,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { IMAGES } from "@/assets";
import { AuthStackParamList, RootStackParamList } from "@/src/types/navigation";
import { AnimatedSplashBackground } from "@shared/components";

type SplashRedirectTarget = {
  name: string;
  params?: Record<string, unknown>;
};

type SplashRouteParams = {
  redirectTo?: SplashRedirectTarget;
};

type GenericSplashRoute = RouteProp<Record<string, SplashRouteParams | undefined>, string>;

const blurhash =
  "|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[";

const SplashScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList & RootStackParamList>>();
  const route = useRoute<GenericSplashRoute>();
  const rawRedirect = route.params?.redirectTo;

  const redirectTarget = useMemo<SplashRedirectTarget>(() => {
    if (rawRedirect) {
      return rawRedirect;
    }

    return { name: "Onboarding" };
  }, [rawRedirect]);

  const glowScale = useSharedValue(1);
  const lightRotation = useSharedValue(0);
  const lightScale = useSharedValue(1);

  useEffect(() => {
    glowScale.value = withRepeat(
      withTiming(1.15, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );

    lightRotation.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false,
    );

    lightScale.value = withRepeat(
      withTiming(1.3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [glowScale, lightRotation, lightScale]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: 0.4,
  }));

  const lightRotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${lightRotation.value}deg` }],
  }));

  const lightPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lightScale.value }],
    opacity: interpolate(lightScale.value, [1, 1.3], [0.6, 0.9]),
  }));

  useFocusEffect(
    useCallback(() => {
      console.log('📍 [SplashScreen] Focused, will redirect to:', redirectTarget);
      
      glowScale.value = 1;
      lightRotation.value = 0;
      lightScale.value = 1;

      const timeout = setTimeout(() => {
        console.log('🚀 [SplashScreen] Attempting navigation to:', redirectTarget.name);
        try {
          navigation.reset({
            index: 0,
            routes: [
              {
                name: redirectTarget.name as never,
                params: redirectTarget.params,
              },
            ],
          });
          console.log('✅ [SplashScreen] Navigation reset successful');
        } catch (error) {
          console.error('❌ [SplashScreen] Navigation error:', error);
        }
      }, 3500);

      return () => clearTimeout(timeout);
    }, [glowScale, lightRotation, lightScale, navigation, redirectTarget]),
  );

  return (
    <View style={styles.container}>
      <AnimatedSplashBackground />

      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" backgroundColor="transparent" translucent />

        <View style={styles.contentContainer}>
          <Animated.View entering={FadeInDown.duration(1000)} style={styles.logoSection}>
            <Animated.View style={[lightRotationStyle, { position: "absolute" }]}>
              <Animated.View
                style={[
                  lightPulseStyle,
                  {
                    position: "absolute",
                    top: -80,
                    left: -6,
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: "#A855F7", // Purple
                  },
                ]}
              />
              <Animated.View
                style={[
                  lightPulseStyle,
                  {
                    position: "absolute",
                    top: -56,
                    right: -56,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#9D50BB", // Original Purple
                  },
                ]}
              />
              <Animated.View
                style={[
                  lightPulseStyle,
                  {
                    position: "absolute",
                    bottom: -80,
                    right: -6,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: "#8B5CF6", // Violet
                  },
                ]}
              />
              <Animated.View
                style={[
                  lightPulseStyle,
                  {
                    position: "absolute",
                    bottom: -56,
                    left: -56,
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: "#7C3AED", // Indigo
                  },
                ]}
              />
            </Animated.View>

            <View style={styles.logoContainer}>
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    width: 100,
                    height: 100,
                    borderRadius: 50,
                    backgroundColor: "#A855F7",
                  },
                  glowStyle,
                ]}
              />
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    width: 115,
                    height: 115,
                    borderRadius: 57.5,
                    backgroundColor: "#9D50BB",
                    opacity: 0.15,
                  },
                  glowStyle,
                ]}
              />

              <View
                style={styles.logoInnerCircle}
              >
                <Image
                  source={IMAGES.app.splashLogo}
                  placeholder={blurhash}
                  contentFit="cover"
                  transition={800}
                  style={{
                    width: 88,
                    height: 88,
                    borderRadius: 44,
                  }}
                />
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600).duration(1000)} style={styles.titleSection}>
            <LinearGradient
              colors={["#ffffff", "#e5e7eb", "#d1d5db"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 8,
                paddingHorizontal: 24,
                paddingVertical: 6,
              }}
            >
              <Text style={styles.titleText}>TREZO</Text>
            </LinearGradient>

            <View style={styles.taglineContainer}>
              <View style={styles.taglineLineLeft} />
              <Text style={styles.taglineText}>SECURE DIGITAL FINANCE</Text>
              <View style={styles.taglineLineRight} />
            </View>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInUp.delay(1200).duration(800)} style={styles.footer}>
          <View style={styles.footerContent}>
            <View style={styles.footerLineLeft} />
            <Text style={styles.footerText}>TREZO TECHNOLOGIES</Text>
            <View style={styles.footerLineRight} />
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 64,
    marginTop: -60,
  },
  logoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInnerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  titleSection: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: 1,
    color: 'transparent',
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  taglineLineLeft: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(192, 132, 252, 0.5)',
    marginRight: 12,
  },
  taglineText: {
    color: '#d1d5db',
    fontSize: 14,
    fontWeight: '300',
    letterSpacing: 2,
  },
  taglineLineRight: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(192, 132, 252, 0.5)',
    marginLeft: 12,
  },
  footer: {
    paddingBottom: 32,
    alignItems: 'center',
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLineLeft: {
    width: 16,
    height: 1,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
  footerText: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '300',
    letterSpacing: 2,
    marginHorizontal: 12,
  },
  footerLineRight: {
    width: 16,
    height: 1,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
});

export default SplashScreen;
