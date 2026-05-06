import { NavigationProp, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import type { RootStackParamList } from "@/src/types/navigation";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import {
  getRecoveryRequestService,
  type RecoveryRequest,
} from "@/src/features/wallet/services/RecoveryRequestService";

type RecoveryEntryState =
  | { kind: "loading" }
  | { kind: "no_passkey"; activeRequest: RecoveryRequest | null }
  | { kind: "has_passkey"; activeRequest: RecoveryRequest | null }
  | { kind: "has_active_request"; request: RecoveryRequest }
  | { kind: "error"; message: string };

type RecoveryEntryRoute = RouteProp<RootStackParamList, "RecoveryEntry">;

const RecoveryEntryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RecoveryEntryRoute>();
  const user = useUserStore((state) => state.user);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [state, setState] = useState<RecoveryEntryState>({ kind: "loading" });
  const reason = route.params?.reason;

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new Error("Timed out")), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  };

  const activeRequestTimeLabel = useMemo(() => {
    if (state.kind !== "has_active_request") {
      return null;
    }
    const request = state.request;
    if (!request?.deadline) {
      return null;
    }
    const deadlineDate = new Date(request.deadline);
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
  }, [state]);

  const runChecks = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      setState({ kind: "no_passkey", activeRequest: null });
      return;
    }
    try {
      const [passkey, latestActiveRequest] = await Promise.all([
        withTimeout(PasskeyService.getPasskey(user.id), 2500),
        withTimeout(getRecoveryRequestService().getLatestActiveRecoveryRequestForUser(user.id), 4000),
      ]);

      const hasLocalPasskey = Boolean(passkey?.credentialIdRaw);
      if (latestActiveRequest) {
        setState({ kind: "has_active_request", request: latestActiveRequest });
      } else if (hasLocalPasskey) {
        setState({ kind: "has_passkey", activeRequest: null });
      } else {
        setState({ kind: "no_passkey", activeRequest: null });
      }
    } catch (error) {
      console.warn("[RecoveryEntry] check failed:", error);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Couldn't check device.",
      });
    }
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    void (async () => {
      if (cancelled) return;
      await runChecks();
    })();
    return () => {
      cancelled = true;
    };
  }, [runChecks]);

  const titleText =
    state.kind === "loading"
      ? "Checking device passkey status..."
      : state.kind === "error"
      ? "Couldn't check this device"
      : state.kind === "has_active_request"
      ? "A recovery request is already in progress."
      : state.kind === "has_passkey"
      ? "A usable passkey is available on this device."
      : reason === "user_initiated"
      ? "Recover your account"
      : "We didn't find a passkey on this device.";

  const bodyText =
    state.kind === "error"
      ? state.message
      : state.kind === "has_active_request"
      ? "Resume your active request to view guardian approvals, per-chain status, and timelock progress."
      : state.kind === "has_passkey"
      ? "Configure guardian recovery first. If this device is compromised, you can still create a guardian recovery request."
      : "Start a guardian recovery request, or switch to device pairing if you still have another trusted device.";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Recovery</Text>
        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.body}>{bodyText}</Text>

        {state.kind === "has_active_request" ? (
          <View style={styles.activeRequestCard}>
            <Text style={styles.activeRequestLabel}>Active request</Text>
            <Text style={styles.activeRequestValue} numberOfLines={1}>
              {state.request.id}
            </Text>
            <Text style={styles.activeRequestMeta}>Status: {state.request.status}</Text>
            {activeRequestTimeLabel ? (
              <Text style={styles.activeRequestMeta}>{activeRequestTimeLabel}</Text>
            ) : null}
          </View>
        ) : null}

        {state.kind === "loading" ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.colors.accent} />
            <Text style={styles.loadingLabel}>Checking local passkey...</Text>
          </View>
        ) : state.kind === "error" ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              setState({ kind: "loading" });
              void runChecks();
            }}
          >
            <Text style={styles.primaryButtonText}>Retry</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              if (state.kind === "has_active_request") {
                navigation.navigate("RecoveryProgress", { requestId: state.request.id });
              } else {
                navigation.navigate(state.kind === "has_passkey" ? "GuardianRecovery" : "CreateRecoveryRequest");
              }
            }}
          >
            <Text style={styles.primaryButtonText}>
              {state.kind === "has_active_request"
                ? "Resume Recovery Progress"
                : state.kind === "has_passkey"
                ? "Configure Guardian Recovery"
                : "Recover with Guardians"}
            </Text>
          </TouchableOpacity>
        )}

        {state.kind === "has_active_request" ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("CreateRecoveryRequest")}
          >
            <Text style={styles.secondaryButtonText}>Create New Request</Text>
          </TouchableOpacity>
        ) : state.kind === "has_passkey" ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("CreateRecoveryRequest")}
          >
            <Text style={styles.secondaryButtonText}>Create Recovery Request</Text>
          </TouchableOpacity>
        ) : state.kind === "no_passkey" ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate("EmailRecovery")}
          >
            <Text style={styles.secondaryButtonText}>Recover with Email</Text>
          </TouchableOpacity>
        ) : null}

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
