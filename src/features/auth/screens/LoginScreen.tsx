import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { AppleIconSignin, GoogleIconSignin, SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
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

  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const canSubmit = trimmedEmail.length > 0 && password.length > 0 && !isSubmitting;

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
      title="Sign in to Trezo"
      subtitle="Securely access your wallet, manage assets, and continue your Web3 journey."
      icon={<SigninIcon />}
      footer={
        <TouchableOpacity activeOpacity={0.8} onPress={handleNavigateToRegister}>
          <Text style={styles.footerText}>
            New to Trezo?
            <Text style={styles.footerLink}> Create an account</Text>
          </Text>
        </TouchableOpacity>
      }
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
        <TextInput
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
        />
        <View>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#666"
            style={styles.input}
            returnKeyType="done"
            textContentType="password"
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
          label={isSubmitting ? "Signing in..." : "Sign in"}
          onPress={handleSubmit}
          disabled={!canSubmit}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
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
      </View>
    </AuthScaffold>
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
  errorText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
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
});

export default LoginScreen;
