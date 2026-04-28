import { Feather } from "@expo/vector-icons";
import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
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
import { withAlpha } from "@utils/color";

const statusLabel = (status: string) => {
  if (status === "created") return "Waiting for passkey creation";
  if (status === "passkey_submitted") return "Waiting for old device approval";
  if (status === "approved") return "Approved on-chain";
  if (status === "rejected") return "Rejected";
  if (status === "expired") return "Expired";
  if (status === "failed") return "Failed";
  return status;
};

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

    const timer = setInterval(() => {
      void loadRequest(linkParams).catch(() => {});
    }, 4000);

    return () => clearInterval(timer);
  }, [linkParams, loadRequest, user?.id]);

  useEffect(() => {
    if (!user?.id || !request || request.status !== "approved") {
      return;
    }
    if (approvedRequestHydrated === request.id) {
      return;
    }

    setApprovedRequestHydrated(request.id);
    void (async () => {
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
      } catch (syncError) {
        console.warn("[PairDevice] Failed to hydrate wallet after approval", syncError);
      }
    })();
  }, [approvedRequestHydrated, request, user?.id]);

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
      const metadata = await PasskeyService.createPasskey(user.id);
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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pair New Device</Text>
        <View style={{ width: 24 }} />
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
            <Text style={styles.subtitle}>Open a pairing deep link from your trusted device QR code.</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Add this device with your trusted device</Text>
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>How pairing works</Text>
              <Text style={styles.introBody}>
                This device becomes active only after the trusted device approves the request and the on-chain `addPasskey` transaction confirms.
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
                <ActivityIndicator color="#fff" />
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
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
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
      backgroundColor: withAlpha(colors.accentAlt, 0.12),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.24),
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
      backgroundColor: withAlpha(colors.warning, 0.12),
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.warning, 0.28),
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
      backgroundColor: colors.accentAlt,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledButton: {
      opacity: 0.6,
    },
    primaryButtonLabel: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 14,
    },
    errorText: {
      color: colors.danger,
      fontSize: 13,
    },
    note: {
      color: withAlpha(colors.textMuted, 0.85),
      fontSize: 12,
      lineHeight: 18,
    },
  });

export default PairDeviceScreen;
