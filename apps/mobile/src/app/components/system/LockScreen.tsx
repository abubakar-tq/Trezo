import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import type { RootStackParamList } from "@/src/types/navigation";
import { getSupabaseClient } from "@lib/supabase";
import { useAppLockStore } from "../../../store/useAppLockStore";
import { useAuthFlowStore } from "../../../store/useAuthFlowStore";
import { useUserStore } from "../../../store/useUserStore";
import { useAppTheme } from "@theme";
import { withAlpha } from "../../../utils/color";

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
  const logout = useUserStore((state) => state.logout);
  const guardNavigation = useAuthFlowStore((state) => state.guardNavigation);
  const setGuardNavigation = useAuthFlowStore((state) => state.setGuardNavigation);

  const [showReLoginModal, setShowReLoginModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const autoAttemptedRef = useRef(false);
  const lastAuthAttemptRef = useRef<number>(0);
  const AUTH_COOLDOWN_MS = 1000;

  const pulse = useSharedValue(0);
  let navigation: NativeStackNavigationProp<RootStackParamList> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  } catch {
    // rendered outside navigator context — navigation.reset not available
  }

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [pulse]);

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.45]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.6, 0]),
  }));

  useEffect(() => {
    if (!hasInitialized) return;
    if (!isLocked) { autoAttemptedRef.current = false; return; }
    if (isAuthenticating || autoAttemptedRef.current) return;

    const now = Date.now();
    if (now - lastAuthAttemptRef.current < AUTH_COOLDOWN_MS) return;

    autoAttemptedRef.current = true;
    lastAuthAttemptRef.current = now;
    setTimeout(() => { authenticate(); }, 300);
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

  const handleReLogin = useCallback(() => {
    setShowReLoginModal(true);
  }, []);

  const handleCancelReLogin = useCallback(() => {
    setShowReLoginModal(false);
  }, []);

  const handleConfirmReLogin = useCallback(async () => {
    try {
      setIsLoggingOut(true);
      setShowReLoginModal(false);

      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      await logout();
      setGuardNavigation(false);

      await new Promise((resolve) => setTimeout(resolve, 100));

      navigation?.reset({ index: 0, routes: [{ name: "AuthNavigation" }] });
    } catch {
      setIsLoggingOut(false);
    }
  }, [logout, navigation, setGuardNavigation]);

  if (!hasInitialized || !isLoggedIn || guardNavigation) return null;

  const iconName = isBiometricAvailable
    ? Platform.OS === "ios" ? "face-recognition" : "fingerprint"
    : "lock";
  const biometricType = Platform.OS === "ios" ? "Face ID" : "Fingerprint";
  const supportingText = isBiometricAvailable
    ? `Use ${biometricType} or your device credentials to unlock.`
    : "Use your device passcode to unlock Trezo.";

  const badgeBackground = withAlpha(colors.surfaceElevated, mode === "dark" ? 0.78 : 0.92);
  const badgeBorder = withAlpha(colors.accent, mode === "dark" ? 0.5 : 0.32);
  const secondaryBorder = withAlpha(colors.border, mode === "dark" ? 0.45 : 0.32);
  const secondaryBackground = withAlpha(colors.surfaceMuted, mode === "dark" ? 0.55 : 0.82);

  return (
    <>
      <Modal visible={isLocked} animationType="fade" statusBarTranslucent>
        <LinearGradient
          colors={gradients.hero}
          style={[styles.root, { backgroundColor: colors.background }]}
        >
          <View style={styles.centerContent}>
            {/* Animated biometric icon */}
            <View style={[styles.haloContainer, { shadowColor: colors.accent }]}>
              <AnimatedView
                style={[styles.halo, haloStyle, { backgroundColor: colors.accent }]}
              />
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: badgeBackground, borderColor: badgeBorder },
                ]}
              >
                <MaterialCommunityIcons
                  name={iconName}
                  size={42}
                  color={colors.accent}
                />
              </View>
            </View>

            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Unlock Trezo Wallet
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {supportingText}
            </Text>

            {lastError ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {lastError}
              </Text>
            ) : null}

            {/* Primary + secondary auth buttons */}
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
                  <Text style={[styles.primaryLabel, { color: colors.textOnAccent }]}>
                    Try again
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.secondaryButton,
                  { borderColor: secondaryBorder, backgroundColor: secondaryBackground },
                ]}
                onPress={handleFallback}
                disabled={isAuthenticating}
              >
                <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>
                  Use PIN or Password
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tertiary re-login link */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.reLoginButton}
              onPress={handleReLogin}
              disabled={isAuthenticating || isLoggingOut}
            >
              <Text style={[styles.reLoginText, { color: colors.textMuted }]}>
                Re-login to a different account
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Modal>

      {/* Re-login confirmation — rendered outside the main Modal to avoid nesting */}
      <Modal
        visible={showReLoginModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelReLogin}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContainer,
              {
                backgroundColor: colors.surfaceCard,
                borderColor: colors.border,
              },
            ]}
          >
            <View
              style={[
                styles.modalIcon,
                { backgroundColor: withAlpha(colors.warning, 0.15) },
              ]}
            >
              <MaterialCommunityIcons
                name="logout"
                size={32}
                color={colors.warning}
              />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Re-login Required
            </Text>
            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              Your current session will be closed and all local data cleared. You'll
              need to log in again with your credentials.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: colors.border,
                    borderWidth: 1,
                  },
                ]}
                onPress={handleCancelReLogin}
                disabled={isLoggingOut}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: colors.textPrimary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.danger }]}
                onPress={handleConfirmReLogin}
                disabled={isLoggingOut}
                activeOpacity={0.7}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: "#fff" }]}>
                    Continue
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
    gap: 20,
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
    gap: 10,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  reLoginButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  reLoginText: {
    fontSize: 12,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  // Confirm modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalContainer: {
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 380,
    borderWidth: 1,
    alignItems: "center",
    gap: 12,
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
