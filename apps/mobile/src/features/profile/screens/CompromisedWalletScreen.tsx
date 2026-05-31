import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { RootStackParamList } from "@/src/types/navigation";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";

const STEPS = [
  "Your guardians approve the recovery",
  "A safety delay applies",
  "Your wallet gets a new key",
];

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
        <Text style={styles.headerTitle}>Secure your wallet</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Feather name="alert-octagon" size={48} color={theme.colors.danger} />
        </View>

        <Text style={styles.reassurance}>
          Recovery options are available — your funds are safe until you act.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => void handleGuardianStart()}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonLabel}>Start recovery now</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("BackupRecovery")}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonLabel}>Review my recovery setup</Text>
        </TouchableOpacity>

        <View style={styles.stepsCard}>
          <Text style={styles.stepsTitle}>What happens</Text>
          {STEPS.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNumberWrap}>
                <Text style={styles.stepNumber}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
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
    iconWrap: {
      alignItems: "center",
      paddingVertical: 24,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "700",
      lineHeight: 30,
      textAlign: "center",
    },
    reassurance: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: 8,
    },
    primaryButton: {
      marginTop: 12,
      backgroundColor: colors.danger,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
    },
    primaryButtonLabel: {
      color: colors.textOnAccent,
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
    stepsCard: {
      marginTop: 8,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      backgroundColor: colors.surfaceCard,
      padding: 16,
      gap: 12,
    },
    stepsTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 4,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    stepNumberWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    stepNumber: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: "700",
    },
    stepText: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
  });

export default CompromisedWalletScreen;
