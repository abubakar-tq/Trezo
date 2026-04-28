import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { RootStackParamList } from "@/src/types/navigation";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";

const CompromisedWalletScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const user = useUserStore((state) => state.user);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const handleGuardianStart = useCallback(async () => {
    if (!user?.id) {
      navigation.navigate("RecoveryEntry");
      return;
    }

    const localPasskey = await PasskeyService.getPasskey(user.id);
    if (localPasskey?.credentialIdRaw) {
      navigation.navigate("GuardianRecovery");
      return;
    }

    navigation.navigate("RecoveryEntry");
  }, [navigation, user?.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Compromised Wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Use recovery to replace access without changing your wallet address</Text>
        <Text style={styles.text}>
          If a device or passkey may be compromised, start a recovery flow that installs a new passkey after guardian approvals and the configured timelock.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => void handleGuardianStart()}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonLabel}>Start guardian recovery</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("GuardianRecovery")}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonLabel}>Review guardian setup</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("EmailRecovery")}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonLabel}>Review email recovery</Text>
        </TouchableOpacity>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What Level 2 does</Text>
          <Text style={styles.infoText}>
            Guardians approve one portable recovery intent, any caller can submit it on-chain, and execution stays delayed by the wallet's timelock before the new passkey becomes active.
          </Text>
        </View>
      </View>
    </View>
  );
};

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
      paddingTop: 60,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    body: {
      flex: 1,
      padding: 20,
      gap: 12,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "700",
      lineHeight: 30,
    },
    text: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    primaryButton: {
      marginTop: 12,
      backgroundColor: colors.accentAlt,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    primaryButtonLabel: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    secondaryButton: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      paddingVertical: 14,
      alignItems: "center",
    },
    secondaryButtonLabel: {
      color: colors.textPrimary,
      fontWeight: "600",
      fontSize: 14,
    },
    infoCard: {
      marginTop: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      backgroundColor: colors.surfaceCard,
      padding: 14,
      gap: 8,
    },
    infoTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    infoText: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
  });

export default CompromisedWalletScreen;
