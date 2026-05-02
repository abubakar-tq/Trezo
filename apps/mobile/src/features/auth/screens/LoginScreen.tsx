import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { CameraView, type BarcodeScanningResult, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { AppleIconSignin, GoogleIconSignin, SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import DevicePairingService from "@/src/features/wallet/services/DevicePairingService";
import {
    AuthGradientButton,
    AuthScaffold,
    PasswordInput,
    SocialButton,
} from "@features/auth/components";
import { ensureOAuthPrerequisites, startSupabaseOAuth } from "@lib/oauth";
import { SupabaseConfigurationError, getSupabaseClient } from "@lib/supabase";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

type LoginRoute = RouteProp<AuthStackParamList, "Login">;

type SocialProvider = "google" | "apple";

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route = useRoute<LoginRoute>();
  const { theme } = useAppTheme();
  const { colors, mode } = theme;

  const [email, setEmail] = useState(route.params?.email ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pairingLink, setPairingLink] = useState("");
  const [hasPendingPairing, setHasPendingPairing] = useState(route.params?.pairingMode === "resume");
  const [showPairingLinkEntry, setShowPairingLinkEntry] = useState(route.params?.pairingMode !== "resume");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerLocked, setScannerLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const canSubmit = trimmedEmail.length > 0 && password.length > 0 && !isSubmitting;
  const isPairingLogin = hasPendingPairing;

  const focusCredentialEntry = useCallback(() => {
    setTimeout(() => {
      if (trimmedEmail.length > 0) {
        passwordInputRef.current?.focus();
        return;
      }
      emailInputRef.current?.focus();
    }, 80);
  }, [trimmedEmail.length]);

  useEffect(() => {
    let cancelled = false;

    DevicePairingService.getPendingDeepLink()
      .then((pending) => {
        if (!pending || cancelled) return;
        setHasPendingPairing(true);
        setShowPairingLinkEntry(false);
        focusCredentialEntry();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [focusCredentialEntry]);

  useEffect(() => {
    if (route.params?.pairingMode !== "resume") return;
    setHasPendingPairing(true);
    setShowPairingLinkEntry(false);
    focusCredentialEntry();
  }, [focusCredentialEntry, route.params?.pairingMode]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        throw error;
      }
      setPassword("");
    } catch (err) {
      if (err instanceof SupabaseConfigurationError) {
        Alert.alert("Configuration required", err.message);
        return;
      }
      if (err instanceof Error) {
        if (/invalid login/i.test(err.message)) {
          setErrorMessage("Invalid email or password. Double-check your credentials and try again.");
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Unable to sign in. Please try again later.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSocial = async (provider: SocialProvider) => {
    try {
      ensureOAuthPrerequisites();
      setSocialLoading(provider);
      await startSupabaseOAuth(provider);
    } catch (err) {
      if (err instanceof SupabaseConfigurationError) {
        Alert.alert("Configuration required", err.message);
        return;
      }
      if (err instanceof Error) {
        if (/cancelled/i.test(err.message)) {
          return;
        }
        Alert.alert("OAuth failed", err.message);
        return;
      }
      Alert.alert("OAuth failed", "Unable to start the social sign-in flow.");
    } finally {
      setSocialLoading(null);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate(
      "ForgotPassword",
      trimmedEmail ? { email: trimmedEmail } : undefined,
    );
  };

  const handleNavigateToRegister = () => {
    navigation.navigate(
      "Register",
      trimmedEmail ? { email: trimmedEmail } : undefined,
    );
  };

  const handleStorePairingLink = async (rawLink: string) => {
    const parsed = DevicePairingService.parsePairingDeepLink(rawLink.trim());
    if (!parsed) {
      setErrorMessage("Invalid pairing QR or deep link.");
      return;
    }

    await DevicePairingService.stashPendingDeepLink(parsed);
    setHasPendingPairing(true);
    setShowPairingLinkEntry(false);
    setErrorMessage(null);
    setPairingLink("");
    setScannerVisible(false);
    setScannerLocked(false);
    focusCredentialEntry();
  };

  const handleScanPress = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        Alert.alert("Camera permission required", "Allow camera access to scan the pairing QR code, or paste the link manually below.");
        return;
      }
    }

    setScannerLocked(false);
    setScannerVisible(true);
  };

  const handleBarcodeScanned = async ({ data }: BarcodeScanningResult) => {
    if (scannerLocked) return;
    setScannerLocked(true);
    try {
      await handleStorePairingLink(data);
    } catch (err) {
      setScannerLocked(false);
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Failed to store pairing link.");
      }
    }
  };

  return (
    <>
      <AuthScaffold
        title={isPairingLogin ? "Sign in to add this device" : "Sign in to Trezo"}
        subtitle={
          isPairingLogin
            ? "Use the same Trezo account as the trusted device. After sign-in, passkey setup resumes automatically."
            : "Securely access your wallet, manage assets, and continue your Web3 journey."
        }
        icon={<SigninIcon />}
        footer={!isPairingLogin ? (
          <TouchableOpacity activeOpacity={0.8} onPress={handleNavigateToRegister}>
            <Text style={styles.footerText}>
              New to Trezo?
              <Text style={styles.footerLink}> Create an account</Text>
            </Text>
          </TouchableOpacity>
        ) : undefined}
      >
        <View style={styles.formSpacing}>
          {errorMessage ? (
            <View
              style={[
                styles.errorContainer,
                {
                  backgroundColor: withAlpha(colors.danger, mode === "dark" ? 0.22 : 0.16),
                  borderColor: withAlpha(colors.danger, mode === "dark" ? 0.5 : 0.28),
                },
              ]}
            >
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
            </View>
          ) : null}
          {isPairingLogin ? (
            <View
              style={[
                styles.infoContainer,
                {
                  backgroundColor: withAlpha(colors.accentAlt, mode === "dark" ? 0.2 : 0.12),
                  borderColor: withAlpha(colors.accentAlt, mode === "dark" ? 0.45 : 0.24),
                },
              ]}
            >
              <Text style={[styles.infoText, { color: colors.textPrimary }]}>
                Pairing request saved. Sign in with the same account used on the trusted device to continue.
              </Text>
            </View>
          ) : null}
          <TextInput
            ref={emailInputRef}
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="#666"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            returnKeyType="next"
            textContentType="emailAddress"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordInputRef.current?.focus()}
          />
          <View>
            <PasswordInput
              ref={passwordInputRef}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#666"
              style={styles.input}
              returnKeyType="done"
              textContentType="password"
              onSubmitEditing={() => void handleSubmit()}
            />
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleForgotPassword}
              style={styles.forgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <AuthGradientButton
            label={isSubmitting ? "Signing in..." : isPairingLogin ? "Sign in and continue" : "Sign in"}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{isPairingLogin ? "or use another sign-in method" : "or continue with"}</Text>
            <View style={styles.dividerLine} />
          </View>

          <SocialButton
            label="Google"
            icon={<GoogleIconSignin size={24} />}
            onPress={() => handleSocial("google")}
            loading={socialLoading === "google"}
          />
          <SocialButton
            label="Apple"
            icon={<AppleIconSignin size={24} />}
            onPress={() => handleSocial("apple")}
            loading={socialLoading === "apple"}
          />

          {showPairingLinkEntry ? (
            <View style={styles.pairingCard}>
              <Text style={styles.pairingTitle}>Add a pairing link</Text>
              <Text style={styles.pairingSubtitle}>
                Scan the QR from the trusted device on a real phone, or paste the `trezo://pair-device?...` link when testing on an emulator.
              </Text>

              <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={handleScanPress}>
                <Text style={styles.secondaryButtonLabel}>Scan pairing QR</Text>
              </TouchableOpacity>

              <TextInput
                value={pairingLink}
                onChangeText={setPairingLink}
                placeholder="Paste pairing deep link"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <TouchableOpacity
                style={styles.linkButton}
                activeOpacity={0.85}
                onPress={() => void handleStorePairingLink(pairingLink)}
              >
                <Text style={styles.linkButtonLabel}>Pair this device</Text>
              </TouchableOpacity>
            </View>
          ) : isPairingLogin ? (
            <TouchableOpacity
              style={styles.inlineLinkButton}
              activeOpacity={0.85}
              onPress={() => setShowPairingLinkEntry(true)}
            >
              <Text style={styles.inlineLinkLabel}>Use a different pairing link</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </AuthScaffold>

      <Modal visible={scannerVisible} animationType="slide" transparent onRequestClose={() => setScannerVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Scan pairing QR</Text>
            <Text style={styles.modalSubtitle}>Use a physical device camera. If you are testing on an emulator, close this and paste the pairing link instead.</Text>
            <View style={styles.cameraFrame}>
              <CameraView
                style={styles.camera}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                onBarcodeScanned={handleBarcodeScanned}
              />
            </View>
            <TouchableOpacity style={styles.linkButton} activeOpacity={0.85} onPress={() => setScannerVisible(false)}>
              <Text style={styles.linkButtonLabel}>Close scanner</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  formSpacing: {
    rowGap: 16,
  },
  input: {
    backgroundColor: "#171419",
    borderColor: "#333333",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#ffffff",
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  forgotPasswordText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(156,163,175,0.45)",
  },
  dividerText: {
    color: "#9ca3af",
    fontSize: 12,
    marginHorizontal: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  errorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  infoContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  infoText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  pairingCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 16,
    rowGap: 12,
  },
  pairingTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  pairingSubtitle: {
    color: "#d1d5db",
    fontSize: 12,
    lineHeight: 18,
  },
  secondaryButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingVertical: 13,
    alignItems: "center",
  },
  secondaryButtonLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  linkButton: {
    borderRadius: 999,
    backgroundColor: "rgba(0,136,255,0.18)",
    paddingVertical: 13,
    alignItems: "center",
  },
  linkButtonLabel: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  inlineLinkButton: {
    alignSelf: "center",
    paddingVertical: 4,
  },
  inlineLinkLabel: {
    color: "#d1d5db",
    fontSize: 13,
    fontWeight: "600",
  },
  footerText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 14,
  },
  footerLink: {
    color: "#ffffff",
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 24,
    backgroundColor: "#161319",
    padding: 18,
    rowGap: 14,
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: "#d1d5db",
    fontSize: 13,
    lineHeight: 18,
  },
  cameraFrame: {
    overflow: "hidden",
    borderRadius: 20,
    minHeight: 320,
    backgroundColor: "#000000",
  },
  camera: {
    flex: 1,
    minHeight: 320,
  },
});

export default LoginScreen;
