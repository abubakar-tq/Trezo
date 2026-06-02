import { NavigationProp, useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Address } from "viem";

import LocalSignerService from "@/src/features/wallet/services/LocalSignerService";
import { deviceCanManageGuardians } from "@/src/features/wallet/utils/guardianRecoveryTarget";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
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
  | { kind: "no_account" }
  | { kind: "no_passkey"; activeRequest: RecoveryRequest | null; hasLocalPasskey: boolean }
  | { kind: "has_passkey"; activeRequest: RecoveryRequest | null }
  | { kind: "has_active_request"; request: RecoveryRequest }
  | { kind: "error"; message: string };

type RecoveryEntryRoute = RouteProp<RootStackParamList, "RecoveryEntry">;

const RecoveryEntryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RecoveryEntryRoute>();
  const user = useUserStore((state) => state.user);
  const smartAccountDeployed = useUserStore((state) => state.smartAccountDeployed);
  const storedSmartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);
  const [state, setState] = useState<RecoveryEntryState>({ kind: "loading" });
  const reason = route.params?.reason;

  // Resolve the wallet identity exactly as GuardianRecoveryScreen does, so the
  // signer-authority check here agrees with the gate the destination enforces.
  const smartAccountAddress = useMemo<Address | null>(() => {
    const candidate = aaAccount?.predictedAddress ?? storedSmartAccountAddress ?? null;
    return candidate ? (candidate as Address) : null;
  }, [aaAccount?.predictedAddress, storedSmartAccountAddress]);
  const chainId = useMemo<SupportedChainId>(
    () => (aaAccount?.chainId ?? activeChainId ?? DEFAULT_CHAIN_ID) as SupportedChainId,
    [aaAccount?.chainId, activeChainId],
  );
  const expectedPasskeyId = aaAccount?.ownerAddress ?? null;

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
      setState({ kind: "no_passkey", activeRequest: null, hasLocalPasskey: false });
      return;
    }
    try {
      const latestActiveRequest = await withTimeout(
        getRecoveryRequestService().getLatestActiveRecoveryRequestForUser(user.id),
        4000,
      );

      if (latestActiveRequest) {
        setState({ kind: "has_active_request", request: latestActiveRequest });
        return;
      }

      // Discriminate has_passkey on the *on-chain signer authority* (the exact
      // precondition GuardianRecoveryScreen blocks on), not bare local-passkey
      // presence. A local-only / stale passkey otherwise lands on "Configure
      // Guardian Recovery" and then dead-ends at "This device cannot manage
      // guardians yet". The check is best-effort: if it cannot confirm authority,
      // we fall through to the recover/link path rather than offering guardian
      // config. See utils/guardianRecoveryTarget + LocalSignerService.
      let canManageGuardians = false;
      let hasLocalPasskey = false;
      try {
        const signerStatus = await withTimeout(
          LocalSignerService.getWalletSignerStatus({
            userId: user.id,
            smartAccountAddress,
            chainId,
            expectedPasskeyId,
          }),
          6000,
        );
        canManageGuardians = deviceCanManageGuardians(signerStatus);
        hasLocalPasskey = signerStatus.hasLocalPasskey;
      } catch {
        // Inconclusive (slow RPC / read error) — treat as cannot-manage so we
        // never route into the guardian-config dead-end on uncertain data.
      }

      if (canManageGuardians) {
        setState({ kind: "has_passkey", activeRequest: null });
      } else if (!smartAccountDeployed) {
        // No authoritative passkey and no deployed account — nothing to recover.
        setState({ kind: "no_account" });
      } else {
        setState({ kind: "no_passkey", activeRequest: null, hasLocalPasskey });
      }
    } catch (error) {
      console.warn("[RecoveryEntry] check failed:", error);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Couldn't check device.",
      });
    }
  }, [user?.id, smartAccountDeployed, smartAccountAddress, chainId, expectedPasskeyId]);

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
      ? "Checking your wallet..."
      : state.kind === "error"
      ? "Couldn't check this device"
      : state.kind === "no_account"
      ? "No account set up yet"
      : state.kind === "has_active_request"
      ? "A recovery request is already in progress."
      : state.kind === "has_passkey"
      ? "This device can manage your wallet."
      : reason === "user_initiated"
      ? "Recover your account"
      : "Add this device";

  const bodyText =
    state.kind === "error"
      ? state.message
      : state.kind === "no_account"
      ? "Your smart account isn't deployed yet, so there's no passkey to recover. Continue to finish setup."
      : state.kind === "has_active_request"
      ? "Resume your active request to view guardian approvals, per-chain status, and timelock progress."
      : state.kind === "has_passkey"
      ? "Configure guardian recovery so you can recover this wallet if you ever lose access to this device."
      : state.kind === "no_passkey" && state.hasLocalPasskey
      ? "This device's passkey can't sign for your wallet. Scan a pairing code from a device you use, or recover your account."
      : "Scan a pairing code from a device you already use, or recover with your guardians or email.";

  const renderActions = () => {
    switch (state.kind) {
      case "no_account":
        return (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.reset({ index: 0, routes: [{ name: "DeviceVerification" }] })}
          >
            <Text style={styles.primaryButtonText}>Continue Setup</Text>
          </TouchableOpacity>
        );
      case "has_active_request":
        return (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate("RecoveryProgress", { requestId: state.request.id })}
            >
              <Text style={styles.primaryButtonText}>Resume Recovery Progress</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate("CreateRecoveryRequest")}
            >
              <Text style={styles.secondaryButtonText}>Create New Request</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={() => navigation.navigate("LinkDevice")}
            >
              <Text style={styles.tertiaryButtonText}>I have another device</Text>
            </TouchableOpacity>
          </>
        );
      case "has_passkey":
        return (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate("GuardianRecovery")}
            >
              <Text style={styles.primaryButtonText}>Configure Guardian Recovery</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate("CreateRecoveryRequest")}
            >
              <Text style={styles.secondaryButtonText}>Create Recovery Request</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={() => navigation.navigate("LinkDevice")}
            >
              <Text style={styles.tertiaryButtonText}>I have another device</Text>
            </TouchableOpacity>
          </>
        );
      case "no_passkey":
        return (
          <>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate("LinkDevice")}
            >
              <Text style={styles.primaryButtonText}>Link a new passkey</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate("CreateRecoveryRequest")}
            >
              <Text style={styles.secondaryButtonText}>Recover with Guardians</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={() => navigation.navigate("EmailRecoveryStart")}
            >
              <Text style={styles.tertiaryButtonText}>Recover with Email</Text>
            </TouchableOpacity>
          </>
        );
      default:
        return null;
    }
  };

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
            <Text style={styles.loadingLabel}>Checking this device...</Text>
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
          renderActions()
        )}
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
      borderRadius: 24,
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
      fontWeight: "600",
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
      borderRadius: 16,
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
      borderRadius: 16,
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
      borderRadius: 16,
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
