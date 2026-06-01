import { Feather } from "@expo/vector-icons";
import { CommonActions, NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import DevicePairingService, {
  type DevicePairingRequest,
  type PairingDeepLinkParams,
} from "@/src/features/wallet/services/DevicePairingService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import WalletSyncService from "@/src/features/wallet/services/WalletSyncService";
import type { SupportedChainId } from "@/src/integration/chains";
import { RootStackParamList } from "@/src/types/navigation";
import { navigate } from "@app/navigation/navigationRef";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";

const statusLabel = (status: string) => {
  if (status === "created") return "Waiting for passkey creation";
  if (status === "passkey_submitted") return "Waiting for old device approval";
  if (status === "approved") return "Approved on-chain";
  if (status === "rejected") return "Rejected";
  if (status === "expired") return "Expired";
  if (status === "failed") return "Failed";
  return status;
};

const TERMINAL_STATUSES: ReadonlyArray<string> = ["approved", "rejected", "expired", "failed"];

type PairDeviceRoute = RouteProp<RootStackParamList, "PairDevice">;

const PairDeviceScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<PairDeviceRoute>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const user = useUserStore((state) => state.user);
  const [linkParams, setLinkParams] = useState<PairingDeepLinkParams | null>(
    route.params?.requestId && route.params?.secret
      ? {
          requestId: route.params.requestId,
          secret: route.params.secret,
        }
      : null,
  );
  const [request, setRequest] = useState<DevicePairingRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [approvedRequestHydrated, setApprovedRequestHydrated] = useState<string | null>(null);
  const [hydrating, setHydrating] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [hydrationComplete, setHydrationComplete] = useState(false);

  const loadRequest = useCallback(
    async (params: PairingDeepLinkParams) => {
      if (!user?.id) return;
      const fetched = await DevicePairingService.getPairingRequestForUser({
        requestId: params.requestId,
        secret: params.secret,
        userId: user.id,
      });
      setRequest(fetched);
    },
    [user?.id],
  );

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (linkParams || !user?.id) return;
      const pending = await DevicePairingService.consumePendingDeepLink();
      if (!pending || cancelled) return;
      setLinkParams(pending);
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [linkParams, user?.id]);

  useEffect(() => {
    if (!linkParams || !user?.id) return;
    setError(null);
    void loadRequest(linkParams).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Unable to load pairing request");
    });
  }, [linkParams, loadRequest, user?.id]);

  useEffect(() => {
    if (!linkParams || !user?.id) return;
    // Don't keep polling after the request reaches a terminal state — the
    // status can no longer change from the new device's perspective.
    if (request && TERMINAL_STATUSES.includes(request.status)) return;

    const timer = setInterval(() => {
      void loadRequest(linkParams).catch(() => {});
    }, 4000);

    return () => clearInterval(timer);
  }, [linkParams, loadRequest, request, user?.id]);

  const runHydration = useCallback(async () => {
    if (!user?.id || !request || request.status !== "approved") return;
    setHydrating(true);
    setHydrationError(null);
    try {
      await WalletSyncService.hydrateWalletForUser({
        userId: user.id,
        preferredChainId: request.chain_id as SupportedChainId,
      });
      await DevicePairingService.ensureLocalDeviceSynced({
        userId: user.id,
        walletAddress: request.wallet_address,
        chainId: request.chain_id,
      });
      setHydrationComplete(true);
    } catch (syncError) {
      console.warn("[PairDevice] Failed to hydrate wallet after approval", syncError);
      setHydrationError(
        syncError instanceof Error
          ? syncError.message
          : "Could not sync your wallet on this device. Tap retry to try again.",
      );
    } finally {
      setHydrating(false);
    }
  }, [request, user?.id]);

  useEffect(() => {
    if (!user?.id || !request || request.status !== "approved") return;
    if (approvedRequestHydrated === request.id) return;
    setApprovedRequestHydrated(request.id);
    void runHydration();
  }, [approvedRequestHydrated, request, runHydration, user?.id]);

  const handleOpenWallet = useCallback(() => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: "TabNavigation" }] }),
    );
  }, [navigation]);

  const handleCreateAndSubmitPasskey = useCallback(async () => {
    if (!user?.id || !linkParams) return;
    if (!request) {
      setError("Pairing request is still loading. Please try again.");
      return;
    }
    if (request.status === "approved") return;
    if (request.status !== "created" && request.status !== "passkey_submitted") {
      setError(`Pairing request is ${request.status} and cannot accept a new passkey.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // New device pairing: create this device's passkey if it has none, otherwise
      // reuse the existing one. Never overwrite — that would change the AA address.
      const metadata = await PasskeyService.getOrCreatePasskey(user.id);
      const updated = await DevicePairingService.submitNewDevicePasskey({
        requestId: linkParams.requestId,
        secret: linkParams.secret,
        userId: user.id,
        passkeyId: metadata.credentialIdRaw,
        credentialId: metadata.credentialId,
        publicKeyX: metadata.publicKeyX,
        publicKeyY: metadata.publicKeyY,
        deviceName: metadata.deviceName,
        platform: metadata.deviceType,
      });
      setRequest(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create and submit passkey");
    } finally {
      setBusy(false);
    }
  }, [linkParams, request, user?.id]);

  const canCreatePasskey =
    Boolean(request) && request?.status === "created";

  const needsLogin = !user?.id;

  const primaryActionLabel = !request
    ? "Loading pairing request..."
    : request.status === "created"
      ? "Create passkey and send approval request"
      : request.status === "passkey_submitted"
        ? "Waiting for approval on trusted device"
        : request.status === "approved"
          ? "Pairing complete"
          : `Request ${statusLabel(request.status).toLowerCase()}`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBackBtn, { backgroundColor: theme.colors.glass, borderColor: theme.colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={18} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerKicker}>SECURITY</Text>
          <Text style={styles.headerTitle}>Pair New Device</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {needsLogin ? (
          <>
            <Text style={styles.title}>Sign in to continue</Text>
            <Text style={styles.subtitle}>
              Use the same Trezo account as the trusted device. After sign-in, this pairing request will resume automatically.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigate("Login", { pairingMode: "resume" })}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonLabel}>Open sign-in</Text>
            </TouchableOpacity>
          </>
        ) : !linkParams ? (
          <>
            <Text style={styles.title}>No pairing link found</Text>
            <Text style={styles.subtitle}>Scan the pairing QR code shown on a device you already use to add this one. You can also go back with the arrow above.</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate("LinkDevice")}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryButtonLabel}>Scan pairing QR</Text>
            </TouchableOpacity>
          </>
        ) : request?.status === "approved" ? (
          <>
            <View style={styles.successBadge}>
              <Feather name="check" size={28} color={theme.colors.success} />
            </View>
            <Text style={styles.title}>Device paired successfully</Text>
            <Text style={styles.subtitle}>
              {hydrationComplete
                ? "Your wallet is ready on this device. You can now sign on-chain actions from here."
                : hydrating
                  ? "Syncing your wallet from chain — this only takes a moment."
                  : hydrationError
                    ? "Pairing succeeded on-chain but your local wallet state didn't sync. Tap retry below."
                    : "Finishing setup on this device…"}
            </Text>
            {hydrationError && (
              <Text style={styles.errorText}>{hydrationError}</Text>
            )}
            {hydrationError ? (
              <TouchableOpacity
                style={[styles.primaryButton, hydrating && styles.disabledButton]}
                onPress={() => void runHydration()}
                disabled={hydrating}
                activeOpacity={0.9}
              >
                {hydrating ? (
                  <ActivityIndicator color={theme.colors.textOnAccent} />
                ) : (
                  <Text style={styles.primaryButtonLabel}>Retry sync</Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryButton, (hydrating || !hydrationComplete) && styles.disabledButton]}
                onPress={handleOpenWallet}
                disabled={hydrating || !hydrationComplete}
                activeOpacity={0.9}
              >
                {hydrating || !hydrationComplete ? (
                  <ActivityIndicator color={theme.colors.textOnAccent} />
                ) : (
                  <Text style={styles.primaryButtonLabel}>Open wallet</Text>
                )}
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <Text style={styles.title}>Add this device with your trusted device</Text>
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>How pairing works</Text>
              <Text style={styles.introBody}>
                This device becomes active only after the trusted device approves the request and the on-chain add-passkey transaction confirms.
              </Text>
            </View>

            {request && (
              <View style={styles.statusCard}>
                <Text style={styles.statusLabel}>Status</Text>
                <Text style={styles.statusValue}>{statusLabel(request.status)}</Text>
                <Text style={styles.meta}>Request ID: {request.id.slice(0, 12)}...</Text>
                <Text style={styles.meta}>Expires: {new Date(request.expires_at).toLocaleString()}</Text>
              </View>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Before you continue</Text>
              <Text style={styles.noteBody}>
                Real passkeys should be created on a physical device in a native build. Emulator biometric fallback is only suitable for local UI testing.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, busy && styles.disabledButton]}
              onPress={handleCreateAndSubmitPasskey}
              disabled={busy || !canCreatePasskey}
              activeOpacity={0.9}
            >
              {busy ? (
                <ActivityIndicator color={theme.colors.textOnAccent} />
              ) : (
                <Text style={styles.primaryButtonLabel}>{primaryActionLabel}</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.note}>
              If you no longer control a trusted device, use guardian or email recovery instead of Level 1 pairing.
            </Text>
          </>
        )}
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
      paddingBottom: 18,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    headerBackBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    headerTitleBlock: {
      alignItems: "center",
    },
    headerKicker: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.8,
      color: colors.textMuted,
      marginBottom: 2,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: -0.3,
    },
    body: {
      flex: 1,
      padding: 20,
      gap: 14,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 28,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    introCard: {
      backgroundColor: `${colors.accentAlt}1F`,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${colors.accentAlt}3D`,
      padding: 14,
      gap: 6,
    },
    introTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    introBody: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    statusCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 14,
      gap: 6,
    },
    noteCard: {
      backgroundColor: `${colors.warning}1F`,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: `${colors.warning}47`,
      padding: 14,
      gap: 6,
    },
    noteTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    noteBody: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    statusLabel: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
      fontWeight: "700",
      letterSpacing: 0.8,
    },
    statusValue: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    meta: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    primaryButton: {
      marginTop: 10,
      backgroundColor: colors.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledButton: {
      opacity: 0.6,
    },
    primaryButtonLabel: {
      color: colors.textOnAccent,
      fontWeight: "700",
      fontSize: 14,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
    },
    note: {
      color: `${colors.textMuted}D9`,
      fontSize: 12,
      lineHeight: 18,
    },
    successBadge: {
      alignSelf: "center",
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: `${colors.success}1F`,
      borderWidth: 1,
      borderColor: `${colors.success}66`,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
  });

export default PairDeviceScreen;
