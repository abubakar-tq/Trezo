import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { AuthApiError } from "@supabase/supabase-js";
import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { AppleIconSignin, GoogleIconSignin, SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import { AuthGradientButton, AuthScaffold, PasswordInput, PasswordRulesCard, SocialButton } from "@features/auth/components";
import {
    SupabaseAccountExistsError,
    ensureOAuthPrerequisites,
    startSupabaseOAuth,
} from "@lib/oauth";
import { SupabaseConfigurationError, getSupabaseClient } from "@lib/supabase";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { isStrongPassword } from "@utils/password";
import { isValidEmail as validateEmail } from "@utils/validation";

type RegisterRoute = RouteProp<AuthStackParamList, "Register">;
type SocialProvider = "google" | "apple";
type PendingFlow = "register";

const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route = useRoute<RegisterRoute>();
  const setPending = useAuthFlowStore((state) => state.setPending);
  const setLastSuccess = useAuthFlowStore((state) => state.setLastSuccess);

  const [email, setEmail] = useState(route.params?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);

  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const isValidEmail = useMemo(() => validateEmail(trimmedEmail), [trimmedEmail]);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const passwordStrong = isStrongPassword(password);
  const hasStartedPassword = password.length > 0 || confirmPassword.length > 0;
  const canSubmit = isValidEmail && passwordStrong && passwordsMatch && !isSubmitting;

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

      if (err instanceof SupabaseAccountExistsError) {
        Alert.alert(
          "Account already exists",
          "Looks like you already created a Trezo account with this Google identity. Please sign in to continue.",
          [
            { text: "OK", style: "cancel" },
            { text: "Go to sign in", onPress: handleNavigateToLogin },
          ],
        );
        return;
      }

      if (err instanceof Error) {
        if (/cancelled/i.test(err.message)) {
          return;
        }
        Alert.alert("OAuth failed", err.message);
        return;
      }

      Alert.alert("OAuth failed", "Unable to start the social sign-up flow.");
    } finally {
      setSocialLoading(null);
    }
  };

  const handleContinue = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: { flow: "register" satisfies PendingFlow },
        },
      });

      if (error) {
        throw error;
      }

      setPassword("");
      setConfirmPassword("");

      if (data.user?.email_confirmed_at) {
        setLastSuccess({ type: "account-created", email: trimmedEmail });
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "AuthResult",
              params: { type: "account-created", email: trimmedEmail },
            },
          ],
        });
        return;
      }

      setPending(trimmedEmail, "register");
      navigation.navigate("VerifyEmail", {
        email: trimmedEmail,
        flow: "register",
      });
    } catch (err) {
      if (err instanceof SupabaseConfigurationError) {
        Alert.alert("Configuration required", err.message);
        return;
      }

      if (
        err instanceof AuthApiError &&
        (/already|exists|registered/i.test(err.message) || [400, 409, 422].includes(err.status))
      ) {
        Alert.alert(
          "Account already exists",
          "We found an account with this email. Sign in with your credentials or reset your password to continue.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Go to sign in", onPress: handleNavigateToLogin },
          ],
        );
        return;
      }

      const message = err instanceof Error ? err.message : "Unable to create account.";
      Alert.alert("Sign-up failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNavigateToLogin = () => {
    navigation.navigate(
      "Login",
      trimmedEmail ? { email: trimmedEmail } : undefined,
    );
  };

  return (
    <AuthScaffold
      title="Create your Trezo account"
      subtitle="Use a social provider or verify your email with a secure PIN to get started."
      icon={<SigninIcon />}
      footer={
        <TouchableOpacity activeOpacity={0.8} onPress={handleNavigateToLogin}>
          <Text style={styles.footerText}>
            Already have an account?
            <Text style={styles.footerLink}> Sign in</Text>
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.formSpacing}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor="#666"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          returnKeyType="done"
          textContentType="emailAddress"
        />

        {!isValidEmail && trimmedEmail.length > 0 && (
          <Text style={styles.validationText}>Enter a valid email address to continue.</Text>
        )}

        <View style={styles.passwordHeader}>
          <Text style={styles.passwordLabel}>Password</Text>
        </View>
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          placeholderTextColor="#666"
          style={styles.input}
          returnKeyType="next"
          textContentType="newPassword"
        />

        <PasswordInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm password"
          placeholderTextColor="#666"
          style={styles.input}
          returnKeyType="done"
          textContentType="password"
        />

        {hasStartedPassword ? (
          <PasswordRulesCard password={password} confirmPassword={confirmPassword} />
        ) : null}

        <AuthGradientButton
          label={isSubmitting ? "Creating account..." : "Create account"}
          onPress={handleContinue}
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
  passwordHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 4,
  },
  passwordLabel: {
    color: "#9ca3af",
    fontSize: 13,
    fontWeight: "600",
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
  validationText: {
    color: "#f87171",
    fontSize: 12,
    textAlign: "center",
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

export default RegisterScreen;
