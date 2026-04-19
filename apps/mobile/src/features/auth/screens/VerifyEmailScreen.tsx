import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import { AuthGradientButton, AuthScaffold } from "@features/auth/components";
import { SupabaseConfigurationError, getSupabaseClient } from "@lib/supabase";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { useUserStore } from "@store/useUserStore";
import {
  OTP_LENGTH,
  formatOTPArray,
  isOTPDigit,
  maskEmail,
} from "@utils/validation";

type VerifyEmailRoute = RouteProp<AuthStackParamList, "VerifyEmail">;

type PendingFlow = "register" | "reset";

type ResendCooldownKey = `${PendingFlow}:${string}`;

const RESEND_SECONDS = 120;

const formatTimer = (value: number) => {
  const safeValue = Math.max(0, value);
  const minutes = Math.floor(safeValue / 60);
  const seconds = safeValue % 60;
  const minuteLabel = minutes.toString().padStart(2, "0");
  const secondLabel = seconds.toString().padStart(2, "0");
  return `${minuteLabel}:${secondLabel}`;
};

const VerifyEmailScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const route = useRoute<VerifyEmailRoute>();

  const { email, flow } = route.params;

  const pendingEmail = useAuthFlowStore((state) => state.pendingEmail);
  const pendingFlow = useAuthFlowStore((state) => state.pendingFlow);
  const clearPending = useAuthFlowStore((state) => state.clearPending);
  const setGuardNavigation = useAuthFlowStore((state) => state.setGuardNavigation);
  const setLastSuccess = useAuthFlowStore((state) => state.setLastSuccess);
  const setResendCooldown = useAuthFlowStore((state) => state.setResendCooldown);
  const resendAvailableAt = useAuthFlowStore((state) => state.resendAvailableAt);
  const resetUserStore = useUserStore((state) => state.reset);

  const [otpValues, setOtpValues] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [timer, setTimer] = useState(RESEND_SECONDS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const inputsRef = useRef<(TextInput | null)[]>([]);
  const emailSnippet = useMemo(() => maskEmail(email), [email]);

  useEffect(() => {
    if (!pendingEmail || !pendingFlow || pendingEmail !== email || pendingFlow !== flow) {
      navigation.reset({
        index: 0,
        routes: [{ name: "Login", params: { email } }],
      });
    }
  }, [email, flow, navigation, pendingEmail, pendingFlow]);

  useEffect(() => {
    setGuardNavigation(true);
    return () => {
      setGuardNavigation(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    const key: ResendCooldownKey = `${flow}:${email.toLowerCase()}`;
    const availableAt = resendAvailableAt[key];
    if (!availableAt) {
      setTimer(RESEND_SECONDS);
      return;
    }
    const remaining = Math.max(0, Math.ceil((availableAt - Date.now()) / 1000));
    setTimer(remaining);
  }, [email, flow, resendAvailableAt]);

  const handleOtpChange = (index: number, value: string) => {
    if (!isOTPDigit(value)) return;
    const next = [...otpValues];
    next[index] = value;
    setOtpValues(next);
    if (value && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !otpValues[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    if (timer > 0 || isResending) return;
    setIsResending(true);
    try {
      const client = getSupabaseClient();

      if (flow === "register") {
        const { error } = await client.auth.resend({
          type: "signup",
          email,
        });
        if (error) {
          throw error;
        }
      } else {
        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
          },
        });
        if (error) {
          throw error;
        }
      }

      setResendCooldown(email, flow, RESEND_SECONDS);
      setTimer(RESEND_SECONDS);
      Alert.alert("Code resent", "We’ve sent a fresh verification code to your email.");
    } catch (err) {
      if (err instanceof SupabaseConfigurationError) {
        Alert.alert("Configuration required", err.message);
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to resend code right now.";
      Alert.alert("Couldn’t resend code", message);
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = async () => {
    const code = formatOTPArray(otpValues);
    if (code.length !== OTP_LENGTH) {
      Alert.alert("Enter full code", `Please enter the ${OTP_LENGTH}-digit code to continue.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.verifyOtp({
        email,
        token: code,
        type: flow === "register" ? "signup" : "recovery",
      });

      if (error) {
        throw error;
      }

      if (flow === "register") {
        if (data?.session) {
          await client.auth.signOut().catch(() => null);
        }

        resetUserStore();
        clearPending();
        setLastSuccess({ type: "account-created", email });
        setGuardNavigation(false);
        navigation.reset({
          index: 0,
          routes: [
            {
              name: "AuthResult",
              params: { type: "account-created", email },
            },
          ],
        });
        return;
      }

      navigation.navigate("ResetPassword", {
        email,
        flow,
      });
    } catch (err) {
      if (err instanceof SupabaseConfigurationError) {
        Alert.alert("Configuration required", err.message);
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to verify code.";
      Alert.alert("Verification failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = flow === "register" ? "Verify your email" : "Confirm reset code";
  const subtitle =
    flow === "register"
      ? `Enter the code we sent to ${emailSnippet} to create your Trezo account.`
      : `We sent a reset code to ${emailSnippet}. Enter it below to continue.`;

  return (
    <AuthScaffold
      title={title}
      subtitle={subtitle}
      icon={<SigninIcon />}
      glowColor="#60a5fa"
      footer={
        <Text style={styles.footerText}>
          By continuing, you agree to Trezo’s <Text style={styles.footerHighlight}>Terms</Text> &
          <Text style={styles.footerHighlight}> Privacy Policy</Text>.
        </Text>
      }
    >
      <View style={styles.formSpacing}>
        <View style={styles.otpRow}>
          {otpValues.map((value, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputsRef.current[index] = ref;
              }}
              value={value}
              keyboardType="number-pad"
              returnKeyType="next"
              maxLength={1}
              onChangeText={(text) => handleOtpChange(index, text)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
              style={styles.otpInput}
            />
          ))}
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.timerText}>
            Code expires in <Text style={styles.timerStrong}>{formatTimer(timer)}</Text>
          </Text>
          <TouchableOpacity activeOpacity={0.8} onPress={handleResend} disabled={timer > 0 || isResending}>
            <Text style={[styles.resendText, (timer > 0 || isResending) && styles.resendDisabled]}>
              {isResending ? "Resending..." : "Resend code"}
            </Text>
          </TouchableOpacity>
        </View>

        <AuthGradientButton
          label={isSubmitting ? "Verifying..." : "Continue"}
          onPress={handleContinue}
          disabled={isSubmitting}
        />

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() =>
            Linking.openURL(
              "https://github.com/Adeel56/Trezo_Wallet/blob/main/docs/supabase-setup.md#5-configure-authentication-cloud",
            ).catch(() =>
              Alert.alert(
                "Open docs",
                "We couldn’t open the setup guide right now. Please copy the link from the docs folder instead.",
              ),
            )
          }
        >
          <Text style={styles.magicLinkHelp}>
            Only seeing a magic-link email? Update your Supabase email templates to include the 6-digit code—see the setup guide.
          </Text>
        </TouchableOpacity>
      </View>
    </AuthScaffold>
  );
};

const styles = StyleSheet.create({
  formSpacing: {
    rowGap: 24,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    maxWidth: 320,
    paddingHorizontal: 12,
    columnGap: 10,
  },
  otpInput: {
    flex: 1,
    minWidth: 42,
    maxWidth: 52,
    height: 64,
    backgroundColor: "#171419",
    borderColor: "#333333",
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal: 4,
    textAlign: "center",
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timerText: {
    color: "#9ca3af",
    fontSize: 13,
  },
  timerStrong: {
    color: "#ffffff",
    fontWeight: "600",
  },
  resendText: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "600",
  },
  resendDisabled: {
    color: "rgba(96,165,250,0.4)",
  },
  footerText: {
    textAlign: "center",
    color: "#6b7280",
    fontSize: 12,
    lineHeight: 18,
  },
  footerHighlight: {
    color: "#93c5fd",
  },
  magicLinkHelp: {
    color: "#60a5fa",
    fontSize: 12,
    textAlign: "center",
  },
});

export default VerifyEmailScreen;
