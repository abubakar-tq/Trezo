import { Feather } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { BorderRadius, FontFamilies } from "@shared/components/TokenRegistry";
import { LABELS } from "@shared/copy/labels";
import { useAppTheme } from "@theme";

import type { DeployStep } from "@features/wallet/types/deploy";

type Props = {
  step: DeployStep;
  chainName: string;
  deployedAddress: string | null;
  errorMessage: string | null;
  onActivate: () => void;
  onRetry: () => void;
  onDone: () => void;
};

export function DeployAccountSheetBody({
  step,
  chainName,
  deployedAddress,
  errorMessage,
  onActivate,
  onRetry,
  onDone,
}: Props) {
  const { theme } = useAppTheme();
  const { colors } = theme;

  switch (step) {
    case "intro":
      return (
        <View style={styles.stage}>
          <View style={[styles.hero, { backgroundColor: `${colors.accent}26`, borderColor: `${colors.accent}4D` }]}>
            <Feather name="shield" size={40} color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {LABELS.activateOnChain(chainName)}
          </Text>
          <Pressable
            onPress={onActivate}
            style={[styles.cta, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.ctaText, { color: colors.background }]}>Activate</Text>
          </Pressable>
        </View>
      );

    case "passkey":
      return (
        <View style={styles.stage}>
          <View style={[styles.hero, { backgroundColor: `${colors.accent}26`, borderColor: `${colors.accent}4D` }]}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {LABELS.passkeyConfirmation}
          </Text>
        </View>
      );

    case "deploying":
      return (
        <View style={styles.stage}>
          <View style={[styles.hero, { backgroundColor: `${colors.accent}26`, borderColor: `${colors.accent}4D` }]}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            Deploying on {chainName}.
          </Text>
        </View>
      );

    case "success":
      return (
        <View style={styles.stage}>
          <View style={[styles.hero, { backgroundColor: colors.successSoft, borderColor: `${colors.success}4D` }]}>
            <Feather name="check-circle" size={40} color={colors.success} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Activated.</Text>
          {deployedAddress ? (
            <Text style={[styles.address, { color: colors.textSecondary }]}>
              {`${deployedAddress.slice(0, 6)}…${deployedAddress.slice(-4)}`}
            </Text>
          ) : null}
          <Pressable
            onPress={onDone}
            style={[styles.cta, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.ctaText, { color: colors.background }]}>Continue</Text>
          </Pressable>
        </View>
      );

    case "error":
      return (
        <View style={styles.stage}>
          <View style={[styles.hero, { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}4D` }]}>
            <Feather name="alert-circle" size={40} color={colors.danger} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Activation failed.</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {errorMessage ?? "Please try again."}
          </Text>
          <Pressable
            onPress={onRetry}
            style={[styles.cta, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.ctaText, { color: colors.background }]}>Retry</Text>
          </Pressable>
        </View>
      );
  }
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 16,
  },
  hero: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 16,
  },
  address: {
    fontFamily: FontFamilies.mono,
    fontSize: 13,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  cta: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.xl,
    marginTop: 8,
    width: "100%",
    alignItems: "center",
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
