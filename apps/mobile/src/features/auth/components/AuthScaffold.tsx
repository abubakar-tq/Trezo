import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { ReactElement, ReactNode, useEffect } from "react";
import {
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthBackground } from "@/assets/components";

type AuthScaffoldProps = {
  title: string;
  subtitle: string;
  icon: ReactElement<{ width?: number; height?: number }>;
  children: ReactNode;
  footer?: ReactNode;
  glowColor?: string;
  overlayOpacity?: number;
  cardGradient?: readonly [string, string] | readonly [string, string, string];
};

const ICON_SIZE = 64;
const CARD_RADIUS = 24;
const CARD_TOP_PADDING = ICON_SIZE / 2 + 16;

const AuthScaffold: React.FC<AuthScaffoldProps> = ({
  title,
  subtitle,
  icon,
  children,
  footer,
  glowColor = "#0088ff",
  overlayOpacity = 0.4,
  cardGradient = [
    "rgba(121, 85, 160, 0.18)",
    "rgba(0, 136, 255, 0.24)",
  ] as const,
}) => {
  const { width, height } = Dimensions.get("screen");
  const glowScale = useSharedValue(1);

  useEffect(() => {
    glowScale.value = withRepeat(
      withTiming(1.25, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [glowScale]);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: 0.32,
  }));

  const iconElement = React.cloneElement(icon, {
    width: icon.props.width ?? ICON_SIZE,
    height: icon.props.height ?? ICON_SIZE,
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="transparent" translucent />

      <AuthBackground
        width={width}
        height={height}
        preserveAspectRatio="none"
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
      />
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { backgroundColor: `rgba(0,0,0,${overlayOpacity})` },
        ]}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoider}
          behavior={Platform.select({ ios: "padding", default: "height" })}
          keyboardVerticalOffset={Platform.OS === "android" ? 24 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.innerContainer}>
              <View
                style={[
                  styles.card,
                  {
                    paddingTop: CARD_TOP_PADDING,
                    borderRadius: CARD_RADIUS,
                  },
                ]}
              >
                <LinearGradient
                  colors={cardGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  pointerEvents="none"
                  style={styles.cardGradient}
                />

                <View style={styles.iconContainer} pointerEvents="none">
                  <View style={styles.iconInner}>
                    <Animated.View
                      style={[styles.glowBase, { backgroundColor: glowColor }, glowStyle]}
                    />
                    {iconElement}
                  </View>
                </View>

                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>{subtitle}</Text>

                <View style={styles.content}>{children}</View>

                {footer ? <View style={styles.footer}>{footer}</View> : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  safeArea: {
    flex: 1,
  },
  keyboardAvoider: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 32,
  },
  innerContainer: {
    justifyContent: "center",
    paddingHorizontal: 24,
    width: "100%",
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#161319",
    padding: 24,
    position: "relative",
  },
  cardGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS,
  },
  iconContainer: {
    position: "absolute",
    top: -(ICON_SIZE / 2),
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  iconInner: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  glowBase: {
    position: "absolute",
    width: ICON_SIZE + 20,
    height: ICON_SIZE + 20,
    borderRadius: (ICON_SIZE + 20) / 2,
  },
  title: {
    marginTop: 6,
    marginBottom: 12,
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    color: "#b8b8b8",
    marginBottom: 20,
  },
  content: {
    rowGap: 14,
  },
  footer: {
    marginTop: 24,
  },
});

export type { AuthScaffoldProps };
export default AuthScaffold;
