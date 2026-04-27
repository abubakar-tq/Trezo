import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";

const CompromisedWalletScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

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
        <Text style={styles.title}>Normal passkey removal is not enough for compromise</Text>
        <Text style={styles.text}>
          If one of your devices or passkeys is compromised, use guardian/email recovery to reset access.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("GuardianRecovery")}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonLabel}>Set up guardians</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate("EmailRecovery")}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonLabel}>Set up email recovery</Text>
        </TouchableOpacity>

        <View style={styles.placeholderAction}>
          <Text style={styles.placeholderLabel}>Emergency reset coming in Level 2 + Level 3</Text>
        </View>

        <Text style={styles.todo}>
          TODO Level 2 guardian flow: submit permissionless guardian approvals and timelocked execution.
        </Text>
        <Text style={styles.todo}>
          TODO Level 3 zk-email flow: integrate zk-email guardian proof execution path.
        </Text>
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
    placeholderAction: {
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      opacity: 0.7,
    },
    placeholderLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    todo: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
  });

export default CompromisedWalletScreen;
