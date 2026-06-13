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
import PinKeypad from "@shared/components/PinKeypad";
import { useAppLockStore } from "@store/useAppLockStore";
import { APP_PIN_LENGTH, useAppPinStore } from "@store/useAppPinStore";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";

const AnimatedView = Animated.createAnimatedComponent(View);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type VerifyMode = "biometric" | "pin-entry" | "pin-setup";

export const DeviceVerificationScreen = () => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;
  const styles = useMemo(() => createStyles(), []);
  const navigation = useNavigation<NavigationProp>();
  const logout = useUserStore((state) => state.logout);
  const setGuardNavigation = useAuthFlowStore((state) => state.setGuardNavigation);

  // Source of truth for biometric availability lives in the lock store so the
  // post-login guard and the in-app lock screen never disagree.
  const isBiometricAvailable = useAppLockStore((state) => state.isBiometricAvailable);
  const hasLockInitialized = useAppLockStore((state) => state.hasInitialized);
  const initializeLock = useAppLockStore((state) => state.initialize);
  const refreshSecurityLevel = useAppLockStore((state) => state.refreshSecurityLevel);
  const securityLevel = useAppLockStore((state) => state.securityLevel);

  const hasPin = useAppPinStore((state) => state.hasPin);
  const hasPinInitialized = useAppPinStore((state) => state.hasInitialized);
  const initializePin = useAppPinStore((state) => state.initialize);
  const verifyPin = useAppPinStore((state) => state.verifyPin);
  const setupPin = useAppPinStore((state) => state.setupPin);

  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [showReLoginModal, setShowReLoginModal] = useState(false);
  const [hasPendingPairing, setHasPendingPairing] = useState(false);

  const [verifyMode, setVerifyMode] = useState<VerifyMode>("biometric");
  const [enteredPin, setEnteredPin] = useState("");
  const [setupStep, setSetupStep] = useState<"first" | "confirm">("first");
  const [setupFirstPin, setSetupFirstPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  const autoAttemptedRef = useRef(false);
  const hasNoScreenLock = securityLevel === LocalAuthentication.SecurityLevel.NONE;

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
    initializeLock();
    void initializePin();
  }, [initializeLock, initializePin]);

  useEffect(() => {
    DevicePairingService.getPendingDeepLink()
      .then((link) => setHasPendingPairing(Boolean(link)))
      .catch(() => {});
  }, []);

  // Mode-decision matrix (mirrors LockScreen — see policy comment there):
  //   hasPin  bio          → biometric
  //   hasPin  !bio         → pin-entry
  //   !hasPin device-has-lock → biometric (native prompt handles device cred)
  //   no security          → pin-setup
  useEffect(() => {
    if (!hasLockInitialized || !hasPinInitialized) return;
    if (hasPin) {
      setVerifyMode(isBiometricAvailable ? "biometric" : "pin-entry");
    } else if (!hasNoScreenLock) {
      setVerifyMode("biometric");
    } else {
      setVerifyMode("pin-setup");
    }
  }, [hasLockInitialized, hasNoScreenLock, hasPin, hasPinInitialized, isBiometricAvailable]);

  // Reset PIN scratch state whenever we leave a PIN mode.
  useEffect(() => {
    if (verifyMode !== "pin-entry" && verifyMode !== "pin-setup") {
      setEnteredPin("");
      setPinError(null);
      setSetupStep("first");
      setSetupFirstPin(null);
    }
  }, [verifyMode]);

  const proceedAfterAuth = useCallback(async () => {
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
  }, [navigation, setGuardNavigation]);

  const handleBiometricAuth = useCallback(async () => {
    if (hasNoScreenLock) {
      setLastError("Set up a screen lock on your device, or use the app PIN.");
      return;
    }
    try {
      setLastError(null);
      setIsAuthenticating(true);

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Verify your identity",
        fallbackLabel: "Use device PIN",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        await proceedAfterAuth();
      } else {
        setLastError("Authentication cancelled. Try again or use your app PIN.");
      }
    } catch {
      setLastError("An error occurred. Please try again.");
    } finally {
      setIsAuthenticating(false);
      autoAttemptedRef.current = true;
    }
  }, [hasNoScreenLock, proceedAfterAuth]);

  // Auto-fire only when biometric is actually enrolled. On a device that
  // only has a screen-lock PIN, we wait for an explicit user tap so the
  // native prompt is anchored to a gesture (avoids the empty-prompt flicker
  // on some Android OEMs).
  useEffect(() => {
    if (verifyMode !== "biometric") return;
    if (autoAttemptedRef.current) return;
    if (!isBiometricAvailable) return;
    const timer = setTimeout(() => {
      handleBiometricAuth();
    }, 400);
    return () => clearTimeout(timer);
  }, [handleBiometricAuth, isBiometricAvailable, verifyMode]);

  const handleSwitchToPin = useCallback(() => {
    setLastError(null);
    setVerifyMode(hasPin ? "pin-entry" : "pin-setup");
  }, [hasPin]);

  const handleSwitchToBiometric = useCallback(() => {
    if (!isBiometricAvailable) return;
    setPinError(null);
    setEnteredPin("");
    autoAttemptedRef.current = false;
    setVerifyMode("biometric");
  }, [isBiometricAvailable]);

  const handleStartOverSetup = useCallback(() => {
    setPinError(null);
    setEnteredPin("");
    setSetupStep("first");
    setSetupFirstPin(null);
  }, []);

  const handleRecheckSecurityLevel = useCallback(async () => {
    await refreshSecurityLevel();
  }, [refreshSecurityLevel]);

  const handleContinuePairing = useCallback(() => {
    setGuardNavigation(false);
    navigation.reset({ index: 0, routes: [{ name: "PairDevice" }] });
  }, [navigation, setGuardNavigation]);

  const handlePinDigit = useCallback(
    (digit: string) => {
      if (pinBusy) return;
      setPinError(null);
      setEnteredPin((prev) => {
        if (prev.length >= APP_PIN_LENGTH) return prev;
        return prev + digit;
      });
    },
    [pinBusy],
  );

  const handlePinBackspace = useCallback(() => {
    if (pinBusy) return;
    setPinError(null);
    setEnteredPin((prev) => prev.slice(0, -1));
  }, [pinBusy]);

  // Auto-submit when the user reaches APP_PIN_LENGTH digits.
  useEffect(() => {
    if (enteredPin.length !== APP_PIN_LENGTH) return;

    if (verifyMode === "pin-entry") {
      let cancelled = false;
      setPinBusy(true);
      void (async () => {
        try {
          const ok = await verifyPin(enteredPin);
          if (cancelled) return;
          if (ok) {
            await proceedAfterAuth();
          } else {
            setPinError("Incorrect PIN. Try again.");
            setEnteredPin("");
          }
        } catch (err) {
          if (cancelled) return;
          setPinError(err instanceof Error ? err.message : "Could not verify PIN");
          setEnteredPin("");
        } finally {
          if (!cancelled) setPinBusy(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    if (verifyMode === "pin-setup") {
      if (setupStep === "first") {
        setSetupFirstPin(enteredPin);
        setEnteredPin("");
        setSetupStep("confirm");
        return;
      }
      if (setupFirstPin && enteredPin === setupFirstPin) {
        let cancelled = false;
        setPinBusy(true);
        void (async () => {
          try {
            await setupPin(enteredPin);
            if (cancelled) return;
            await proceedAfterAuth();
          } catch (err) {
            if (cancelled) return;
            setPinError(err instanceof Error ? err.message : "Could not save PIN");
            setEnteredPin("");
            setSetupStep("first");
            setSetupFirstPin(null);
          } finally {
            if (!cancelled) setPinBusy(false);
          }
        })();
        return () => {
          cancelled = true;
        };
      }
      setPinError("PINs didn't match. Start over.");
      setEnteredPin("");
      setSetupStep("first");
      setSetupFirstPin(null);
    }
  }, [enteredPin, proceedAfterAuth, setupFirstPin, setupPin, setupStep, verifyMode, verifyPin]);

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

  const biometricType = Platform.OS === "ios" ? "Face ID" : "Fingerprint";
  const inPinMode = verifyMode === "pin-entry" || verifyMode === "pin-setup";

  const iconName: keyof typeof MaterialCommunityIcons.glyphMap =
    verifyMode === "pin-setup"
      ? "shield-key-outline"
      : verifyMode === "pin-entry"
        ? "lock-outline"
        : Platform.OS === "ios"
          ? "face-recognition"
          : "fingerprint";

  const title =
    verifyMode === "pin-setup"
      ? setupStep === "first"
        ? "Create your Trezo PIN"
        : "Confirm your Trezo PIN"
      : verifyMode === "pin-entry"
        ? "Enter your Trezo PIN"
        : "Verify Your Identity";

  const subtitle =
    verifyMode === "pin-setup"
      ? setupStep === "first"
        ? `Pick a ${APP_PIN_LENGTH}-digit PIN. You'll use it whenever Trezo locks.`
        : "Enter the same PIN again to confirm it."
      : verifyMode === "pin-entry"
        ? `Enter your ${APP_PIN_LENGTH}-digit Trezo PIN to continue.`
        : isBiometricAvailable
          ? `Use ${biometricType} to continue.`
          : "Verify with your device PIN, pattern or password.";

  const showNoDeviceLockBanner = hasNoScreenLock && verifyMode === "pin-setup";

  return (
    <>
      <LinearGradient colors={gradients.hero} style={styles.root}>

        {/* Pending pairing banner */}
        {hasPendingPairing && (
          <TouchableOpacity
            onPress={handleContinuePairing}
            activeOpacity={0.85}
            style={[styles.pairingBanner, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}
          >
            <View style={[styles.pairingIconWrap, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="phone-portrait-outline" size={18} color={colors.textSecondary} />
            </View>
            <View style={styles.pairingTextBlock}>
              <Text style={[styles.pairingTitle, { color: colors.textPrimary }]}>Continue Device Pairing</Text>
              <Text style={[styles.pairingSubtitle, { color: colors.textSecondary }]}>Tap to add this device to your wallet</Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}

        <View style={styles.content}>
          {/* Animated icon badge */}
          <View style={[styles.haloContainer, { shadowColor: colors.accent }]}>
            <AnimatedView
              style={[styles.halo, haloStyle, { backgroundColor: colors.accent }]}
            />
            <View style={[styles.iconBadge, { backgroundColor: colors.surfaceElevated, borderColor: colors.glassBorder }]}>
              <MaterialCommunityIcons name={iconName} size={44} color={colors.accent} />
            </View>
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>

          {/* Setup progress dots */}
          {verifyMode === "pin-setup" ? (
            <View style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: setupStep === "first" ? colors.accent : colors.accentSoft },
                ]}
              />
              <View
                style={[
                  styles.stepDot,
                  { backgroundColor: setupStep === "confirm" ? colors.accent : colors.borderMuted },
                ]}
              />
            </View>
          ) : null}

          {/* Error state */}
          {!inPinMode && lastError ? (
            <View style={[styles.errorPill, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{lastError}</Text>
            </View>
          ) : null}
          {inPinMode && pinError ? (
            <View style={[styles.errorPill, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{pinError}</Text>
            </View>
          ) : null}

          {/* Action region */}
          {inPinMode ? (
            <>
              <PinKeypad
                pin={enteredPin}
                length={APP_PIN_LENGTH}
                onDigit={handlePinDigit}
                onBackspace={handlePinBackspace}
                disabled={pinBusy}
              />

              {isBiometricAvailable && verifyMode === "pin-entry" ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.secondaryBtn,
                    { backgroundColor: colors.surfaceMuted, borderColor: colors.border, marginTop: 12 },
                  ]}
                  onPress={handleSwitchToBiometric}
                  disabled={pinBusy}
                >
                  <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                    Use {biometricType} instead
                  </Text>
                </TouchableOpacity>
              ) : null}

              {verifyMode === "pin-setup" && setupStep === "confirm" ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={styles.startOverBtn}
                  onPress={handleStartOverSetup}
                  disabled={pinBusy}
                >
                  <MaterialCommunityIcons
                    name="arrow-u-left-top"
                    size={16}
                    color={colors.accent}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.startOverLabel, { color: colors.accent }]}>
                    Start over and re-enter first PIN
                  </Text>
                </TouchableOpacity>
              ) : null}

              {showNoDeviceLockBanner ? (
                <View
                  style={[
                    styles.advisoryBanner,
                    { backgroundColor: colors.warningSoft, borderColor: colors.warning },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="shield-alert-outline"
                    size={18}
                    color={colors.warning}
                    style={{ marginRight: 8 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.advisoryTitle, { color: colors.textPrimary }]}>
                      Add a device screen lock too
                    </Text>
                    <Text style={[styles.advisoryBody, { color: colors.textSecondary }]}>
                      Your phone has no screen lock. Add one in {Platform.OS === "ios" ? "iOS Settings" : "Android Settings"} to keep Trezo safer.
                    </Text>
                    <TouchableOpacity onPress={handleRecheckSecurityLevel} activeOpacity={0.7} style={{ marginTop: 6 }}>
                      <Text style={[styles.advisoryLink, { color: colors.accent }]}>
                        I&apos;ve set one — recheck
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </>
          ) : (
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
                  <Text style={[styles.primaryBtnText, { color: colors.textOnAccent }]}>
                    {isBiometricAvailable ? `Use ${biometricType}` : "Verify with device PIN"}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.secondaryBtn, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                onPress={handleSwitchToPin}
                disabled={isAuthenticating}
              >
                <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
                  {hasPin ? "Unlock with app PIN" : "Use app PIN instead"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recovery link */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.linkBtn}
            onPress={handleRecover}
            disabled={isAuthenticating || isLoggingOut}
          >
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>
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
              {"This clears all local data and signs you out — you'll need to log in again."}
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

const createStyles = () =>
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
      fontWeight: "600",
      textAlign: "center",
      letterSpacing: -0.3,
    },
    subtitle: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 21,
      opacity: 0.85,
    },
    stepRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: -8,
    },
    stepDot: {
      width: 28,
      height: 4,
      borderRadius: 2,
    },
    errorPill: {
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 8,
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
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
    },
    primaryBtnText: {
      fontSize: 15,
      fontWeight: "700",
    },
    secondaryBtn: {
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      borderWidth: 1,
    },
    secondaryBtnText: {
      fontSize: 14,
      fontWeight: "600",
    },
    advisoryBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      width: "100%",
      borderRadius: 14,
      borderWidth: 1,
      padding: 12,
      marginTop: 4,
    },
    advisoryTitle: {
      fontSize: 13,
      fontWeight: "700",
      marginBottom: 2,
    },
    advisoryBody: {
      fontSize: 12,
      lineHeight: 17,
    },
    advisoryLink: {
      fontSize: 12,
      fontWeight: "700",
    },
    startOverBtn: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginTop: 10,
    },
    startOverLabel: {
      fontSize: 13,
      fontWeight: "700",
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
      borderRadius: 24,
      padding: 24,
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
      fontWeight: "600",
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
