import { NavigationProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import DevicePairingService from "@features/wallet/services/DevicePairingService";
import { AuthGradientButton, AuthScaffold } from "@features/auth/components";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

const CAMERA_FRAME_SIZE = 240;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    instruction: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      marginBottom: 4,
    },
    errorBanner: {
      backgroundColor: colors.dangerSoft,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
      textAlign: "center",
    },
    cameraCard: {
      width: "100%",
      height: CAMERA_FRAME_SIZE,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.glassBorder,
      backgroundColor: colors.surfaceCard,
      alignSelf: "center",
    },
    camera: {
      flex: 1,
    },
    cameraPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    cameraPlaceholderText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: "center",
      paddingHorizontal: 24,
    },
    cancelRow: {
      alignItems: "center",
      paddingVertical: 4,
    },
    cancelText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    expanderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderMuted,
    },
    expanderLabel: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    expanderChevron: {
      color: colors.textMuted,
      fontSize: 11,
    },
    pasteSection: {
      gap: 12,
    },
    pasteInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: 1,
      borderColor: colors.inputBorder,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 13,
    },
  });

export function LinkDeviceScreen() {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pasteExpanded, setPasteExpanded] = useState(false);
  const [pasteLink, setPasteLink] = useState("");
  const [isPasting, setIsPasting] = useState(false);

  // Lock scanner after first successful scan so the same frame doesn't fire twice.
  // Reset whenever the screen regains focus so users can rescan after backing out.
  const scannerLocked = useRef(false);

  useFocusEffect(
    useCallback(() => {
      scannerLocked.current = false;
      return () => {
        scannerLocked.current = false;
      };
    }, []),
  );

  // Request camera permission as soon as we know the current state. The expo
  // hook returns `null` on first render, so an empty-deps effect never sees a
  // real value — keep `cameraPermission` in deps so we re-run once it lands.
  // A ref guards us from re-prompting if the user has already responded.
  const cameraPromptAttempted = useRef(false);

  useEffect(() => {
    if (!cameraPermission) return;
    if (cameraPermission.granted) {
      setErrorMessage((prev) =>
        prev && prev.toLowerCase().includes("camera") ? null : prev,
      );
      return;
    }
    if (!cameraPermission.canAskAgain) {
      // Permanently denied via OS settings — surface the paste fallback.
      setPasteExpanded(true);
      setErrorMessage("Camera access denied. Open device settings to allow it, or paste the pairing link below.");
      return;
    }
    if (cameraPromptAttempted.current) return;
    cameraPromptAttempted.current = true;
    requestCameraPermission().then((result) => {
      if (!result.granted) {
        setPasteExpanded(true);
        setErrorMessage("Camera access is required to scan the pairing QR. Paste the pairing link below instead.");
      }
    });
  }, [cameraPermission, requestCameraPermission]);

  const handlePairingUrl = useCallback(
    async (rawUrl: string) => {
      const url = rawUrl.trim();
      const params = DevicePairingService.parsePairingDeepLink(url);
      if (!params) {
        setErrorMessage("That doesn't look like a pairing link.");
        return false;
      }
      await DevicePairingService.stashPendingDeepLink(params);
      navigation.navigate("Login", { pairingMode: "resume" });
      return true;
    },
    [navigation],
  );

  const handleBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scannerLocked.current) return;
      scannerLocked.current = true;

      try {
        const success = await handlePairingUrl(data);
        if (!success) {
          // Allow retry on next scan
          scannerLocked.current = false;
        }
      } catch {
        scannerLocked.current = false;
        setErrorMessage("Failed to process the QR code. Please try again.");
      }
    },
    [handlePairingUrl],
  );

  const handlePasteContinue = async () => {
    if (!pasteLink.trim()) return;
    setIsPasting(true);
    setErrorMessage(null);
    try {
      await handlePairingUrl(pasteLink);
    } catch {
      setErrorMessage("Failed to store pairing link. Please try again.");
    } finally {
      setIsPasting(false);
    }
  };

  const cameraGranted = cameraPermission?.granted ?? false;

  return (
    <AuthScaffold
      title="Link a new device"
      subtitle="Connect another device to your Trezo account."
      icon={<SigninIcon />}
    >
      {/* Instructional text */}
      <Text style={styles.instruction}>
        Scan the pairing QR shown on your already-linked device.
      </Text>

      {/* Error banner */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Camera card */}
      <View style={styles.cameraCard}>
        {cameraGranted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : (
          <View style={styles.cameraPlaceholder}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.cameraPlaceholderText}>
              {cameraPermission === null
                ? "Requesting camera permission…"
                : "Camera unavailable — use the paste option below."}
            </Text>
          </View>
        )}
      </View>

      {/* Cancel / go back */}
      <TouchableOpacity
        style={styles.cancelRow}
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      {/* Paste expander */}
      <TouchableOpacity
        style={styles.expanderRow}
        onPress={() => setPasteExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: pasteExpanded }}
      >
        <Text style={styles.expanderLabel}>Use a pairing link instead</Text>
        <Text style={styles.expanderChevron}>{pasteExpanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {pasteExpanded ? (
        <View style={styles.pasteSection}>
          <TextInput
            style={styles.pasteInput}
            value={pasteLink}
            onChangeText={setPasteLink}
            placeholder="trezo://pair-device?..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handlePasteContinue}
          />
          <AuthGradientButton
            label={isPasting ? "Storing…" : "Continue"}
            onPress={handlePasteContinue}
            disabled={!pasteLink.trim() || isPasting}
          />
        </View>
      ) : null}
    </AuthScaffold>
  );
}
