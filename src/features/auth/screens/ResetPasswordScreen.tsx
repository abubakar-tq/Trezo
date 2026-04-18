import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import { AuthGradientButton, AuthScaffold, PasswordInput, PasswordRulesCard } from "@features/auth/components";
import { SupabaseConfigurationError, getSupabaseClient } from "@lib/supabase";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { useUserStore } from "@store/useUserStore";
import { isStrongPassword, suggestPasswordRules } from "@utils/password";
import { getUsernameError, isValidUsername } from "@utils/validation";

type ResetPasswordRoute = RouteProp<AuthStackParamList, "ResetPassword">;

const ResetPasswordScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const { email, flow } = useRoute<ResetPasswordRoute>().params;
  const { setProfile, setIsOnboarded } = useUserStore();
  const pendingEmail = useAuthFlowStore((state) => state.pendingEmail);
  const pendingFlow = useAuthFlowStore((state) => state.pendingFlow);
  const clearPending = useAuthFlowStore((state) => state.clearPending);
  const setGuardNavigation = useAuthFlowStore((state) => state.setGuardNavigation);
  const setLastSuccess = useAuthFlowStore((state) => state.setLastSuccess);

  useEffect(() => {
    if (!pendingEmail || !pendingFlow || pendingEmail !== email || pendingFlow !== flow) {
      navigation.reset({
        index: 0,
        routes: [{ name: "Login", params: { email } }],
      });
      return;
    }
    setGuardNavigation(true);
    return () => {
      setGuardNavigation(false);
    };
    // Only run on mount and when critical params change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, flow, pendingEmail, pendingFlow]);

  const requiresProfileSetup = flow === "register";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmedUsername = useMemo(() => username.trim(), [username]);
  const usernameValid = !requiresProfileSetup || isValidUsername(trimmedUsername);
  const usernameError = useMemo(() => {
    if (!requiresProfileSetup || !trimmedUsername) return null;
    return getUsernameError(trimmedUsername);
  }, [requiresProfileSetup, trimmedUsername]);
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const passwordStrong = isStrongPassword(password);
  const canSubmit = usernameValid && passwordStrong && passwordsMatch && !isSubmitting;

  const title = flow === "register" ? "Finish your setup" : "Reset your password";
  const subtitle =
    flow === "register"
      ? `Choose a display name and create a strong password to secure your Trezo wallet. ${suggestPasswordRules}`
      : `Enter and confirm a new password to regain access to your Trezo account. ${suggestPasswordRules}`;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.updateUser({
        password,
        ...(requiresProfileSetup ? { data: { username: trimmedUsername } } : {}),
      });

      if (error) {
        throw error;
      }

      const metadataUsername = (data?.user?.user_metadata?.username as string | undefined)?.trim();
      const avatarUrl = (data?.user?.user_metadata?.avatarUrl as string | undefined) ?? undefined;
      const effectiveUsername = requiresProfileSetup ? trimmedUsername : metadataUsername;
      if (effectiveUsername || avatarUrl) {
        const profilePayload = {
          ...(effectiveUsername ? { username: effectiveUsername } : {}),
          ...(avatarUrl ? { avatarUrl } : {}),
        };

        setProfile(profilePayload);
      }

      if (requiresProfileSetup) {
        setIsOnboarded(true);
      }

      setPassword("");
      setConfirmPassword("");
      setUsername("");

      if (data?.user?.id && (effectiveUsername || avatarUrl)) {
        const { error: profileError } = await client
          .from("profiles")
          .upsert(
            {
              id: data.user.id,
              username: effectiveUsername ?? null,
              avatar_url: avatarUrl ?? null,
            },
            { onConflict: "id" },
          );

        if (profileError) {
          throw profileError;
        }
      }

      const successType: "account-created" | "password-updated" = requiresProfileSetup
        ? "account-created"
        : "password-updated";

      await client.auth.signOut().catch(() => null);

      clearPending();
      setLastSuccess({ type: successType, email });
      setGuardNavigation(false);
      navigation.reset({
        index: 0,
        routes: [{ name: "AuthResult", params: { type: successType, email } }],
      });
    } catch (err) {
      if (err instanceof SupabaseConfigurationError) {
        Alert.alert("Configuration required", err.message);
        return;
      }
      const message = err instanceof Error ? err.message : "Unable to update password.";
      Alert.alert("Update failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScaffold title={title} subtitle={subtitle} icon={<SigninIcon />}>
      <View style={styles.formSpacing}>
        {requiresProfileSetup && (
          <>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Choose a username"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              returnKeyType="next"
            />
            {usernameError && username.length > 0 && (
              <Text style={styles.validationText}>{usernameError}</Text>
            )}
          </>
        )}

        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder="New password"
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

        <PasswordRulesCard password={password} confirmPassword={confirmPassword} />

        <AuthGradientButton
          label={isSubmitting ? "Saving password..." : "Save password"}
          onPress={handleSubmit}
          disabled={!canSubmit}
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
  validationText: {
    color: "#f87171",
    fontSize: 12,
    textAlign: "center",
  },
});

export default ResetPasswordScreen;
