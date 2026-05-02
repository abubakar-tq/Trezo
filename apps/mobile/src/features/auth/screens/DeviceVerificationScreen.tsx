import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import type { RootStackParamList } from "@/src/types/navigation";
import DevicePairingService from "@/src/features/wallet/services/DevicePairingService";
import { getSupabaseClient } from "@lib/supabase";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const DeviceVerificationScreen = () => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<NavigationProp>();
  const logout = useUserStore((state) => state.logout);
  const setGuardNavigation = useAuthFlowStore((state) => state.setGuardNavigation);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [showReLoginModal, setShowReLoginModal] = useState(false);
  const [hasPendingPairing, setHasPendingPairing] = useState(false);

  // On mount: check for a pending pairing link — if so, show a bypass CTA
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
      setIsAuthenticating(true);

      // Check if device supports biometric authentication
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) {
        Alert.alert(
          "Not Supported",
          "Your device doesn't support biometric authentication. Please use re-login option.",
          [{ text: "OK" }]
        );
        setIsAuthenticating(false);
        return;
      }

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) {
        Alert.alert(
          "No Biometrics Found",
          "Please set up biometric authentication in your device settings or use re-login option.",
          [{ text: "OK" }]
        );
        setIsAuthenticating(false);
        return;
      }

      // Authenticate
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Verify your identity",
        fallbackLabel: "Use passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });

      if (result.success) {
        // Authentication successful — check if we have a pending device-pairing link
        setGuardNavigation(false);
        try {
          const pendingLink = await DevicePairingService.getPendingDeepLink();
          if (pendingLink) {
            navigation.reset({
              index: 0,
              routes: [{ name: "PairDevice" }],
            });
            return;
          }
        } catch {
          // ignore — fall through to TabNavigation
        }
        navigation.reset({
          index: 0,
          routes: [{ name: "TabNavigation" }],
        });
      } else {
        Alert.alert(
          "Authentication Failed",
          "Unable to verify your identity. Please try again.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error("Biometric auth error:", error);
      Alert.alert(
        "Error",
        "An error occurred during authentication. Please try again.",
        [{ text: "OK" }]
      );
    } finally {
      setIsAuthenticating(false);
    }
  }, [navigation, setGuardNavigation]);

  const handleReLogin = useCallback(() => {
    setShowReLoginModal(true);
  }, []);

  const handleCancelReLogin = useCallback(() => {
    setShowReLoginModal(false);
  }, []);

  const handleConfirmReLogin = useCallback(async () => {
    try {
      setIsAuthenticating(true);
      setShowReLoginModal(false);

      // Sign out from Supabase first
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();

      // Clear all local state and storage
      await logout();

      // Reset guard navigation
      setGuardNavigation(false);

      // Small delay to ensure storage is synced
      await new Promise(resolve => setTimeout(resolve, 100));

      // Navigate to auth flow with complete reset
      navigation.reset({
        index: 0,
        routes: [{ name: "AuthNavigation" }],
      });
    } catch (error) {
      console.error("Logout error:", error);
      setShowReLoginModal(false);
      setIsAuthenticating(false);
    }
  }, [logout, navigation, setGuardNavigation]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    header: {
      alignItems: "center",
      marginBottom: 48,
    },
    iconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.accent + "20",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      marginBottom: 12,
      textAlign: "center",
    },
    subtitle: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: "center",
      lineHeight: 24,
    },
    optionsContainer: {
      width: "100%",
      gap: 16,
    },
    optionButton: {
      backgroundColor: theme.colors.surfaceCard,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    primaryOption: {
      backgroundColor: theme.colors.accent + "15",
      borderColor: theme.colors.accent,
    },
    optionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    primaryIconContainer: {
      backgroundColor: theme.colors.accent + "20",
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginBottom: 4,
    },
    optionDescription: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
    },
    optionArrow: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.background,
      justifyContent: "center",
      alignItems: "center",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modalContainer: {
      backgroundColor: theme.colors.surfaceCard,
      borderRadius: 24,
      padding: 24,
      width: "100%",
      maxWidth: 400,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalIconContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.colors.warning + "20",
      justifyContent: "center",
      alignItems: "center",
      alignSelf: "center",
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.textPrimary,
      textAlign: "center",
      marginBottom: 12,
    },
    modalMessage: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      textAlign: "center",
      lineHeight: 24,
      marginBottom: 24,
    },
    modalButtons: {
      flexDirection: "row",
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    modalButtonCancel: {
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalButtonConfirm: {
      backgroundColor: theme.colors.danger,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.colors.textPrimary,
    },
    modalButtonTextConfirm: {
      color: "#ffffff",
    },
  });

  return (
    <View style={styles.container}>
      {/* Pending pairing banner — shown when a pairing link was detected on mount */}
      {hasPendingPairing && (
        <TouchableOpacity
          onPress={handleContinuePairing}
          activeOpacity={0.85}
          style={{
            width: '100%',
            marginBottom: 20,
            borderRadius: 16,
            padding: 16,
            backgroundColor: theme.colors.accent + '18',
            borderWidth: 1,
            borderColor: theme.colors.accent + '60',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Ionicons name="phone-portrait-outline" size={24} color={theme.colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: '700', fontSize: 15 }}>
              Continue Device Pairing
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 }}>
              You have a pending pairing request. Tap to add this device.
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={theme.colors.accent} />
        </TouchableOpacity>
      )}

      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={40} color={theme.colors.accent} />
        </View>
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>
          Choose how you&apos;d like to continue with your secure wallet
        </Text>
      </View>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[styles.optionButton, styles.primaryOption]}
          onPress={handleBiometricAuth}
          disabled={isAuthenticating}
          activeOpacity={0.7}
        >
          <View style={[styles.optionIconContainer, styles.primaryIconContainer]}>
            <Ionicons name="finger-print" size={28} color={theme.colors.accent} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Device Verification</Text>
            <Text style={styles.optionDescription}>
              Use biometric or device PIN to securely access your wallet
            </Text>
          </View>
          <View style={styles.optionArrow}>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.optionButton}
          onPress={handleReLogin}
          disabled={isAuthenticating}
          activeOpacity={0.7}
        >
          <View style={styles.optionIconContainer}>
            <Ionicons name="log-in-outline" size={28} color={theme.colors.textSecondary} />
          </View>
          <View style={styles.optionContent}>
            <Text style={styles.optionTitle}>Re-login</Text>
            <Text style={styles.optionDescription}>
              Sign out and log in again with your credentials
            </Text>
          </View>
          <View style={styles.optionArrow}>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Re-login Confirmation Modal */}
      <Modal
        visible={showReLoginModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelReLogin}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="warning" size={48} color={theme.colors.warning} />
            </View>

            <Text style={styles.modalTitle}>Re-login Required</Text>
            <Text style={styles.modalMessage}>
              Your current session will be closed and all app data will be cleared. You will need to log in again with your credentials.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleCancelReLogin}
                disabled={isAuthenticating}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleConfirmReLogin}
                disabled={isAuthenticating}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextConfirm]}>
                  {isAuthenticating ? "Logging out..." : "Continue"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
