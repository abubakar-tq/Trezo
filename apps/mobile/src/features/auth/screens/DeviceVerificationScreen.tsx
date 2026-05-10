import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

const AnimatedView = Animated.createAnimatedComponent(View);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const DeviceVerificationScreen = () => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.5]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.55, 0]),
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

  const iconName = Platform.OS === "ios" ? "face-recognition" : "fingerprint";
  const biometricType = Platform.OS === "ios" ? "Face ID" : "Fingerprint";

  return (
    <>
      <LinearGradient colors={gradients.hero} style={styles.root}>

        {/* Pending pairing banner */}
        {hasPendingPairing && (
          <TouchableOpacity
            onPress={handleContinuePairing}
            activeOpacity={0.85}
            style={[styles.pairingBanner, { backgroundColor: `${colors.accent}1A`, borderColor: `${colors.accent}59` }]}
          >
            <View style={[styles.pairingIconWrap, { backgroundColor: `${colors.accent}22` }]}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.accent} />
            </View>
            <View style={styles.pairingTextBlock}>
              <Text style={[styles.pairingTitle, { color: colors.textPrimary }]}>Continue Device Pairing</Text>
              <Text style={[styles.pairingSubtitle, { color: colors.textSecondary }]}>Tap to add this device to your wallet</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.accent} />
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          {/* Animated biometric badge */}
          <View style={[styles.haloContainer, { shadowColor: colors.accent }]}>
            <AnimatedView
              style={[styles.halo, haloStyle, { backgroundColor: colors.accent }]}
            />
            <View style={[styles.iconBadge, { backgroundColor: `${colors.surfaceElevated}D9`, borderColor: `${colors.accent}66` }]}>
              <MaterialCommunityIcons name={iconName} size={44} color={colors.accent} />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>Verify Your Identity</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {`Use ${biometricType} or your device credentials to continue`}
          </Text>

          {/* Error state */}
          {lastError ? (
            <View style={[styles.errorPill, { backgroundColor: `${colors.danger}18`, borderColor: `${colors.danger}40` }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{lastError}</Text>
            </View>
          ) : null}

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
              onPress={handleBiometricAuth}
              disabled={isAuthenticating}
            >
              {isAuthenticating ? (
                <ActivityIndicator size="small" color={colors.textOnAccent} />
              ) : (
                <Text style={[styles.primaryBtnText, { color: colors.textOnAccent }]}>Try again</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              style={[styles.secondaryBtn, { backgroundColor: `${colors.surfaceMuted}CC`, borderColor: `${colors.border}80` }]}
              onPress={handleFallback}
              disabled={isAuthenticating}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Use PIN or Password</Text>
            </TouchableOpacity>
          </View>

          {/* Recovery link */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.linkBtn}
            onPress={handleRecover}
            disabled={isAuthenticating || isLoggingOut}
          >
            <Text style={[styles.linkText, { color: colors.accent }]}>
              No passkey on this device? Recover account
            </Text>
          </TouchableOpacity>

          {/* Re-login link */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.mutedLinkBtn}
            onPress={handleReLogin}
            disabled={isAuthenticating || isLoggingOut}
          >
            <Text style={[styles.mutedLinkText, { color: colors.textMuted }]}>
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
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <View style={[styles.modalIconBadge, { backgroundColor: colors.warningSoft }]}>
              <MaterialCommunityIcons name="logout" size={30} color={colors.warning} />
            </View>

            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Re-login Required</Text>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
              {"Your current session will be closed and all local data cleared. You'll need to log in again with your credentials."}
            </Text>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.glass, borderColor: colors.border, borderWidth: 1 }]}
                onPress={handleCancelReLogin}
                disabled={isLoggingOut}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.danger, opacity: isLoggingOut ? 0.7 : 1 }]}
                onPress={handleConfirmReLogin}
                disabled={isLoggingOut}
                activeOpacity={0.7}
              >
                {isLoggingOut ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.textOnAccent }]}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    pairingBanner: {
      position: "absolute",
      top: 56,
      left: 20,
      right: 20,
      zIndex: 10,
      borderRadius: 16,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
    },
    pairingIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    pairingTextBlock: {
      flex: 1,
    },
    pairingTitle: {
      fontSize: 14,
      fontWeight: "700",
    },
    pairingSubtitle: {
      fontSize: 12,
      marginTop: 2,
    },
    content: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 32,
      gap: 18,
    },
    haloContainer: {
      width: 140,
      height: 140,
      alignItems: "center",
      justifyContent: "center",
      shadowOpacity: 0.4,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 10 },
      elevation: 0,
    },
    halo: {
      position: "absolute",
      width: 140,
      height: 140,
      borderRadius: 70,
    },
    iconBadge: {
      width: 104,
      height: 104,
      borderRadius: 52,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    title: {
      fontSize: 27,
      fontWeight: "800",
      textAlign: "center",
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 21,
      opacity: 0.85,
    },
    errorPill: {
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    errorText: {
      fontSize: 13,
      fontWeight: "600",
      textAlign: "center",
    },
    actions: {
      width: "100%",
      gap: 10,
    },
    primaryBtn: {
      borderRadius: 17,
      paddingVertical: 15,
      alignItems: "center",
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: "700",
    },
    secondaryBtn: {
      borderRadius: 17,
      paddingVertical: 15,
      alignItems: "center",
      borderWidth: 1,
    },
    secondaryBtnText: {
      fontSize: 14,
      fontWeight: "600",
    },
    linkBtn: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      alignItems: "center",
      minHeight: 44,
      justifyContent: "center",
    },
    linkText: {
      fontSize: 13,
      fontWeight: "600",
      textDecorationLine: "underline",
      textAlign: "center",
    },
    mutedLinkBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignItems: "center",
    },
    mutedLinkText: {
      fontSize: 12,
      fontWeight: "500",
      textDecorationLine: "underline",
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      borderRadius: 28,
      padding: 26,
      width: "100%",
      maxWidth: 380,
      borderWidth: 1,
      alignItems: "center",
      gap: 12,
    },
    modalIconBadge: {
      width: 66,
      height: 66,
      borderRadius: 33,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    modalTitle: {
      fontSize: 21,
      fontWeight: "800",
      textAlign: "center",
      letterSpacing: -0.3,
    },
    modalBody: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 21,
      opacity: 0.85,
    },
    modalBtns: {
      flexDirection: "row",
      gap: 10,
      width: "100%",
      marginTop: 6,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBtnText: {
      fontSize: 15,
      fontWeight: "700",
    },
  });
