import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { RootStackParamList } from "@/src/types/navigation";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import {
  getRecoveryRequestService,
  type RecoveryRequest,
} from "@/src/features/wallet/services/RecoveryRequestService";

const RecoveryEntryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const user = useUserStore((state) => state.user);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [isChecking, setIsChecking] = useState(true);
  const [hasLocalPasskey, setHasLocalPasskey] = useState(false);
  const [activeRequest, setActiveRequest] = useState<RecoveryRequest | null>(null);

  const activeRequestTimeLabel = useMemo(() => {
    if (!activeRequest?.deadline) {
      return null;
    }
    const deadlineDate = new Date(activeRequest.deadline);
    const remainingMs = deadlineDate.getTime() - Date.now();
    if (!Number.isFinite(remainingMs)) {
      return null;
    }
    if (remainingMs <= 0) {
      return `Expired at ${deadlineDate.toLocaleString()}`;
    }

    const minutes = Math.floor(remainingMs / 60000);
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    return `Expires in ${days}d ${hours}h ${mins}m`;
  }, [activeRequest?.deadline]);

  useEffect(() => {
    let mounted = true;
    const checkState = async () => {
      if (!user?.id) {
        if (mounted) {
          setHasLocalPasskey(false);
          setActiveRequest(null);
          setIsChecking(false);
        }
        return;
      }

      try {
        const [passkey, latestActiveRequest] = await Promise.all([
          PasskeyService.getPasskey(user.id),
          getRecoveryRequestService().getLatestActiveRecoveryRequestForUser(user.id),
        ]);

        if (!mounted) return;

        setActiveRequest(latestActiveRequest);
        setHasLocalPasskey(Boolean(passkey?.credentialIdRaw));
      } catch (error) {
        console.warn("[RecoveryEntry] Failed to check recovery state:", error);
        if (mounted) {
          setActiveRequest(null);
          setHasLocalPasskey(false);
        }
      } finally {
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    void checkState();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Recovery</Text>
        <Text style={styles.title}>
          {isChecking
            ? "Checking device passkey status..."
            : activeRequest
              ? "A recovery request is already in progress."
            : hasLocalPasskey
              ? "A usable passkey is available on this device."
              : "No usable passkey was found on this device."}
        </Text>
        <Text style={styles.body}>
          {activeRequest
            ? "Resume your active request to view guardian approvals, per-chain status, and timelock progress."
            : hasLocalPasskey
            ? "Configure guardian recovery first. If this device is compromised, you can still create a guardian recovery request."
            : "Start a guardian recovery request, or switch to device pairing if you still have another trusted device."}
        </Text>

        {activeRequest ? (
          <View style={styles.activeRequestCard}>
            <Text style={styles.activeRequestLabel}>Active request</Text>
            <Text style={styles.activeRequestValue} numberOfLines={1}>
              {activeRequest.id}
            </Text>
            <Text style={styles.activeRequestMeta}>Status: {activeRequest.status}</Text>
            {activeRequestTimeLabel ? (
              <Text style={styles.activeRequestMeta}>{activeRequestTimeLabel}</Text>
            ) : null}
          </View>
        ) : null}

        {isChecking ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.loadingLabel}>Checking local passkey...</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              activeRequest
                ? navigation.navigate("RecoveryProgress", { requestId: activeRequest.id })
                : navigation.navigate(hasLocalPasskey ? "GuardianRecovery" : "CreateRecoveryRequest")
            }
          >
            <Text style={styles.primaryButtonText}>
              {activeRequest
                ? "Resume Recovery Progress"
                : hasLocalPasskey
                  ? "Configure Guardian Recovery"
                  : "Recover with Guardians"}
            </Text>
          </TouchableOpacity>
        )}

        {activeRequest ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("CreateRecoveryRequest")}
          >
            <Text style={styles.secondaryButtonText}>Create New Request</Text>
          </TouchableOpacity>
        ) : hasLocalPasskey ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("CreateRecoveryRequest")}
          >
            <Text style={styles.secondaryButtonText}>Create Recovery Request</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("EmailRecovery")}
          >
            <Text style={styles.secondaryButtonText}>Recover with Email</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.tertiaryButton}
          onPress={() => navigation.navigate("PairDevice")}
        >
          <Text style={styles.tertiaryButtonText}>I have another device</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 24,
      backgroundColor: colors.background,
      justifyContent: "center",
    },
    card: {
      borderRadius: 28,
      padding: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    kicker: {
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 2,
      fontSize: 12,
      fontWeight: "700",
    },
    title: {
      color: colors.text,
      fontSize: 28,
      fontWeight: "800",
      lineHeight: 34,
    },
    body: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 6,
    },
    loadingLabel: {
      color: colors.textMuted,
      fontSize: 14,
    },
    primaryButton: {
      paddingVertical: 16,
      borderRadius: 18,
      backgroundColor: colors.accent,
      alignItems: "center",
    },
    primaryButtonText: {
      color: colors.textOnAccent,
      fontWeight: "700",
      fontSize: 16,
    },
    secondaryButton: {
      paddingVertical: 16,
      borderRadius: 18,
      backgroundColor: colors.surfaceMuted,
      alignItems: "center",
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
    activeRequestCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 4,
    },
    activeRequestLabel: {
      color: colors.textMuted,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    activeRequestValue: {
      color: colors.text,
      fontSize: 13,
      fontWeight: "700",
    },
    activeRequestMeta: {
      color: colors.textMuted,
      fontSize: 13,
    },
    tertiaryButton: {
      paddingVertical: 16,
      borderRadius: 18,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    tertiaryButtonText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
  });

export default RecoveryEntryScreen;
