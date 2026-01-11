import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

import { useAppLockStore } from "@store/useAppLockStore";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

const AnimatedView = Animated.createAnimatedComponent(View);

const LockScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors, gradients, mode } = theme;

  const hasInitialized = useAppLockStore((state) => state.hasInitialized);
  const isLocked = useAppLockStore((state) => state.isLocked);
  const isAuthenticating = useAppLockStore((state) => state.isAuthenticating);
  const isBiometricAvailable = useAppLockStore((state) => state.isBiometricAvailable);
  const authenticate = useAppLockStore((state) => state.authenticate);
  const lastError = useAppLockStore((state) => state.lastError);
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const guardNavigation = useAuthFlowStore((state) => state.guardNavigation);

  const autoAttemptedRef = useRef(false);
  const lastAuthAttemptRef = useRef<number>(0);
  const AUTH_COOLDOWN_MS = 1000; // 1 second cooldown between attempts

  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, {
        duration: 1800,
        easing: Easing.out(Easing.quad),
      }),
      -1,
      false,
    );
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(pulse.value, [0, 1], [1, 1.45]),
      },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.6, 0]),
  }));

  useEffect(() => {
    if (!hasInitialized) return;

    if (!isLocked) {
      autoAttemptedRef.current = false;
      return;
    }

    if (isAuthenticating || autoAttemptedRef.current) {
      return;
    }

    // Check cooldown to prevent rapid successive auth attempts
    const now = Date.now();
    if (now - lastAuthAttemptRef.current < AUTH_COOLDOWN_MS) {
      return;
    }

    autoAttemptedRef.current = true;
    lastAuthAttemptRef.current = now;
    
    // Add small delay to ensure app is fully ready
    setTimeout(() => {
      authenticate();
    }, 300);
  }, [authenticate, hasInitialized, isAuthenticating, isLocked]);

  const handleRetry = useCallback(() => {
    autoAttemptedRef.current = true;
    lastAuthAttemptRef.current = Date.now();
    authenticate();
  }, [authenticate]);

  const handleFallback = useCallback(() => {
    autoAttemptedRef.current = true;
    lastAuthAttemptRef.current = Date.now();
    authenticate({ disableDeviceFallback: false, fallbackLabel: "Use PIN or Password" });
  }, [authenticate]);

  // Don't show LockScreen if:
  // 1. Not initialized yet
  // 2. User is not logged in
  // 3. User is logged in but guardNavigation is true (Device Verification screen will handle auth)
  if (!hasInitialized || !isLoggedIn || guardNavigation) {
    return null;
  }

  const iconName = isBiometricAvailable ? (Platform.OS === 'ios' ? "face-recognition" : "fingerprint") : "lock";
  const biometricType = Platform.OS === 'ios' ? 'Face ID' : 'Fingerprint';
  const supportingText = isBiometricAvailable
    ? `Use ${biometricType} or your device credentials to unlock.`
    : "Use your device passcode to unlock Trezo.";

  const badgeBackground = withAlpha(colors.surfaceElevated, mode === "dark" ? 0.78 : 0.92);
  const badgeBorder = withAlpha(colors.accent, mode === "dark" ? 0.5 : 0.32);
  const secondaryBorder = withAlpha(colors.border, mode === "dark" ? 0.45 : 0.32);
  const secondaryBackground = withAlpha(colors.surfaceMuted, mode === "dark" ? 0.55 : 0.82);

  return (
    <Modal visible={isLocked} animationType="fade" statusBarTranslucent>
      <LinearGradient
        colors={gradients.hero}
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <View style={styles.centerContent}>
          <View style={[styles.haloContainer, { shadowColor: colors.accent }]}>
            <AnimatedView style={[styles.halo, haloStyle, { backgroundColor: colors.accent }]} />
            <View
              style={[styles.iconBadge, { backgroundColor: badgeBackground, borderColor: badgeBorder }]}
            >
              <MaterialCommunityIcons name={iconName} size={42} color={colors.accent} />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>Unlock Trezo Wallet</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{supportingText}</Text>

          {lastError ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>{lastError}</Text>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={handleRetry}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <ActivityIndicator size="small" color={colors.textOnAccent} />
              ) : (
                <Text style={[styles.primaryLabel, { color: colors.textOnAccent }]}>Try again</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.secondaryButton, { borderColor: secondaryBorder, backgroundColor: secondaryBackground }]}
              onPress={handleFallback}
              disabled={isAuthenticating}
            >
              <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>Use PIN or Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
};

export default LockScreen;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 24,
  },
  haloContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  halo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  iconBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    opacity: 0.85,
  },
  errorText: {
    fontSize: 12,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    gap: 12,
  },
  primaryButton: {
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
});
