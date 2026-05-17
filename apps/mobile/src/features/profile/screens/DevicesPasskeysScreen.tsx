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

import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import DevicePairingService, {
  type DevicePairingRequest,
  type WalletDevice,
} from "@/src/features/wallet/services/DevicePairingService";
import LocalSignerService from "@/src/features/wallet/services/LocalSignerService";
import { PasskeyAccountService } from "@/src/features/wallet/services/PasskeyAccountService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { SupabaseWalletService } from "@/src/features/wallet/services/SupabaseWalletService";
import WalletSyncService from "@/src/features/wallet/services/WalletSyncService";
import { CardSkeleton } from "@shared/components/ui";
import { RootStackParamList } from "@/src/types/navigation";
import { useWalletStore, type PasskeyInfo } from "@/src/features/wallet/store/useWalletStore";
import type { Address, Hex } from "viem";
import { useUserStore } from "@store/useUserStore";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";

const statusConfig = (status: string, colors: ThemeColors) => {
  if (status === "active") return { color: colors.success, bg: colors.successSoft, label: "Active" };
  if (status === "pending_removal") return { color: colors.warning, bg: colors.warningSoft, label: "Pending removal" };
  if (status === "removed") return { color: colors.danger, bg: colors.dangerSoft, label: "Removed" };
  return { color: colors.textMuted, bg: `${colors.textMuted}18`, label: status };
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

// Selectors come from keccak256 of the error signatures defined in
// contracts/src/modules/passkey/PasskeyValidator.sol. The bundler / paymaster
// surfaces these as the inner revert bytes when a UserOp simulation reverts.
const PASSKEY_VALIDATOR_ERRORS: Record<
  string,
  { friendly: string; autoRefresh: boolean }
> = {
  "0x84f7de53": {
    friendly: "Cannot remove the last passkey on this wallet. Add another device first.",
    autoRefresh: false,
  },
  "0xdcc10551": {
    friendly: "This passkey isn't registered on-chain — it may already be removed.",
    autoRefresh: true,
  },
  "0x61c9401a": {
    friendly: "A removal is already scheduled for this passkey — refreshing status.",
    autoRefresh: true,
  },
  "0x6ab276fc": {
    friendly: "No pending removal to act on for this passkey — refreshing status.",
    autoRefresh: true,
  },
  "0x00ed0147": {
    friendly: "The 1-day timelock hasn't elapsed yet — try again later.",
    autoRefresh: true,
  },
};

const decodePasskeyValidatorError = (
  err: unknown,
): { friendly: string; autoRefresh: boolean } | null => {
  const haystack = (err instanceof Error ? err.message : String(err)).toLowerCase();
  for (const [selector, info] of Object.entries(PASSKEY_VALIDATOR_ERRORS)) {
    if (haystack.includes(selector.slice(2))) return info;
  }
  return null;
};

const DevicesPasskeysScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  const { passkeys, addPasskey, removePasskey, aaAccount, activeChainId } = useWalletStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Tracks which device row currently has a removal/cancel/finalize in flight,
  // so we can render a spinner on that specific button instead of a global one.
  const [deviceActionId, setDeviceActionId] = useState<string | null>(null);

  const resolvedChainId = useMemo<SupportedChainId>(
    () => (aaAccount?.chainId || activeChainId || DEFAULT_CHAIN_ID) as SupportedChainId,
    [aaAccount?.chainId, activeChainId],
  );

  useEffect(() => {
    setWalletAddress(walletFromStore);
  }, [walletFromStore]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadSignerStatus = async () => {
        if (!user?.id) {
          if (active) { setCanSignForWallet(false); setCheckingLocalSigner(false); }
          return;
        }
        const signerStatus = await LocalSignerService.getWalletSignerStatus({
          userId: user.id,
          smartAccountAddress: (walletAddress ?? walletFromStore ?? null) as `0x${string}` | null,
          chainId: resolvedChainId,
        });
        if (active) { setCanSignForWallet(signerStatus.canSignForWallet); setCheckingLocalSigner(false); }
      };

      setCheckingLocalSigner(true);
      void loadSignerStatus();
      return () => { active = false; };
    }, [user?.id, walletAddress, walletFromStore, resolvedChainId]),
  );

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    let address = walletAddress;
    if (!address) {
      const hydratedWallet = await WalletSyncService.hydrateWalletForUser({
        userId: user.id,
        preferredChainId: resolvedChainId,
      }).catch(() => null);
      address = hydratedWallet?.predictedAddress ?? null;
      if (!address) {
        const walletService = new SupabaseWalletService();
        const wallet = await walletService.getAAWallet(user.id);
        address = wallet?.predicted_address ?? null;
      }
      setWalletAddress(address);
    }

    if (!address) { setRequests([]); setDevices([]); return; }

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
      const localOnly = currentStorePasskeys.filter(
        (lp) => !lp.isOnChain && !formattedPasskeys.find((fp) => fp.id === lp.id),
      );
      useWalletStore.getState().setPasskeys([...formattedPasskeys, ...localOnly]);
    } catch (err) {
      console.error("Failed to load passkeys:", err);
    }

    await DevicePairingService.ensureLocalDeviceSynced({ userId: user.id, walletAddress: address, chainId: resolvedChainId });
    await DevicePairingService.syncWalletDevicesFromChain({ userId: user.id, walletAddress: address, chainId: resolvedChainId });

    const [pendingRequests, walletDevices] = await Promise.all([
      DevicePairingService.listPendingApprovals(user.id),
      DevicePairingService.listWalletDevices({ userId: user.id, walletAddress: address, chainId: resolvedChainId }),
    ]);

    setRequests(pendingRequests);
    setDevices(walletDevices);
  }, [user?.id, walletAddress, resolvedChainId]);

  useFocusEffect(
    useCallback(() => {
      void loadData().catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load devices");
      });
    }, [loadData]),
  );

  useEffect(() => {
    if (!user?.id) return;
    const timer = setInterval(() => { void loadData().catch(() => {}); }, 5000);
    return () => clearInterval(timer);
  }, [loadData, user?.id]);

  const handleAddPasskey = async () => {
    if (!user?.id) { Alert.alert("Error", "User not found. Please sign in again."); return; }
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
    } catch (err) {
      if (err instanceof Error && err.message.includes("User cancelled")) return;
      console.error("Failed to create passkey:", err);
      Alert.alert("Error", "Failed to create passkey. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterOnChain = async (pk: PasskeyInfo) => {
    if (!user?.id || !walletAddress) { Alert.alert("Error", "Smart account not found."); return; }
    const signingPasskey = passkeys.find((p) => p.isOnChain);
    if (!signingPasskey) {
      Alert.alert("Error", "No on-chain passkey found to sign this transaction.");
      return;
    }
    try {
      setProcessingId(pk.id);
      const { userOp, userOpHash } = await PasskeyAccountService.buildAddPasskeyUserOp({
        smartAccountAddress: walletAddress as Address,
        pendingPasskey: { idRaw: pk.idRaw!, credentialId: pk.id, px: pk.px!, py: pk.py!, createdAt: pk.createdAt },
        signingPasskeyId: signingPasskey.idRaw!,
        chainId: resolvedChainId as any,
        usePaymaster: true,
      });
      const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
      const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
      await PasskeyAccountService.submitAddPasskeyUserOp({ ...userOp, signature: encodedSignature } as any, resolvedChainId as any);
      if (aaAccount?.id) {
        await PasskeyService.syncPasskeyToCloud(user.id, aaAccount.id, {
          credentialId: pk.id,
          credentialIdRaw: pk.idRaw || "0x",
          publicKeyX: pk.px || "0x",
          publicKeyY: pk.py || "0x",
          deviceName: pk.deviceName,
          deviceType: (pk.deviceType as "ios" | "android") || "ios",
          createdAt: pk.createdAt,
          rpId: "",
        });
      }
      removePasskey(pk.id);
      addPasskey({ ...pk, isOnChain: true });
      Alert.alert("Success", "Passkey registered on-chain and synced to cloud.");
    } catch (err) {
      console.error("On-chain registration failed:", err);
      Alert.alert("Error", "Failed to register passkey on-chain.");
    } finally {
      setProcessingId(null);
    }
  };

  const removeLocalPasskeyArtifacts = useCallback(
    async (pk: PasskeyInfo) => {
      if (!user?.id) return;
      removePasskey(pk.id);
      if (pk.idRaw) {
        await PasskeyAccountService.removePendingPasskey(user.id, pk.idRaw).catch(() => {});
      }
      // If this entry happens to be the device's stored credential metadata, scrub it
      // so the app does not keep referencing a passkey the user thinks they deleted.
      if (pk.idRaw && currentPasskeyId && pk.idRaw === currentPasskeyId) {
        await PasskeyService.deletePasskey(user.id).catch(() => {});
        setCurrentPasskeyId(null);
      }
    },
    [currentPasskeyId, removePasskey, user?.id],
  );

  const handleRemovePasskey = (pk: PasskeyInfo) => {
    if (pk.isOnChain) {
      const matchingDevice = devices.find((d) => d.passkey_id === pk.idRaw);
      if (matchingDevice?.status === "pending_removal") {
        Alert.alert(
          "Removal already scheduled",
          matchingDevice.removal_execute_after
            ? `On-chain removal is already scheduled and finalizes after ${new Date(matchingDevice.removal_execute_after).toLocaleString()}. Use the actions in Wallet Devices to cancel or finalize.`
            : "On-chain removal is already scheduled for this passkey. Use the actions in Wallet Devices to cancel or finalize.",
        );
        return;
      }
      const activeOnChain = devices.filter((d) => d.status === "active").length;
      if (activeOnChain <= 1) {
        Alert.alert(
          "Cannot remove last passkey",
          "At least one active passkey must remain on-chain. Add another device first, then remove this one.",
        );
        return;
      }
      Alert.alert(
        "Remove Passkey",
        "This passkey is registered on-chain. We'll schedule an on-chain removal — after a 1-day timelock you can finalize it, which will permanently revoke this passkey on-chain and remove its off-chain record.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Schedule removal",
            style: "destructive",
            onPress: () => {
              if (!pk.idRaw) return;
              void (async () => {
                setProcessingId(pk.id);
                setError(null);
                try {
                  await submitRemovalAction(pk.idRaw as Hex);
                  await loadData();
                  Alert.alert(
                    "Removal scheduled",
                    "The passkey is now pending removal on-chain. Finalize it after the timelock expires from the Wallet Devices section.",
                  );
                } catch (err) {
                  console.warn("[DevicesPasskeys] schedule removal failed", err);
                  const decoded = decodePasskeyValidatorError(err);
                  if (decoded) {
                    setError(decoded.friendly);
                    if (decoded.autoRefresh) {
                      await loadData().catch(() => {});
                    }
                  } else {
                    setError(err instanceof Error ? err.message : "Failed to schedule on-chain removal");
                  }
                } finally {
                  setProcessingId(null);
                }
              })();
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      "Remove Passkey",
      pk.idRaw && currentPasskeyId && pk.idRaw === currentPasskeyId
        ? "This is the passkey your device uses to sign. Removing it will sign you out of on-chain actions until you re-pair — continue?"
        : "Remove this local-only passkey from this device? It has not been registered on-chain, so this is a local cleanup only.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            setProcessingId(pk.id);
            void removeLocalPasskeyArtifacts(pk)
              .catch((err) => setError(err instanceof Error ? err.message : "Failed to remove local passkey"))
              .finally(() => setProcessingId(null));
          },
        },
      ],
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
      const created = await DevicePairingService.createPairingRequest({ userId: user.id, walletAddress, chainId: resolvedChainId });
      setActiveLink(created.deepLink);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pairing request");
    } finally {
      setBusy(false);
    }
  }, [loadData, user?.id, walletAddress, resolvedChainId]);

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
        if (!currentPasskey?.credentialIdRaw) throw new Error("Current trusted passkey is required to approve pairing");
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
          chainId: resolvedChainId,
          usePaymaster: true,
        });
        const submittedHash = await signAndSubmit(built.userOpHash, built.userOp);
        const receipt = await PasskeyAccountService.waitForReceipt(submittedHash, resolvedChainId);
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
          chainId: resolvedChainId,
          passkeyId: request.new_passkey_id,
          credentialId: request.new_credential_id,
          deviceName: request.new_device_name,
          platform: request.new_device_platform,
        });
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to approve pairing request");
      } finally {
        setBusy(false);
      }
    },
    [loadData, signAndSubmit, user?.id, walletAddress, resolvedChainId],
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

  const buildRemovalPayload = useCallback(
    async (targetPasskeyId: Hex) => {
      if (!user?.id || !walletAddress) throw new Error("Wallet session unavailable");
      const passkey = await PasskeyService.getPasskey(user.id);
      if (!passkey?.credentialIdRaw) throw new Error("Current passkey is required to authorize this action");
      return {
        smartAccountAddress: walletAddress as `0x${string}`,
        targetPasskeyId,
        signingPasskeyId: passkey.credentialIdRaw as `0x${string}`,
        chainId: resolvedChainId,
        usePaymaster: true,
      };
    },
    [user?.id, walletAddress, resolvedChainId],
  );

  const signAndSubmitRemovalUserOp = useCallback(
    async (built: { userOp: any; userOpHash: `0x${string}` }, errorLabel: string) => {
      if (!user?.id || !walletAddress) throw new Error("Wallet session unavailable");
      const signature = await PasskeyService.signWithPasskey(user.id, built.userOpHash);
      const encoded = PasskeyService.encodeSignatureForContract(signature) as `0x${string}`;
      const submittedHash = await PasskeyAccountService.submitAddPasskeyUserOp(
        { ...built.userOp, signature: encoded },
        resolvedChainId,
      );
      const receipt = await PasskeyAccountService.waitForReceipt(submittedHash, resolvedChainId);
      if (!Boolean((receipt as { success?: boolean }).success)) throw new Error(`${errorLabel} reverted on-chain`);
      await DevicePairingService.syncWalletDevicesFromChain({ userId: user.id, walletAddress, chainId: resolvedChainId });
    },
    [user?.id, walletAddress, resolvedChainId],
  );

  const submitRemovalAction = useCallback(
    async (targetPasskeyId: Hex) => {
      const payload = await buildRemovalPayload(targetPasskeyId);
      const built = await PasskeyAccountService.buildRemovePasskeyUserOp(payload);
      await signAndSubmitRemovalUserOp(built, "Passkey removal scheduling");
    },
    [buildRemovalPayload, signAndSubmitRemovalUserOp],
  );

  const executeRemovalAction = useCallback(
    async (targetPasskeyId: Hex, credentialId?: string | null) => {
      const payload = await buildRemovalPayload(targetPasskeyId);
      const built = await PasskeyAccountService.buildExecuteRemovePasskeyUserOp(payload);
      await signAndSubmitRemovalUserOp(built, "Passkey removal execution");
      // Off-chain cleanup once the on-chain entry is gone.
      if (user?.id && credentialId) {
        await PasskeyService.deleteCloudPasskey(user.id, credentialId).catch(() => {});
      }
    },
    [buildRemovalPayload, signAndSubmitRemovalUserOp, user?.id],
  );

  const cancelRemovalAction = useCallback(
    async (targetPasskeyId: Hex) => {
      const payload = await buildRemovalPayload(targetPasskeyId);
      const built = await PasskeyAccountService.buildCancelRemovePasskeyUserOp(payload);
      await signAndSubmitRemovalUserOp(built, "Passkey removal cancellation");
    },
    [buildRemovalPayload, signAndSubmitRemovalUserOp],
  );

  const runDeviceAction = useCallback(
    async (
      device: WalletDevice,
      action: () => Promise<void>,
      defaultErrorMessage: string,
    ) => {
      if (deviceActionId) return; // already running another row's action
      setDeviceActionId(device.id);
      setError(null);
      try {
        await action();
        await loadData();
      } catch (err) {
        console.warn("[DevicesPasskeys] device action failed", err);
        const decoded = decodePasskeyValidatorError(err);
        if (decoded) {
          setError(decoded.friendly);
          if (decoded.autoRefresh) {
            await loadData().catch(() => {});
          }
        } else {
          setError(err instanceof Error ? err.message : defaultErrorMessage);
        }
      } finally {
        setDeviceActionId(null);
      }
    },
    [deviceActionId, loadData],
  );

  const handleRemoveDevice = useCallback(
    (device: WalletDevice) => {
      if (devices.filter((d) => d.status === "active").length <= 1) {
        Alert.alert("Cannot remove last passkey", "At least one active passkey must remain on-chain.");
        return;
      }
      // The chain already tracks pending_removal — if we somehow have a stale
      // local view, treat the click as a no-op and force a refresh.
      if (device.status !== "active") {
        void loadData();
        return;
      }
      void runDeviceAction(
        device,
        () => submitRemovalAction(device.passkey_id as Hex),
        "Failed to remove device",
      );
    },
    [devices, loadData, runDeviceAction, submitRemovalAction],
  );

  const handleFinalizeRemoval = useCallback(
    (device: WalletDevice) => {
      const matchingPasskey = passkeys.find((p) => p.idRaw === device.passkey_id);
      const credentialId = matchingPasskey?.credentialId ?? matchingPasskey?.id ?? null;
      void runDeviceAction(
        device,
        () => executeRemovalAction(device.passkey_id as Hex, credentialId),
        "Failed to finalize removal",
      );
    },
    [executeRemovalAction, passkeys, runDeviceAction],
  );

  const handleCancelRemoval = useCallback(
    (device: WalletDevice) => {
      void runDeviceAction(
        device,
        () => cancelRemovalAction(device.passkey_id as Hex),
        "Failed to cancel removal",
      );
    },
    [cancelRemovalAction, runDeviceAction],
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBackBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerKicker}>SECURITY</Text>
          <Text style={styles.headerTitle}>Linked Devices</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {checkingLocalSigner || !canSignForWallet ? (
          <View>
            {checkingLocalSigner ? (
              <CardSkeleton height={160} />
            ) : (
              <View style={[styles.authRequiredCard, { backgroundColor: `${colors.surfaceCard}CC`, borderColor: colors.border }]}>
                <View style={[styles.authRequiredIcon, { backgroundColor: `${colors.warning}1A`, borderColor: `${colors.warning}40` }]}>
                  <Feather name="shield-off" size={20} color={colors.warning} />
                </View>
                <Text style={[styles.authRequiredTitle, { color: colors.textPrimary }]}>This device isn't authorized yet</Text>
                <Text style={[styles.authRequiredBody, { color: colors.textSecondary }]}>
                  Pair this device with a trusted device that already has your wallet, or use recovery if you no longer have access to your trusted device.
                </Text>
                <TouchableOpacity
                  style={[styles.addDeviceBtn, { backgroundColor: colors.accentAlt, marginTop: 4 }]}
                  onPress={() => navigation.navigate("LinkDevice")}
                  activeOpacity={0.88}
                >
                  <View style={[styles.addDeviceIconWrap, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                    <Feather name="link-2" size={16} color={colors.textOnAccent} />
                  </View>
                  <Text style={[styles.addDeviceLabel, { color: colors.textOnAccent }]}>Pair this device</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.authRequiredSecondaryBtn, { borderColor: colors.border }]}
                  onPress={() => navigation.navigate("RecoveryEntry")}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.authRequiredSecondaryLabel, { color: colors.textPrimary }]}>Use recovery instead</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Add device CTA */}
            <TouchableOpacity
              style={[styles.addDeviceBtn, { backgroundColor: colors.accentAlt, opacity: busy && !walletAddress ? 0.5 : 1 }]}
              onPress={handleCreatePairing}
              disabled={busy || !walletAddress}
              activeOpacity={0.88}
            >
              {busy ? (
                <ActivityIndicator color={colors.textOnAccent} />
              ) : (
                <>
                  <View style={[styles.addDeviceIconWrap, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                    <Feather name="plus" size={16} color={colors.textOnAccent} />
                  </View>
                  <Text style={[styles.addDeviceLabel, { color: colors.textOnAccent }]}>Add New Device</Text>
                </>
              )}
            </TouchableOpacity>

            {/* QR pairing card */}
            {activeLink && (
              <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIconWrap, { backgroundColor: `${colors.accentAlt}1A` }]}>
                    <Feather name="smartphone" size={15} color={colors.accentAlt} />
                  </View>
                  <Text style={styles.cardTitle}>Scan on New Device</Text>
                </View>
                <View style={styles.qrWrapper}>
                  <QRCode value={activeLink} size={180} />
                </View>
                <Text style={[styles.cardHint, { color: colors.textSecondary }]}>
                  Open this QR code on the new device. If the device is signed out, Trezo will resume pairing automatically after sign-in.
                </Text>
                <Text style={[styles.cardMono, { color: colors.textMuted }]} selectable>{activeLink}</Text>
              </View>
            )}

            {/* Pending pairing requests */}
            <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: `${colors.warning}1A` }]}>
                  <Feather name="clock" size={15} color={colors.warning} />
                </View>
                <Text style={styles.cardTitle}>Pending Requests</Text>
              </View>

              {requests.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>No pending pairing requests.</Text>
              ) : (
                requests.map((request, i) => (
                  <View
                    key={request.id}
                    style={[
                      styles.listRow,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted },
                    ]}
                  >
                    <View style={[styles.deviceAvatarWrap, { backgroundColor: `${colors.accentAlt}1A` }]}>
                      <Feather name="smartphone" size={14} color={colors.accentAlt} />
                    </View>
                    <View style={styles.listRowContent}>
                      <Text style={[styles.listRowTitle, { color: colors.textPrimary }]}>
                        {request.new_device_name ?? "New device"}
                      </Text>
                      <Text style={[styles.listRowSub, { color: colors.textMuted }]}>
                        {requestStatusLabel(request.status)}
                      </Text>
                    </View>
                    {request.status === "passkey_submitted" && (
                      <View style={styles.actionPair}>
                        <TouchableOpacity
                          style={[styles.pillBtn, { backgroundColor: `${colors.success}22`, borderColor: `${colors.success}47` }]}
                          onPress={() => void handleApproveRequest(request)}
                        >
                          <Text style={[styles.pillBtnText, { color: colors.success }]}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.pillBtn, { backgroundColor: `${colors.danger}1A`, borderColor: `${colors.danger}40` }]}
                          onPress={() => void handleRejectRequest(request)}
                        >
                          <Text style={[styles.pillBtnText, { color: colors.danger }]}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>

            {/* My passkeys */}
            <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: `${colors.accent}1A` }]}>
                  <Feather name="key" size={15} color={colors.accent} />
                </View>
                <Text style={styles.cardTitle}>My Passkeys</Text>
                <TouchableOpacity
                  onPress={handleAddPasskey}
                  disabled={isSubmitting}
                  style={[styles.addPasskeyBtn, { backgroundColor: `${colors.accentAlt}18`, borderColor: `${colors.accentAlt}40` }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={colors.accentAlt} />
                  ) : (
                    <Feather name="plus" size={15} color={colors.accentAlt} />
                  )}
                </TouchableOpacity>
              </View>

              {passkeys.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>No passkeys set up yet.</Text>
              ) : (
                passkeys.map((pk, i) => (
                  <View
                    key={pk.id}
                    style={[
                      styles.listRow,
                      i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted },
                    ]}
                  >
                    <View style={[styles.deviceAvatarWrap, { backgroundColor: `${colors.accent}1A` }]}>
                      <Feather name="key" size={14} color={colors.accent} />
                    </View>
                    <View style={styles.listRowContent}>
                      <Text style={[styles.listRowTitle, { color: colors.textPrimary }]}>{pk.deviceName}</Text>
                      <View style={styles.statusPillRow}>
                        {pk.isOnChain ? (
                          <View style={[styles.statusPill, { backgroundColor: `${colors.success}18`, borderColor: `${colors.success}40` }]}>
                            <Feather name="check-circle" size={10} color={colors.success} />
                            <Text style={[styles.statusPillText, { color: colors.success }]}>On-chain</Text>
                          </View>
                        ) : (
                          <View style={[styles.statusPill, { backgroundColor: `${colors.warning}18`, borderColor: `${colors.warning}40` }]}>
                            <Feather name="cloud-off" size={10} color={colors.warning} />
                            <Text style={[styles.statusPillText, { color: colors.warning }]}>Local only</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.actionPair}>
                      {!pk.isOnChain && (
                        <TouchableOpacity
                          onPress={() => handleRegisterOnChain(pk)}
                          disabled={processingId === pk.id}
                          style={[styles.iconBtn, { backgroundColor: `${colors.accentAlt}18`, borderColor: `${colors.accentAlt}40`, opacity: processingId === pk.id ? 0.5 : 1 }]}
                        >
                          {processingId === pk.id ? (
                            <ActivityIndicator size="small" color={colors.accentAlt} />
                          ) : (
                            <Feather name="upload-cloud" size={14} color={colors.accentAlt} />
                          )}
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => handleRemovePasskey(pk)}
                        disabled={processingId === pk.id}
                        style={[styles.iconBtn, { backgroundColor: `${colors.danger}18`, borderColor: `${colors.danger}33`, opacity: processingId === pk.id ? 0.5 : 1 }]}
                      >
                        {processingId === pk.id ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                          <Feather name="trash-2" size={14} color={colors.danger} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Wallet devices */}
            <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconWrap, { backgroundColor: `${colors.success}1A` }]}>
                  <Feather name="shield" size={15} color={colors.success} />
                </View>
                <Text style={styles.cardTitle}>Wallet Devices</Text>
              </View>

              {devices.length === 0 ? (
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>No synced devices yet.</Text>
              ) : (
                devices.map((device, i) => {
                  const sc = statusConfig(device.status, colors);
                  const isThis = currentPasskeyId && device.passkey_id === currentPasskeyId;
                  const removalReadyAt = device.removal_execute_after
                    ? new Date(device.removal_execute_after)
                    : null;
                  const removalReady =
                    removalReadyAt !== null && removalReadyAt.getTime() <= Date.now();
                  return (
                    <View
                      key={device.id}
                      style={[
                        styles.listRow,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderMuted },
                      ]}
                    >
                      <View style={[styles.deviceAvatarWrap, { backgroundColor: `${colors.success}1A` }]}>
                        <Feather name="smartphone" size={14} color={colors.success} />
                      </View>
                      <View style={styles.listRowContent}>
                        <View style={styles.deviceTitleRow}>
                          <Text style={[styles.listRowTitle, { color: colors.textPrimary }]}>
                            {device.device_name ?? "Unnamed device"}
                          </Text>
                          {isThis && (
                            <View style={[styles.thisDevicePill, { backgroundColor: `${colors.accentAlt}18`, borderColor: `${colors.accentAlt}40` }]}>
                              <Text style={[styles.thisDevicePillText, { color: colors.accentAlt }]}>This device</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.statusPillRow}>
                          <View style={[styles.statusPill, { backgroundColor: sc.bg, borderColor: `${sc.color}47` }]}>
                            <Text style={[styles.statusPillText, { color: sc.color }]}>{sc.label}</Text>
                          </View>
                        </View>
                        <Text style={[styles.deviceMeta, { color: colors.textMuted }]}>
                          {device.platform ? `${device.platform.toUpperCase()} · ` : ""}
                          {device.passkey_id.slice(0, 12)}…
                        </Text>
                        {device.status === "pending_removal" && removalReadyAt && (
                          <Text style={[styles.deviceMeta, { color: colors.warning }]}>
                            {removalReady
                              ? "Removal timelock elapsed — finalize to permanently revoke this passkey."
                              : `Finalize available after ${removalReadyAt.toLocaleString()}`}
                          </Text>
                        )}
                      </View>
                      {device.status === "active" && (
                        <TouchableOpacity
                          style={[
                            styles.pillBtn,
                            {
                              backgroundColor: `${colors.danger}1A`,
                              borderColor: `${colors.danger}40`,
                              opacity: deviceActionId && deviceActionId !== device.id ? 0.4 : 1,
                            },
                          ]}
                          onPress={() => handleRemoveDevice(device)}
                          disabled={Boolean(deviceActionId)}
                        >
                          {deviceActionId === device.id ? (
                            <ActivityIndicator size="small" color={colors.danger} />
                          ) : (
                            <Text style={[styles.pillBtnText, { color: colors.danger }]}>Remove</Text>
                          )}
                        </TouchableOpacity>
                      )}
                      {device.status === "pending_removal" && (
                        <View style={styles.actionPair}>
                          <TouchableOpacity
                            style={[
                              styles.pillBtn,
                              {
                                backgroundColor: `${colors.textMuted}18`,
                                borderColor: `${colors.textMuted}40`,
                                opacity: deviceActionId && deviceActionId !== device.id ? 0.4 : 1,
                              },
                            ]}
                            onPress={() => handleCancelRemoval(device)}
                            disabled={Boolean(deviceActionId)}
                          >
                            {deviceActionId === device.id ? (
                              <ActivityIndicator size="small" color={colors.textPrimary} />
                            ) : (
                              <Text style={[styles.pillBtnText, { color: colors.textPrimary }]}>Cancel</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.pillBtn,
                              {
                                backgroundColor: removalReady ? `${colors.danger}22` : `${colors.danger}0A`,
                                borderColor: `${colors.danger}47`,
                                opacity:
                                  (deviceActionId && deviceActionId !== device.id) || !removalReady
                                    ? 0.4
                                    : 1,
                              },
                            ]}
                            onPress={() => handleFinalizeRemoval(device)}
                            disabled={Boolean(deviceActionId) || !removalReady}
                          >
                            {deviceActionId === device.id ? (
                              <ActivityIndicator size="small" color={colors.danger} />
                            ) : (
                              <Text style={[styles.pillBtnText, { color: colors.danger }]}>Finalize</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>

            {/* Error */}
            {error && (
              <View style={[styles.errorCard, { backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}40` }]}>
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
              </View>
            )}

            {/* Disclaimer */}
            <View style={[styles.disclaimerCard, { backgroundColor: `${colors.accent}0A`, borderColor: `${colors.accent}20` }]}>
              <Feather name="info" size={13} color={colors.textMuted} />
              <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
                If you lose access to all trusted devices, use guardian or email recovery to regain control of your wallet.
              </Text>
            </View>
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
      paddingTop: 58,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
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
    scroll: {
      flex: 1,
    },
    body: {
      padding: 20,
      gap: 16,
      paddingBottom: 48,
    },
    addDeviceBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      borderRadius: 16,
      paddingVertical: 15,
    },
    addDeviceIconWrap: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    addDeviceLabel: {
      fontSize: 15,
      fontWeight: "700",
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 16,
      gap: 14,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    cardIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitle: {
      flex: 1,
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    addPasskeyBtn: {
      width: 32,
      height: 32,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    qrWrapper: {
      alignSelf: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: 12,
      padding: 12,
    },
    cardHint: {
      fontSize: 13,
      lineHeight: 19,
    },
    cardMono: {
      fontSize: 11,
      lineHeight: 16,
    },
    emptyHint: {
      fontSize: 13,
      textAlign: "center",
      paddingVertical: 8,
    },
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingTop: 12,
    },
    deviceAvatarWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    listRowContent: {
      flex: 1,
      gap: 4,
    },
    listRowTitle: {
      fontSize: 14,
      fontWeight: "700",
    },
    listRowSub: {
      fontSize: 12,
    },
    deviceTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
    },
    statusPillRow: {
      flexDirection: "row",
    },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    statusPillText: {
      fontSize: 11,
      fontWeight: "700",
    },
    thisDevicePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
      borderWidth: 1,
    },
    thisDevicePillText: {
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    deviceMeta: {
      fontSize: 11,
      lineHeight: 16,
    },
    actionPair: {
      flexDirection: "row",
      gap: 6,
      flexShrink: 0,
    },
    pillBtn: {
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 11,
      paddingVertical: 7,
      alignItems: "center",
      justifyContent: "center",
    },
    pillBtnText: {
      fontSize: 12,
      fontWeight: "700",
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 9,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    errorCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderRadius: 13,
      borderWidth: 1,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 19,
    },
    disclaimerCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderRadius: 13,
      borderWidth: 1,
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    disclaimerText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
    },
    authRequiredCard: {
      borderRadius: 20,
      borderWidth: 1,
      padding: 18,
      gap: 12,
      alignItems: "stretch",
    },
    authRequiredIcon: {
      alignSelf: "flex-start",
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    authRequiredTitle: {
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.2,
    },
    authRequiredBody: {
      fontSize: 13,
      lineHeight: 19,
    },
    authRequiredSecondaryBtn: {
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 13,
      alignItems: "center",
    },
    authRequiredSecondaryLabel: {
      fontSize: 13,
      fontWeight: "700",
    },
  });

export default DevicesPasskeysScreen;
