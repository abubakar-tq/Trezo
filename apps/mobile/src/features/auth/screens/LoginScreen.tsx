import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

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
import { LABELS } from "@shared/copy/labels";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";


type LoginRoute = RouteProp<AuthStackParamList, "Login">;

type SocialProvider = "google" | "apple";

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route = useRoute<LoginRoute>();
  const { theme } = useAppTheme();
  const { colors, mode } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [email, setEmail] = useState(route.params?.email ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasPendingPairing, setHasPendingPairing] = useState(route.params?.pairingMode === "resume");
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

  return (
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
                backgroundColor: `${colors.danger}${mode === "dark" ? "38" : "29"}`,
                borderColor: `${colors.danger}${mode === "dark" ? "80" : "47"}`,
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
                backgroundColor: `${colors.accentAlt}${mode === "dark" ? "33" : "1F"}`,
                borderColor: `${colors.accentAlt}${mode === "dark" ? "73" : "3D"}`,
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
          placeholderTextColor={colors.textMuted}
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
            placeholderTextColor={colors.textMuted}
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

        <Pressable
          onPress={() => navigation.navigate("LinkDevice")}
          style={({ pressed }) => [styles.linkDeviceBtn, pressed && { opacity: 0.7 }]}
        >
          <Feather name="smartphone" size={16} color={colors.textSecondary} />
          <Text style={styles.linkDeviceText}>{LABELS.linkADevice}</Text>
        </Pressable>
      </View>
    </AuthScaffold>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  formSpacing: {
    rowGap: 16,
  },
  input: {
    backgroundColor: colors.inputBackground,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.textPrimary,
    fontSize: 16,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginTop: 8,
  },
  forgotPasswordText: {
    color: colors.textMuted,
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
    backgroundColor: `${colors.border}73`,
  },
  dividerText: {
    color: colors.textMuted,
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
  footerText: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 14,
  },
  footerLink: {
    color: colors.textPrimary,
    fontWeight: "600",
  },
  linkDeviceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  linkDeviceText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "500",
  },
});

export default LoginScreen;
