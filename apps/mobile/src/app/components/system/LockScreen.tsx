import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
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
import PinKeypad from "@shared/components/PinKeypad";
import { useAppLockStore } from "../../../store/useAppLockStore";
import { APP_PIN_LENGTH, useAppPinStore } from "../../../store/useAppPinStore";
import { useAuthFlowStore } from "../../../store/useAuthFlowStore";
import { useUserStore } from "../../../store/useUserStore";
import { useAppTheme } from "@theme";

type UnlockMode = "biometric" | "pin-entry" | "pin-setup";

const AnimatedView = Animated.createAnimatedComponent(View);

const LockScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors, gradients, mode } = theme;

  const hasInitialized = useAppLockStore((state) => state.hasInitialized);
  const isLocked = useAppLockStore((state) => state.isLocked);
  const isAuthenticating = useAppLockStore((state) => state.isAuthenticating);
  const isBiometricAvailable = useAppLockStore((state) => state.isBiometricAvailable);
  const securityLevel = useAppLockStore((state) => state.securityLevel);
  const authenticate = useAppLockStore((state) => state.authenticate);
  const refreshSecurityLevel = useAppLockStore((state) => state.refreshSecurityLevel);
  const lastError = useAppLockStore((state) => state.lastError);
  const hasNoScreenLock = securityLevel === LocalAuthentication.SecurityLevel.NONE;
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const logout = useUserStore((state) => state.logout);
  const guardNavigation = useAuthFlowStore((state) => state.guardNavigation);
  const setGuardNavigation = useAuthFlowStore((state) => state.setGuardNavigation);

  const [showReLoginModal, setShowReLoginModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const hasPin = useAppPinStore((state) => state.hasPin);
  const hasPinInitialized = useAppPinStore((state) => state.hasInitialized);
  const verifyPin = useAppPinStore((state) => state.verifyPin);
  const setupPin = useAppPinStore((state) => state.setupPin);
  const unlock = useAppLockStore((state) => state.unlock);

  const [unlockMode, setUnlockMode] = useState<UnlockMode>("biometric");
  const [enteredPin, setEnteredPin] = useState("");
  const [setupStep, setSetupStep] = useState<"first" | "confirm">("first");
  const [setupFirstPin, setSetupFirstPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinBusy, setPinBusy] = useState(false);

  // Decide the default mode once everything is initialized. If the user has set up
  // a PIN, prefer it (most reliable cross-Android path). Otherwise, fall back to
  // the biometric flow. If neither is possible, force PIN setup.
  useEffect(() => {
    if (!hasInitialized || !hasPinInitialized || !isLocked) return;
    if (hasPin) {
      setUnlockMode("pin-entry");
    } else if (!isBiometricAvailable && !hasNoScreenLock) {
      setUnlockMode("pin-setup");
    } else {
      setUnlockMode("biometric");
    }
  }, [hasInitialized, hasNoScreenLock, hasPin, hasPinInitialized, isBiometricAvailable, isLocked]);

  // Reset PIN entry state any time we re-enter PIN mode or the screen unlocks.
  useEffect(() => {
    if (unlockMode !== "pin-entry" && unlockMode !== "pin-setup") {
      setEnteredPin("");
      setPinError(null);
      setSetupStep("first");
      setSetupFirstPin(null);
    }
  }, [unlockMode]);

  useEffect(() => {
    if (!isLocked) {
      setEnteredPin("");
      setPinError(null);
      setSetupStep("first");
      setSetupFirstPin(null);
    }
  }, [isLocked]);

  const autoAttemptedRef = useRef(false);
  const lastAuthAttemptRef = useRef<number>(0);
  const autoAttemptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTH_COOLDOWN_MS = 1000;

  const cancelPendingAutoAttempt = useCallback(() => {
    if (autoAttemptTimeoutRef.current !== null) {
      clearTimeout(autoAttemptTimeoutRef.current);
      autoAttemptTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => cancelPendingAutoAttempt(), [cancelPendingAutoAttempt]);

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
    if (!isLocked) { autoAttemptedRef.current = false; cancelPendingAutoAttempt(); return; }
    if (isAuthenticating || autoAttemptedRef.current) return;
    // Device has no biometric and no PIN/passcode — firing authenticateAsync
    // would resolve instantly with an error and visually blink the screen.
    if (hasNoScreenLock) return;
    // No biometric enrolled. Auto-firing authenticateAsync races with a user
    // tap and Expo silently cancels the second call — leave it to the user to
    // press the unlock button so the OS device-credential prompt is reliably
    // anchored to a user gesture.
    if (!isBiometricAvailable) return;
    // We're not in biometric mode (user is in PIN entry/setup) — don't pop the
    // native prompt over the keypad.
    if (unlockMode !== "biometric") return;

    const now = Date.now();
    if (now - lastAuthAttemptRef.current < AUTH_COOLDOWN_MS) return;

    autoAttemptedRef.current = true;
    lastAuthAttemptRef.current = now;
    autoAttemptTimeoutRef.current = setTimeout(() => {
      autoAttemptTimeoutRef.current = null;
      authenticate();
    }, 300);
  }, [authenticate, cancelPendingAutoAttempt, hasInitialized, hasNoScreenLock, isAuthenticating, isBiometricAvailable, isLocked, unlockMode]);

  const handleRetry = useCallback(() => {
    cancelPendingAutoAttempt();
    if (isAuthenticating) return;
    autoAttemptedRef.current = true;
    lastAuthAttemptRef.current = Date.now();
    authenticate();
  }, [authenticate, cancelPendingAutoAttempt, isAuthenticating]);

  const handleOpenDeviceSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // openSettings can throw on some Android OEMs — silently ignore
    }
  }, []);

  const handleRecheckSecurityLevel = useCallback(async () => {
    const level = await refreshSecurityLevel();
    if (level !== LocalAuthentication.SecurityLevel.NONE) {
      autoAttemptedRef.current = false;
      lastAuthAttemptRef.current = 0;
      authenticate();
    }
  }, [authenticate, refreshSecurityLevel]);

  const handleSwitchToPin = useCallback(() => {
    cancelPendingAutoAttempt();
    setPinError(null);
    setUnlockMode(hasPin ? "pin-entry" : "pin-setup");
  }, [cancelPendingAutoAttempt, hasPin]);

  const handleSwitchToBiometric = useCallback(() => {
    setPinError(null);
    setEnteredPin("");
    setUnlockMode("biometric");
  }, []);

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

    if (unlockMode === "pin-entry") {
      let cancelled = false;
      setPinBusy(true);
      void (async () => {
        try {
          const ok = await verifyPin(enteredPin);
          if (cancelled) return;
          if (ok) {
            unlock();
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

    if (unlockMode === "pin-setup") {
      if (setupStep === "first") {
        setSetupFirstPin(enteredPin);
        setEnteredPin("");
        setSetupStep("confirm");
        return;
      }
      // confirm step
      if (setupFirstPin && enteredPin === setupFirstPin) {
        let cancelled = false;
        setPinBusy(true);
        void (async () => {
          try {
            await setupPin(enteredPin);
            if (cancelled) return;
            unlock();
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
  }, [enteredPin, setupFirstPin, setupPin, setupStep, unlock, unlockMode, verifyPin]);

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

  const biometricType = Platform.OS === "ios" ? "Face ID" : "Fingerprint";
  const inPinMode = unlockMode === "pin-entry" || unlockMode === "pin-setup";
  const iconName = hasNoScreenLock
    ? "shield-alert-outline"
    : inPinMode
      ? "lock-outline"
      : isBiometricAvailable
        ? Platform.OS === "ios" ? "face-recognition" : "fingerprint"
        : "lock";
  const title = hasNoScreenLock
    ? "Set up a device screen lock"
    : unlockMode === "pin-setup"
      ? setupStep === "first" ? "Create your Trezo PIN" : "Confirm your Trezo PIN"
      : unlockMode === "pin-entry"
        ? "Enter your Trezo PIN"
        : "Unlock Trezo Wallet";
  const supportingText = hasNoScreenLock
    ? `Trezo needs a device PIN, pattern, password, or ${biometricType} to keep your wallet safe. Add one in ${Platform.OS === "ios" ? "iOS Settings" : "Android Settings"}, then return here.`
    : unlockMode === "pin-setup"
      ? setupStep === "first"
        ? `Pick a ${APP_PIN_LENGTH}-digit PIN. You'll use it to unlock Trezo when biometrics aren't available.`
        : "Enter the same PIN again to confirm."
      : unlockMode === "pin-entry"
        ? `Enter the ${APP_PIN_LENGTH}-digit PIN you set when first locking Trezo.`
        : isBiometricAvailable
          ? `Use ${biometricType} or your device credentials to unlock.`
          : "Use your device passcode to unlock Trezo.";

  const badgeBackground = mode === "dark" ? `${colors.surfaceElevated}C7` : `${colors.surfaceElevated}EB`;
  const badgeBorder = mode === "dark" ? `${colors.accent}80` : `${colors.accent}52`;
  const secondaryBorder = mode === "dark" ? `${colors.border}73` : `${colors.border}52`;
  const secondaryBackground = mode === "dark" ? `${colors.surfaceMuted}8C` : `${colors.surfaceMuted}D1`;

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
              {title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {supportingText}
            </Text>

            {lastError && !hasNoScreenLock && !inPinMode ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {lastError}
              </Text>
            ) : null}
            {inPinMode && pinError ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>
                {pinError}
              </Text>
            ) : null}

            {inPinMode ? (
              <>
                <PinKeypad
                  pin={enteredPin}
                  length={APP_PIN_LENGTH}
                  onDigit={handlePinDigit}
                  onBackspace={handlePinBackspace}
                  disabled={pinBusy}
                />
                {isBiometricAvailable && unlockMode === "pin-entry" ? (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.secondaryButton,
                      { borderColor: secondaryBorder, backgroundColor: secondaryBackground, marginTop: 12 },
                    ]}
                    onPress={handleSwitchToBiometric}
                    disabled={pinBusy}
                  >
                    <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>
                      Use {biometricType} instead
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            ) : null}

            {/* Primary + secondary auth buttons */}
            {!inPinMode && (
            <View style={styles.actions}>
              {hasNoScreenLock ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                    onPress={handleOpenDeviceSettings}
                  >
                    <Text style={[styles.primaryLabel, { color: colors.textOnAccent }]}>
                      Open device settings
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.secondaryButton,
                      { borderColor: secondaryBorder, backgroundColor: secondaryBackground },
                    ]}
                    onPress={handleRecheckSecurityLevel}
                    disabled={isAuthenticating}
                  >
                    <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>
                      I've set it up — try again
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
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
                        {isBiometricAvailable ? "Try again" : "Unlock with device credentials"}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={[
                      styles.secondaryButton,
                      { borderColor: secondaryBorder, backgroundColor: secondaryBackground },
                    ]}
                    onPress={handleSwitchToPin}
                    disabled={isAuthenticating}
                  >
                    <Text style={[styles.secondaryLabel, { color: colors.textPrimary }]}>
                      {hasPin ? "Unlock with PIN" : "Set up app PIN"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            )}

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
                { backgroundColor: `${colors.warning}26` },
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
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: colors.textOnAccent }]}>
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
