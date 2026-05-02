import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { getRecoveryRequestService } from "@/src/features/wallet/services/RecoveryRequestService";
import { RootStackParamList } from "@/src/types/navigation";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

const BackupRecoveryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const user = useUserStore((state) => state.user);
  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleGuardianRecoveryPress = useCallback(async () => {
    try {
      if (!user?.id) {
        navigation.navigate("RecoveryEntry");
        return;
      }

      const activeRequest = await getRecoveryRequestService().getLatestActiveRecoveryRequestForUser(
        user.id,
        smartAccountAddress,
      );
      if (activeRequest) {
        navigation.navigate("RecoveryProgress", { requestId: activeRequest.id });
        return;
      }

      const localPasskey = await PasskeyService.getPasskey(user.id);
      if (localPasskey?.credentialIdRaw) {
        navigation.navigate("GuardianRecovery");
        return;
      }

      navigation.navigate("RecoveryEntry");
    } catch {
      navigation.navigate("RecoveryEntry");
    }
  }, [navigation, smartAccountAddress, user?.id]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Backup & Recovery</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>LEVEL 1 DEVICE ACCESS</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => navigation.navigate("DevicesPasskeys")}
              activeOpacity={0.85}
            >
              <View style={styles.optionInfo}>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: withAlpha(colors.accentAlt, 0.15) },
                  ]}
                >
                  <Feather name="smartphone" size={20} color={colors.accentAlt} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Devices & Passkeys</Text>
                  <Text style={styles.optionDesc}>Add device, review pairings, schedule removals</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ONCHAIN RECOVERY</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => void handleGuardianRecoveryPress()}
              activeOpacity={0.85}
            >
              <View style={styles.optionInfo}>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: withAlpha(colors.accentAlt, 0.15) },
                  ]}
                >
                  <Feather name="shield" size={20} color={colors.accentAlt} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Guardian Recovery</Text>
                  <Text style={styles.optionDesc}>Start the on-chain guardian recovery flow</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>OFFCHAIN RECOVERY</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => navigation.navigate("EmailRecovery")}
              activeOpacity={0.85}
            >
              <View style={styles.optionInfo}>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: withAlpha(colors.accentAlt, 0.15) },
                  ]}
                >
                  <Feather name="mail" size={20} color={colors.accentAlt} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>Email Recovery</Text>
                  <Text style={styles.optionDesc}>Set up email-based guardians</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>COMPROMISE HANDOFF</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => navigation.navigate("CompromisedWallet")}
              activeOpacity={0.85}
            >
              <View style={styles.optionInfo}>
                <View
                  style={[
                    styles.iconBadge,
                    { backgroundColor: withAlpha(colors.warning, 0.18) },
                  ]}
                >
                  <Feather name="alert-triangle" size={20} color={colors.warning} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionLabel}>My wallet may be compromised</Text>
                  <Text style={styles.optionDesc}>Use guardian/email recovery guidance</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    section: {
      marginBottom: 28,
    },
    sectionHeader: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      marginBottom: 12,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      overflow: "hidden",
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 18,
    },
    optionInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      flex: 1,
    },
    iconBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.5),
    },
    optionText: {
      flex: 1,
    },
    optionLabel: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    optionDesc: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 3,
    },
  });

export default BackupRecoveryScreen;
