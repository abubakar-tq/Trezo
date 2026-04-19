import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import { AuthGradientButton, AuthScaffold } from "@features/auth/components";
import { SupabaseConfigurationError, getSupabaseClient } from "@lib/supabase";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { isValidEmail as validateEmail } from "@utils/validation";

type ForgotPasswordRoute = RouteProp<AuthStackParamList, "ForgotPassword">;

type ResetFlow = "reset";

type CooldownKey = `${ResetFlow}:${string}`;

const formatCooldown = (value: number) => {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
};

const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route = useRoute<ForgotPasswordRoute>();
  const setPending = useAuthFlowStore((state) => state.setPending);
  const setLastSuccess = useAuthFlowStore((state) => state.setLastSuccess);
  const resendAvailableAt = useAuthFlowStore((state) => state.resendAvailableAt);
  const setResendCooldown = useAuthFlowStore((state) => state.setResendCooldown);
  const clearResendCooldown = useAuthFlowStore((state) => state.clearResendCooldown);

  const [email, setEmail] = useState(route.params?.email ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const trimmedEmail = useMemo(() => email.trim(), [email]);
  const isValidEmail = useMemo(() => validateEmail(trimmedEmail), [trimmedEmail]);
  const cooldownKey = useMemo<CooldownKey | null>(() => {
    if (!trimmedEmail) return null;
    return `reset:${trimmedEmail.toLowerCase()}`;
  }, [trimmedEmail]);
  const cooldownTimestamp = cooldownKey ? resendAvailableAt[cooldownKey] ?? null : null;

  useEffect(() => {
    if (!cooldownTimestamp || !trimmedEmail) {
      setCooldownSeconds(0);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.ceil((cooldownTimestamp - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining <= 0) {
        // Call clearResendCooldown directly - it's a stable Zustand action
        clearResendCooldown(trimmedEmail, "reset");
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldownTimestamp, trimmedEmail]); // clearResendCooldown is a stable Zustand action, safe to omit

  const canSubmit = isValidEmail && !isSubmitting && cooldownSeconds === 0;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const client = getSupabaseClient();
      const { error } = await client.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: false,
          data: { flow: "reset" },
        },
      });

      if (error) {
        throw error;
      }

      setLastSuccess(null);
      setPending(trimmedEmail, "reset");
      setResendCooldown(trimmedEmail, "reset", 120);
      navigation.navigate("VerifyEmail", {
        email: trimmedEmail,
        flow: "reset",
      });
    } catch (err) {
      if (err instanceof SupabaseConfigurationError) {
        Alert.alert("Configuration required", err.message);
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to send reset code.";
      Alert.alert("Couldn’t send reset code", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSupport = () => {
    Alert.alert(
      "Need help?",
      "Once the reset flow is live, you'll receive an email with instructions.",
    );
  };

  return (
    <AuthScaffold
      title="Reset your password"
      subtitle="Enter the email associated with your Trezo account. We'll send a 6-digit code to verify it's you."
      icon={<SigninIcon />}
      footer={
        <TouchableOpacity activeOpacity={0.8} onPress={handleSupport}>
          <Text style={styles.footerText}>Trouble accessing email? Contact support</Text>
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
        />
        {!isValidEmail && trimmedEmail.length > 0 && (
          <Text style={styles.validationText}>Enter a valid email address to continue.</Text>
        )}

        <AuthGradientButton
          label={
            isSubmitting
              ? "Sending code..."
              : cooldownSeconds > 0
              ? `Wait ${formatCooldown(cooldownSeconds)}`
              : "Send verification code"
          }
          onPress={handleSubmit}
          disabled={!canSubmit}
        />

        {cooldownSeconds > 0 && (
          <Text style={styles.cooldownText}>
            You can request another code in {formatCooldown(cooldownSeconds)}.
          </Text>
        )}
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
  validationText: {
    color: "#f87171",
    fontSize: 12,
    textAlign: "center",
  },
  cooldownText: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 12,
    color: "#94a3b8",
  },
  footerText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 13,
  },
});

export default ForgotPasswordScreen;
