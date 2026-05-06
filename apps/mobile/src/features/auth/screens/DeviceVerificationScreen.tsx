import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
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

import type { RootStackParamList } from "@/src/types/navigation";
import DevicePairingService from "@/src/features/wallet/services/DevicePairingService";
import { getSupabaseClient } from "@lib/supabase";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import { withAlpha } from "../../../utils/color";

const AnimatedView = Animated.createAnimatedComponent(View);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const DeviceVerificationScreen = () => {
  const { theme } = useAppTheme();
  const { colors, gradients, mode } = theme;
  const navigation = useNavigation<NavigationProp>();
  const logout = useUserStore((state) => state.logout);
  const setGuardNavigation = useAuthFlowStore((state) => state.setGuardNavigation);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [showReLoginModal, setShowReLoginModal] = useState(false);
  const [hasPendingPairing, setHasPendingPairing] = useState(false);

  const autoAttemptedRef = useRef(false);

  const pulse = useSharedValue(0);

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
    DevicePairingService.getPendingDeepLink()
      .then((link) => setHasPendingPairing(Boolean(link)))
      .catch(() => {});
  }, []);

  const handleContinuePairing = useCallback(() => {
    setGuardNavigation(false);
    navigation.reset({ index: 0, routes: [{ name: "PairDevice" }] });
  }, [navigation, setGuardNavigation]);

  const handleBiometricAuth = useCallback(async () => {
    try {
      setLastError(null);
      setIsAuthenticating(true);

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        setLastError("No biometric hardware found. Use PIN or Password.");
        setIsAuthenticating(false);
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        setLastError("No biometrics enrolled. Use PIN or Password.");
        setIsAuthenticating(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Verify your identity",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        setGuardNavigation(false);
        try {
          const pendingLink = await DevicePairingService.getPendingDeepLink();
          if (pendingLink) {
            navigation.reset({ index: 0, routes: [{ name: "PairDevice" }] });
            return;
          }
        } catch {
          // fall through to TabNavigation
        }
        navigation.reset({ index: 0, routes: [{ name: "TabNavigation" }] });
      } else {
        setLastError("Authentication failed. Try again.");
      }
    } catch {
      setLastError("An error occurred. Please try again.");
    } finally {
      setIsAuthenticating(false);
      autoAttemptedRef.current = true;
    }
  }, [navigation, setGuardNavigation]);

  // Auto-trigger biometrics on mount
  useEffect(() => {
    if (autoAttemptedRef.current) return;
    const timer = setTimeout(() => {
      handleBiometricAuth();
    }, 400);
    return () => clearTimeout(timer);
  }, [handleBiometricAuth]);

  const handleFallback = useCallback(() => {
    setLastError(null);
    handleBiometricAuth();
  }, [handleBiometricAuth]);

  const handleReLogin = useCallback(() => {
    setShowReLoginModal(true);
  }, []);

  const handleRecover = useCallback(() => {
    setGuardNavigation(false);
    navigation.reset({
      index: 0,
      routes: [{ name: "RecoveryEntry", params: { reason: "user_initiated" } }],
    });
  }, [navigation, setGuardNavigation]);

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

      navigation.reset({ index: 0, routes: [{ name: "AuthNavigation" }] });
    } catch {
      setIsLoggingOut(false);
    }
  }, [logout, navigation, setGuardNavigation]);

  const iconName =
    Platform.OS === "ios" ? "face-recognition" : "fingerprint";
  const biometricType = Platform.OS === "ios" ? "Face ID" : "Fingerprint";

  const badgeBackground = withAlpha(colors.surfaceElevated, mode === "dark" ? 0.78 : 0.92);
  const badgeBorder = withAlpha(colors.accent, mode === "dark" ? 0.5 : 0.32);
  const secondaryBorder = withAlpha(colors.border, mode === "dark" ? 0.45 : 0.32);
  const secondaryBackground = withAlpha(colors.surfaceMuted, mode === "dark" ? 0.55 : 0.82);

  return (
    <>
      <LinearGradient
        colors={gradients.hero}
        style={[styles.root, { backgroundColor: colors.background }]}
      >
        <View style={styles.content}>
          {/* Pending pairing banner */}
          {hasPendingPairing && (
            <TouchableOpacity
              onPress={handleContinuePairing}
              activeOpacity={0.85}
              style={[
                styles.pairingBanner,
                {
                  backgroundColor: withAlpha(colors.accent, 0.12),
                  borderColor: withAlpha(colors.accent, 0.4),
                },
              ]}
            >
              <Ionicons name="phone-portrait-outline" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pairingTitle, { color: colors.textPrimary }]}>
                  Continue Device Pairing
                </Text>
                <Text style={[styles.pairingSubtitle, { color: colors.textSecondary }]}>
                  Tap to add this device
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={colors.accent} />
            </TouchableOpacity>
          )}

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
            Verify Your Identity
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Use {biometricType} or your device credentials to continue
          </Text>

          {lastError ? (
            <Text style={[styles.errorText, { color: colors.danger }]}>
              {lastError}
            </Text>
          ) : null}

          {/* Auth actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.primaryButton, { backgroundColor: colors.accent }]}
              onPress={handleBiometricAuth}
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

          {/* Recovery link */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.recoverButton}
            onPress={handleRecover}
            disabled={isAuthenticating || isLoggingOut}
          >
            <Text style={[styles.recoverText, { color: colors.accent }]}>
              Don{"’"}t have a passkey on this device? Recover account
            </Text>
          </TouchableOpacity>

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

      {/* Re-login confirm modal */}
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
              <MaterialCommunityIcons name="logout" size={32} color={colors.warning} />
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 20,
  },
  pairingBanner: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    marginHorizontal: 0,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
  },
  pairingTitle: {
    fontWeight: "700",
    fontSize: 14,
  },
  pairingSubtitle: {
    fontSize: 12,
    marginTop: 1,
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
  recoverButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  recoverText: {
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
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
