import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SigninIcon } from "@/assets/components";
import { PasskeyService } from "@/src/core/auth/passkeys";
import { AuthGradientButton, AuthScaffold } from "@features/auth/components";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

const FEATURES: { icon: React.ComponentProps<typeof Feather>["name"]; label: string; detail: string }[] = [
  { icon: "cpu", label: "Device-bound security", detail: "Stored in your device's secure hardware chip" },
  { icon: "eye-off", label: "Phishing-resistant", detail: "Cannot be stolen, replicated, or leaked online" },
  { icon: "zap", label: "Instant sign-in", detail: "One biometric tap — no passwords to remember" },
];

const PasskeyRegistrationScreen = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);

  useEffect(() => {
    PasskeyService.isSupported().then(setPasskeySupported);
  }, []);

  const handleCreatePasskey = async () => {
    setLoading(true);
    try {
      const isSupported = await PasskeyService.isSupported();
      if (!isSupported) {
        Alert.alert(
          "Not Available",
          "Passkeys require a development build. You can skip this step and test other features.",
          [{ text: "OK" }],
        );
        return;
      }
      const username = "user@example.com";
      await PasskeyService.register(username);
      Alert.alert("Success", "Passkey created successfully!", [
        { text: "Continue", onPress: () => { console.log("Navigate to next step"); } },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create passkey. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    console.log("Skipped Passkey");
  };

  return (
    <AuthScaffold
      title="Secure Your Wallet"
      subtitle="A passkey uses your device biometrics — faster and safer than any password."
      icon={<SigninIcon />}
    >
      {/* Not-supported warning */}
      {passkeySupported === false && (
        <View style={[styles.warningCard, { backgroundColor: `${colors.warning}18`, borderColor: `${colors.warning}4D` }]}>
          <Feather name="alert-triangle" size={15} color={colors.warning} />
          <Text style={[styles.warningText, { color: colors.warning }]}>
            Running in Expo Go — passkeys are unavailable here. Tap Skip to continue testing other features.
          </Text>
        </View>
      )}

      {/* Feature list */}
      <View style={[styles.featureCard, { backgroundColor: `${colors.accent}0D`, borderColor: `${colors.accent}26` }]}>
        {FEATURES.map((f, i) => (
          <View
            key={f.icon}
            style={[
              styles.featureRow,
              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `${colors.accent}22` },
            ]}
          >
            <View style={[styles.featureIconWrap, { backgroundColor: `${colors.accent}22` }]}>
              <Feather name={f.icon} size={14} color={colors.accent} />
            </View>
            <View style={styles.featureTextBlock}>
              <Text style={[styles.featureLabel, { color: colors.textPrimary }]}>{f.label}</Text>
              <Text style={[styles.featureDetail, { color: colors.textSecondary }]}>{f.detail}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Primary CTA */}
      <AuthGradientButton
        label={loading ? "Creating passkey…" : "Create Passkey"}
        onPress={handleCreatePasskey}
        disabled={loading || passkeySupported === false}
      />

      {/* Skip link */}
      <TouchableOpacity onPress={handleSkip} style={styles.skipBtn} activeOpacity={0.6}>
        <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip for now</Text>
      </TouchableOpacity>
    </AuthScaffold>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    warningCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      borderRadius: 13,
      borderWidth: 1,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    warningText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 19,
    },
    featureCard: {
      borderRadius: 16,
      borderWidth: 1,
      overflow: "hidden",
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    featureIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    featureTextBlock: {
      flex: 1,
      gap: 2,
    },
    featureLabel: {
      fontSize: 14,
      fontWeight: "700",
    },
    featureDetail: {
      fontSize: 12,
      lineHeight: 17,
    },
    skipBtn: {
      alignItems: "center",
      paddingVertical: 10,
      minHeight: 44,
      justifyContent: "center",
    },
    skipText: {
      fontSize: 13,
      fontWeight: "500",
    },
  });

export default PasskeyRegistrationScreen;
