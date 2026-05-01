import { Feather } from "@expo/vector-icons";
import { NavigationProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import { DEFAULT_CHAIN_ID } from "@/src/integration/chains";
import DevicePairingService, {
  type DevicePairingRequest,
  type WalletDevice,
} from "@/src/features/wallet/services/DevicePairingService";
import LocalSignerService from "@/src/features/wallet/services/LocalSignerService";
import { PasskeyAccountService } from "@/src/features/wallet/services/PasskeyAccountService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { SupabaseWalletService } from "@/src/features/wallet/services/SupabaseWalletService";
import WalletSyncService from "@/src/features/wallet/services/WalletSyncService";
import { CardSkeleton, EmptyState, Skeleton } from "@shared/components/ui";
import { RootStackParamList } from "@/src/types/navigation";
import { useWalletStore, type PasskeyInfo } from "@/src/features/wallet/store/useWalletStore";
import type { Address, Hex } from "viem";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import { withAlpha } from "@utils/color";

const statusTone = (status: string, colors: ThemeColors) => {
  if (status === "active") return colors.success;
  if (status === "pending_removal") return colors.warning;
  if (status === "removed") return colors.danger;
  return colors.textMuted;
};

const requestStatusLabel = (status: string) => {
  if (status === "created") return "Waiting for new device";
  if (status === "passkey_submitted") return "Ready for approval";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "expired") return "Expired";
  if (status === "failed") return "Failed";
  return status;
};

const DevicesPasskeysScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const user = useUserStore((state) => state.user);
  const walletFromStore = useUserStore((state) => state.smartAccountAddress);

  const [walletAddress, setWalletAddress] = useState<string | null>(walletFromStore);
  const [requests, setRequests] = useState<DevicePairingRequest[]>([]);
  const [devices, setDevices] = useState<WalletDevice[]>([]);
  const [currentPasskeyId, setCurrentPasskeyId] = useState<string | null>(null);
  const [activeLink, setActiveLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingLocalSigner, setCheckingLocalSigner] = useState(true);
  const [canSignForWallet, setCanSignForWallet] = useState(false);

  const { passkeys, setPasskeys, addPasskey, removePasskey, aaAccount, activeChainId } = useWalletStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const resolvedChainId = useMemo(() => 
    (aaAccount?.chainId || activeChainId || DEFAULT_CHAIN_ID), 
    [aaAccount?.chainId, activeChainId]
  );

  useEffect(() => {
    setWalletAddress(walletFromStore);
  }, [walletFromStore]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadSignerStatus = async () => {
        if (!user?.id) {
          if (active) {
            setCanSignForWallet(false);
            setCheckingLocalSigner(false);
          }
          return;
        }

        const signerStatus = await LocalSignerService.getWalletSignerStatus({
          userId: user.id,
          smartAccountAddress: (walletAddress ?? walletFromStore ?? null) as `0x${string}` | null,
          chainId: DEFAULT_CHAIN_ID,
        });

        if (active) {
          setCanSignForWallet(signerStatus.canSignForWallet);
          setCheckingLocalSigner(false);
        }
      };

      setCheckingLocalSigner(true);
      void loadSignerStatus();

      return () => {
        active = false;
      };
    }, [user?.id, walletAddress, walletFromStore]),
  );

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    let address = walletAddress;
    if (!address) {
      const hydratedWallet = await WalletSyncService.hydrateWalletForUser({
        userId: user.id,
        preferredChainId: DEFAULT_CHAIN_ID,
      }).catch(() => null);
      address = hydratedWallet?.predictedAddress ?? null;
      if (!address) {
        const walletService = new SupabaseWalletService();
        const wallet = await walletService.getAAWallet(user.id);
        address = wallet?.predicted_address ?? null;
      }
      setWalletAddress(address);
    }

    if (!address) {
      setRequests([]);
      setDevices([]);
      return;
    }

    const localPasskey = await PasskeyService.getPasskey(user.id);
    setCurrentPasskeyId(localPasskey?.credentialIdRaw ?? null);

    try {
      const cloudPasskeys = await PasskeyService.fetchCloudPasskeys(user.id);
      const formattedPasskeys: PasskeyInfo[] = cloudPasskeys.map((cp: any) => ({
        id: cp.credentialId,
        credentialId: cp.credentialId,
        idRaw: cp.credentialIdRaw as Hex,
        deviceName: cp.deviceName || "Unknown Device",
        deviceType: cp.deviceType || "Unknown",
        isOnChain: true,
        px: cp.publicKeyX as Hex,
        py: cp.publicKeyY as Hex,
        createdAt: cp.createdAt,
      }));
      const currentStorePasskeys = useWalletStore.getState().passkeys;
      const localOnly = currentStorePasskeys.filter(lp => !lp.isOnChain && !formattedPasskeys.find(fp => fp.id === lp.id));
      useWalletStore.getState().setPasskeys([...formattedPasskeys, ...localOnly]);
    } catch (error) {
      console.error("Failed to load passkeys:", error);
    }
    await DevicePairingService.ensureLocalDeviceSynced({
      userId: user.id,
      walletAddress: address,
      chainId: DEFAULT_CHAIN_ID,
    });
    await DevicePairingService.syncWalletDevicesFromChain({
      userId: user.id,
      walletAddress: address,
      chainId: DEFAULT_CHAIN_ID,
    });

    const [pendingRequests, walletDevices] = await Promise.all([
      DevicePairingService.listPendingApprovals(user.id),
      DevicePairingService.listWalletDevices({
        userId: user.id,
        walletAddress: address,
        chainId: DEFAULT_CHAIN_ID,
      }),
    ]);

    setRequests(pendingRequests);
    setDevices(walletDevices);
  }, [user?.id, walletAddress]);

  useFocusEffect(
    useCallback(() => {
      void loadData().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load devices");
      });
    }, [loadData]),
  );

  useEffect(() => {
    if (!user?.id) return;

    const timer = setInterval(() => {
      void loadData().catch(() => {});
    }, 5000);

    return () => clearInterval(timer);
  }, [loadData, user?.id]);

  const handleAddPasskey = async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not found. Please sign in again.");
      return;
    }

    try {
      setIsSubmitting(true);
      const metadata = await PasskeyService.createPasskey(user.id);
      
      await PasskeyAccountService.enqueuePendingPasskey(user.id, metadata);
      
      addPasskey({
        id: metadata.credentialId,
        credentialId: metadata.credentialId,
        idRaw: metadata.credentialIdRaw as Hex,
        deviceName: metadata.deviceName || "This Device",
        deviceType: metadata.deviceType || "Smartphone",
        isOnChain: false,
        px: metadata.publicKeyX as Hex,
        py: metadata.publicKeyY as Hex,
        createdAt: metadata.createdAt,
      });

      Alert.alert("Passkey Created", "A new passkey has been added locally. You can now sync it to the blockchain.");
    } catch (error) {
      if (error instanceof Error && error.message.includes("User cancelled")) return;
      console.error("Failed to create passkey:", error);
      Alert.alert("Error", "Failed to create passkey. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterOnChain = async (pk: PasskeyInfo) => {
    if (!user?.id || !walletAddress) {
      Alert.alert("Error", "Smart account not found.");
      return;
    }

    const signingPasskey = passkeys.find(p => p.isOnChain);
    if (!signingPasskey) {
      Alert.alert("Error", "No on-chain passkey found to sign this transaction. Please use your initial setup passkey.");
      return;
    }

    try {
      setProcessingId(pk.id);
      
      const { userOp, userOpHash } = await PasskeyAccountService.buildAddPasskeyUserOp({
        smartAccountAddress: walletAddress as Address,
        pendingPasskey: {
          idRaw: pk.idRaw!,
          credentialId: pk.id,
          px: pk.px!, 
          py: pk.py!,
          createdAt: pk.createdAt,
        },
        signingPasskeyId: signingPasskey.idRaw!,
        chainId: resolvedChainId as any,
        usePaymaster: true,
      });

      const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
      const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
      const signedUserOp = { ...userOp, signature: encodedSignature };

      await PasskeyAccountService.submitAddPasskeyUserOp(signedUserOp as any, resolvedChainId as any);

      if (aaAccount?.id) {
        await PasskeyService.syncPasskeyToCloud(user.id, {
          credentialId: pk.id,
          credentialIdRaw: pk.idRaw || "0x",
          publicKeyX: pk.px || "0x",
          publicKeyY: pk.py || "0x",
          deviceName: pk.deviceName,
          deviceType: (pk.deviceType as 'ios' | 'android') || 'ios',
          createdAt: pk.createdAt,
          rpId: "",
        });
      }

      removePasskey(pk.id);
      addPasskey({ ...pk, isOnChain: true });

      Alert.alert("Success", "Passkey registration submitted on-chain and synced to cloud!");
    } catch (error) {
      console.error("On-chain registration failed:", error);
      Alert.alert("Error", "Failed to register passkey on-chain.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemovePasskey = (pk: PasskeyInfo) => {
    Alert.alert(
      "Remove Passkey",
      pk.isOnChain 
        ? "This passkey is registered on-chain. Removing it locally won't remove it on-chain."
        : "Are you sure you want to remove this passkey from this device?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            try {
              removePasskey(pk.id);
              Alert.alert("Success", "Passkey removed.");
            } catch (error) {
              Alert.alert("Error", "Failed to remove passkey.");
            }
          }
        }
      ]
    );
  };

  const handleCreatePairing = useCallback(async () => {
    if (!user?.id || !walletAddress) {
      setError("Wallet address is required before creating a pairing request");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await DevicePairingService.createPairingRequest({
        userId: user.id,
        walletAddress,
        chainId: DEFAULT_CHAIN_ID,
      });
      setActiveLink(created.deepLink);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pairing request");
    } finally {
      setBusy(false);
    }
  }, [loadData, user?.id, walletAddress]);

  const signAndSubmit = useCallback(
    async (userOpHash: `0x${string}`, userOp: any) => {
      if (!user?.id) throw new Error("Missing user session");
      const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
      const encoded = PasskeyService.encodeSignatureForContract(signature) as `0x${string}`;
      return PasskeyAccountService.submitAddPasskeyUserOp({ ...userOp, signature: encoded });
    },
    [user?.id],
  );

  const handleApproveRequest = useCallback(
    async (request: DevicePairingRequest) => {
      if (!user?.id || !walletAddress) return;
      if (!request.new_passkey_id || !request.new_public_key_x || !request.new_public_key_y) {
        Alert.alert("Missing passkey payload", "The new device has not submitted passkey metadata yet.");
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const currentPasskey = await PasskeyService.getPasskey(user.id);
        if (!currentPasskey?.credentialIdRaw) {
          throw new Error("Current trusted passkey is required to approve pairing");
        }

        const built = await PasskeyAccountService.buildAddPasskeyUserOp({
          smartAccountAddress: walletAddress as `0x${string}`,
          pendingPasskey: {
            idRaw: request.new_passkey_id as `0x${string}`,
            credentialId: request.new_credential_id ?? request.new_passkey_id,
            px: request.new_public_key_x,
            py: request.new_public_key_y,
            deviceName: request.new_device_name ?? undefined,
            deviceType: (request.new_device_platform as "ios" | "android" | undefined) ?? undefined,
            createdAt: request.created_at,
          },
          signingPasskeyId: currentPasskey.credentialIdRaw as `0x${string}`,
          chainId: DEFAULT_CHAIN_ID,
          usePaymaster: true,
        });

        const submittedHash = await signAndSubmit(built.userOpHash, built.userOp);
        const receipt = await PasskeyAccountService.waitForReceipt(submittedHash, DEFAULT_CHAIN_ID);

        const success = Boolean((receipt as { success?: boolean }).success);
        if (!success) {
          await DevicePairingService.markFailed(request.id, user.id, "UserOperation reverted", submittedHash);
          throw new Error("addPasskey UserOperation reverted");
        }

        await DevicePairingService.markApprovedAfterReceipt({
          requestId: request.id,
          userId: user.id,
          operationHash: submittedHash,
          walletAddress,
          chainId: DEFAULT_CHAIN_ID,
          passkeyId: request.new_passkey_id,
          credentialId: request.new_credential_id,
          deviceName: request.new_device_name,
          platform: request.new_device_platform,
        });

        await loadData();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to approve pairing request";
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [loadData, signAndSubmit, user?.id, walletAddress],
  );

  const handleRejectRequest = useCallback(
    async (request: DevicePairingRequest) => {
      if (!user?.id) return;
      setBusy(true);
      setError(null);
      try {
        await DevicePairingService.markRejected(request.id, user.id);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reject pairing request");
      } finally {
        setBusy(false);
      }
    },
    [loadData, user?.id],
  );

  const submitRemovalAction = useCallback(
    async (device: WalletDevice) => {
      if (!user?.id || !walletAddress) return;
      const passkey = await PasskeyService.getPasskey(user.id);
      if (!passkey?.credentialIdRaw) {
        throw new Error("Current passkey is required to authorize this action");
      }

      const payload = {
        smartAccountAddress: walletAddress as `0x${string}`,
        passkeyIdToRemove: device.passkey_id as `0x${string}`,
        signingPasskeyId: passkey.credentialIdRaw as `0x${string}`,
        chainId: DEFAULT_CHAIN_ID,
        usePaymaster: true,
      };

      const built = await PasskeyAccountService.buildRemovePasskeyUserOp(payload);

      const signature = await PasskeyService.signWithPasskey(user.id, built.userOpHash);
      const encoded = PasskeyService.encodeSignatureForContract(signature) as `0x${string}`;
      const submittedHash = await PasskeyAccountService.submitAddPasskeyUserOp(
        { ...built.userOp, signature: encoded },
        DEFAULT_CHAIN_ID,
      );
      const receipt = await PasskeyAccountService.waitForReceipt(submittedHash, DEFAULT_CHAIN_ID);
      const success = Boolean((receipt as { success?: boolean }).success);
      if (!success) {
        throw new Error("Passkey removal operation reverted");
      }
      await DevicePairingService.syncWalletDevicesFromChain({
        userId: user.id,
        walletAddress,
        chainId: DEFAULT_CHAIN_ID,
      });
    },
    [user?.id, walletAddress],
  );

  const handleRemoveDevice = useCallback(
    async (device: WalletDevice) => {
      if (devices.filter((item) => item.status === "active").length <= 1) {
        Alert.alert("Cannot remove last passkey", "At least one active passkey must stay on-chain.");
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await submitRemovalAction(device);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove device");
      } finally {
        setBusy(false);
      }
    },
    [devices, loadData, submitRemovalAction],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Devices & Passkeys</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {(checkingLocalSigner || !canSignForWallet) ? (
          <View style={{ gap: 14 }}>
            {checkingLocalSigner ? (
              <CardSkeleton height={160} />
            ) : (
              <EmptyState
                icon="shield-off"
                title="Authorization Required"
                description="This device is not yet registered to authorize security changes. Use a trusted device to approve this pairing, or use recovery if you lost your primary device."
                actionLabel="Open recovery options"
                onAction={() => navigation.navigate("RecoveryEntry")}
                style={{ backgroundColor: withAlpha(theme.colors.surfaceCard, 0.8) }}
              />
            )}
          </View>
        ) : (
          <>
        <TouchableOpacity
          style={[styles.primaryButton, busy && styles.disabledButton]}
          onPress={handleCreatePairing}
          disabled={busy || !walletAddress}
          activeOpacity={0.9}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonLabel}>Add device</Text>}
        </TouchableOpacity>

        {activeLink && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scan on new device</Text>
            <View style={styles.qrWrap}>
              <QRCode value={activeLink} size={180} />
            </View>
            <Text style={styles.linkHelp}>
              Open this QR or link on the new device. If that device is logged out, Trezo now jumps straight to sign-in and resumes pairing after authentication.
            </Text>
            <Text style={styles.linkText} selectable>
              {activeLink}
            </Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pending pairing requests</Text>
          {requests.length === 0 ? (
            <Text style={styles.muted}>No pending requests.</Text>
          ) : (
            requests.map((request) => (
              <View key={request.id} style={styles.requestRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceTitle}>{request.new_device_name ?? "New device"}</Text>
                  <Text style={styles.muted}>{requestStatusLabel(request.status)}</Text>
                </View>
                {request.status === "passkey_submitted" ? (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.approveButton]}
                      onPress={() => void handleApproveRequest(request)}
                    >
                      <Text style={styles.actionLabel}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.rejectButton]}
                      onPress={() => void handleRejectRequest(request)}
                    >
                      <Text style={styles.actionLabel}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>My Passkeys</Text>
            <TouchableOpacity onPress={handleAddPasskey} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator size="small" /> : <Feather name="plus-circle" size={24} color={theme.colors.accentAlt} />}
            </TouchableOpacity>
          </View>
          {passkeys.length === 0 ? (
            <Text style={styles.muted}>No passkeys set up yet.</Text>
          ) : (
            passkeys.map(pk => (
              <View key={pk.id} style={styles.deviceRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.deviceTitle}>{pk.deviceName}</Text>
                  <Text style={styles.muted}>
                    {pk.isOnChain ? "Synced to Trezo Network" : "Local Passkey (Not Synced)"}
                  </Text>
                </View>
                <View style={styles.actionsRow}>
                  {!pk.isOnChain && (
                    <TouchableOpacity 
                      onPress={() => handleRegisterOnChain(pk)}
                      disabled={processingId === pk.id}
                      style={[styles.actionButton, processingId === pk.id && styles.disabledButton]}
                    >
                      <Feather name="upload-cloud" size={16} color={theme.colors.textPrimary} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleRemovePasskey(pk)} style={styles.actionButton}>
                    <Feather name="trash-2" size={16} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Wallet devices</Text>
          {devices.length === 0 ? (
            <Text style={styles.muted}>No synced devices yet.</Text>
          ) : (
            devices.map((device) => (
              <View key={device.id} style={styles.deviceRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.deviceTitleRow}>
                    <Text style={styles.deviceTitle}>{device.device_name ?? "Unnamed device"}</Text>
                    {currentPasskeyId && device.passkey_id === currentPasskeyId ? (
                      <Text style={styles.thisDeviceBadge}>This device</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.badge, { color: statusTone(device.status, theme.colors) }]}>{device.status}</Text>
                  <Text style={styles.muted}>
                    {device.platform ? `${device.platform.toUpperCase()} • ` : ""}
                    {device.passkey_id.slice(0, 12)}...
                  </Text>
                  {device.status === "pending_removal" && device.removal_execute_after ? (
                    <Text style={styles.mutedStrong}>
                      Removal executes after {new Date(device.removal_execute_after).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
                {device.status === "active" ? (
                  <TouchableOpacity style={styles.actionButton} onPress={() => void handleRemoveDevice(device)}>
                    <Text style={styles.actionLabel}>Remove device</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <Text style={styles.footnote}>
          TODO Level 2/3: Compromised-wallet reset stays guardian/email-based and should not be passkey-only.
        </Text>
          </>
        )}
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
    scroll: {
      flex: 1,
    },
    content: {
      padding: 20,
      gap: 14,
      paddingBottom: 40,
    },
    primaryButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonLabel: {
      color: "#fff",
      fontWeight: "700",
      fontSize: 15,
    },
    disabledButton: {
      opacity: 0.7,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 14,
      gap: 12,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    qrWrap: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
      backgroundColor: "#fff",
      borderRadius: 10,
      alignSelf: "center",
      paddingHorizontal: 6,
    },
    linkText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    linkHelp: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
    requestRow: {
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.4),
      paddingTop: 10,
      gap: 8,
    },
    deviceRow: {
      borderTopWidth: 1,
      borderTopColor: withAlpha(colors.border, 0.4),
      paddingTop: 10,
      gap: 8,
    },
    deviceTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    deviceTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    thisDeviceBadge: {
      color: colors.accentAlt,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    muted: {
      color: colors.textMuted,
      fontSize: 12,
    },
    mutedStrong: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    badge: {
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      marginTop: 2,
    },
    actionsRow: {
      flexDirection: "row",
      gap: 8,
      flexWrap: "wrap",
    },
    actionButton: {
      backgroundColor: withAlpha(colors.accentAlt, 0.15),
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    approveButton: {
      backgroundColor: withAlpha(colors.success, 0.18),
    },
    rejectButton: {
      backgroundColor: withAlpha(colors.danger, 0.18),
    },
    actionLabel: {
      color: colors.textPrimary,
      fontSize: 12,
      fontWeight: "600",
    },
    error: {
      color: colors.danger,
      fontSize: 13,
    },
    footnote: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
    },
  });

export default DevicesPasskeysScreen;
