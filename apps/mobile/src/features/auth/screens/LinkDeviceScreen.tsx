import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import DevicePairingService from "@features/wallet/services/DevicePairingService";
import { navigate } from "@app/navigation/navigationRef";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

export function LinkDeviceScreen() {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pasteLink, setPasteLink] = useState("");
  const [isPasting, setIsPasting] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  // Lock the scanner after a successful scan so the same frame doesn't fire
  // twice. Reset on focus so the user can come back and rescan.
  const scannerLocked = useRef(false);
  useFocusEffect(
    useCallback(() => {
      scannerLocked.current = false;
      return () => {
        scannerLocked.current = false;
      };
    }, []),
  );

  const handlePairingUrl = useCallback(
    async (rawUrl: string) => {
      const url = rawUrl.trim();
      const params = DevicePairingService.parsePairingDeepLink(url);
      if (!params) {
        setErrorMessage("That doesn't look like a pairing link.");
        return false;
      }
      await DevicePairingService.stashPendingDeepLink(params);
      // Authenticated entry: jump straight to the pairing screen. The legacy
      // login-resume route is only needed for the pre-auth deep-link case.
      if (isLoggedIn) {
        navigate("PairDevice");
      } else {
        navigate("Login", { pairingMode: "resume" });
      }
      return true;
    },
    [isLoggedIn],
  );

  const handleBarcodeScanned = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (scannerLocked.current) return;
      scannerLocked.current = true;
      try {
        const success = await handlePairingUrl(data);
        if (!success) scannerLocked.current = false;
      } catch {
        scannerLocked.current = false;
        setErrorMessage("Failed to process the QR code. Please try again.");
      }
    },
    [handlePairingUrl],
  );

  const handlePasteContinue = useCallback(async () => {
    if (!pasteLink.trim()) return;
    setIsPasting(true);
    setErrorMessage(null);
    try {
      await handlePairingUrl(pasteLink);
    } catch {
      setErrorMessage("Failed to store the pairing link. Please try again.");
    } finally {
      setIsPasting(false);
    }
  }, [handlePairingUrl, pasteLink]);

  const handleRequestPermission = useCallback(async () => {
    setErrorMessage(null);
    setRequestingPermission(true);
    try {
      const result = await requestCameraPermission();
      if (!result.granted && !result.canAskAgain) {
        setErrorMessage("Camera access is blocked. Open device settings to re-enable it, or paste the pairing link below.");
      }
    } finally {
      setRequestingPermission(false);
    }
  }, [requestCameraPermission]);

  const handleOpenSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch {
      // openSettings can throw on some OEMs — silently ignore.
    }
  }, []);

  const permissionStatus: "loading" | "granted" | "denied" | "blocked" = useMemo(() => {
    if (!cameraPermission) return "loading";
    if (cameraPermission.granted) return "granted";
    if (!cameraPermission.canAskAgain) return "blocked";
    return "denied";
  }, [cameraPermission]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBackBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerKicker}>SECURITY</Text>
          <Text style={styles.headerTitle}>Link this device</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Intro / instructions */}
        <View style={[styles.introCard, { backgroundColor: `${colors.accentAlt}1A`, borderColor: `${colors.accentAlt}33` }]}>
          <Text style={styles.introTitle}>Pair with a trusted device</Text>
          <Text style={styles.introBody}>
            Open Trezo on a device that already has your wallet, go to Linked Devices, tap{" "}
            <Text style={styles.introEmphasis}>Add New Device</Text>, then scan the QR with this device's camera.
          </Text>
        </View>

        {/* Error banner */}
        {errorMessage ? (
          <View style={[styles.errorCard, { backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}40` }]}>
            <Feather name="alert-circle" size={14} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Camera card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: `${colors.accent}1A` }]}>
              <Feather name="camera" size={15} color={colors.accent} />
            </View>
            <Text style={styles.cardTitle}>Scan pairing QR</Text>
          </View>

          <View style={[styles.cameraFrame, { backgroundColor: colors.surfaceMuted, borderColor: colors.borderMuted }]}>
            {permissionStatus === "granted" ? (
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={handleBarcodeScanned}
              />
            ) : permissionStatus === "loading" ? (
              <View style={styles.cameraPlaceholder}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : (
              <View style={styles.cameraPlaceholder}>
                <View style={[styles.permissionIconWrap, { backgroundColor: `${colors.warning}1A`, borderColor: `${colors.warning}40` }]}>
                  <Feather name="camera-off" size={22} color={colors.warning} />
                </View>
                <Text style={[styles.permissionTitle, { color: colors.textPrimary }]}>Camera access needed</Text>
                <Text style={[styles.permissionBody, { color: colors.textSecondary }]}>
                  {permissionStatus === "blocked"
                    ? "Camera permission is blocked for Trezo. Enable it in device settings to scan the pairing QR."
                    : "Trezo needs camera access to read the pairing QR shown on your trusted device."}
                </Text>
                {permissionStatus === "blocked" ? (
                  <TouchableOpacity
                    onPress={handleOpenSettings}
                    style={[styles.permissionBtn, { backgroundColor: colors.accent }]}
                    activeOpacity={0.88}
                  >
                    <Text style={[styles.permissionBtnLabel, { color: colors.textOnAccent }]}>Open device settings</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={handleRequestPermission}
                    disabled={requestingPermission}
                    style={[styles.permissionBtn, { backgroundColor: colors.accent, opacity: requestingPermission ? 0.6 : 1 }]}
                    activeOpacity={0.88}
                  >
                    {requestingPermission ? (
                      <ActivityIndicator color={colors.textOnAccent} />
                    ) : (
                      <Text style={[styles.permissionBtnLabel, { color: colors.textOnAccent }]}>Allow camera access</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {permissionStatus === "granted" ? (
            <Text style={[styles.cardHint, { color: colors.textMuted }]}>
              Hold the QR steady inside the frame.
            </Text>
          ) : null}
        </View>

        {/* Paste card */}
        <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View style={[styles.cardIconWrap, { backgroundColor: `${colors.accentAlt}1A` }]}>
              <Feather name="link-2" size={15} color={colors.accentAlt} />
            </View>
            <Text style={styles.cardTitle}>Or paste the pairing link</Text>
          </View>

          <TextInput
            style={[
              styles.pasteInput,
              { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.textPrimary },
            ]}
            value={pasteLink}
            onChangeText={setPasteLink}
            placeholder="trezowallet://pair-device?..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handlePasteContinue}
          />
          <TouchableOpacity
            onPress={handlePasteContinue}
            disabled={!pasteLink.trim() || isPasting}
            style={[
              styles.pasteBtn,
              { backgroundColor: colors.accent, opacity: !pasteLink.trim() || isPasting ? 0.5 : 1 },
            ]}
            activeOpacity={0.88}
          >
            {isPasting ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <Text style={[styles.pasteBtnLabel, { color: colors.textOnAccent }]}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 58,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderMuted,
    },
    headerBackBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    headerTitleBlock: {
      alignItems: "center",
    },
    headerKicker: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.8,
      color: colors.textMuted,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    scroll: {
      flex: 1,
    },
    body: {
      padding: 20,
      gap: 16,
      paddingBottom: 48,
    },
    introCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 14,
      gap: 6,
    },
    introTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    introBody: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    introEmphasis: {
      color: colors.textPrimary,
      fontWeight: "700",
    },
    errorCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderRadius: 13,
      borderWidth: 1,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 19,
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      gap: 14,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    cardIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    cardHint: {
      fontSize: 12,
      textAlign: "center",
    },
    cameraFrame: {
      width: "100%",
      aspectRatio: 1,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
    },
    camera: {
      flex: 1,
    },
    cameraPlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      gap: 10,
    },
    permissionIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    permissionTitle: {
      fontSize: 15,
      fontWeight: "700",
      textAlign: "center",
    },
    permissionBody: {
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      marginBottom: 4,
    },
    permissionBtn: {
      borderRadius: 14,
      paddingHorizontal: 18,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
      minWidth: 200,
    },
    permissionBtnLabel: {
      fontSize: 14,
      fontWeight: "700",
    },
    pasteInput: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 13,
    },
    pasteBtn: {
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    pasteBtnLabel: {
      fontSize: 14,
      fontWeight: "700",
    },
  });
