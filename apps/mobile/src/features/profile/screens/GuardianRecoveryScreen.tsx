import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Share,
} from "react-native";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { SocialRecoveryService } from "@/src/features/wallet/services/SocialRecoveryService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import {
    DEFAULT_CHAIN_ID,
    getDeployment,
    type SupportedChainId,
} from "@/src/integration/chains";
import type { Guardian } from "@store/useRecoveryStatusStore";
import { useRecoveryStatusStore } from "@store/useRecoveryStatusStore";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { isAddress, sha256, toBytes, type Address, type Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";
import { GuardianSyncService } from "../services/GuardianSyncService";

const randomHex = (bytes: number): Hex => {
  const arr = new Uint8Array(bytes);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < bytes; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}` as Hex;
};

const shortenHex = (value: string | null | undefined, chars = 6) => {
  if (!value) return "—";
  if (value.length <= chars * 2 + 2) return value;
  return `${value.slice(0, chars + 2)}…${value.slice(-chars)}`;
};

const GuardianRecoveryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const user = useUserStore((state) => state.user);
  const storedSmartAccountAddress = useUserStore(
    (state) => state.smartAccountAddress,
  );
  const smartAccountDeployed = useUserStore(
    (state) => state.smartAccountDeployed,
  );
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);
  const {
    guardians: storedGuardians,
    requiredSignatures,
    totalGuardians,
    setGuardians,
    clearGuardians,
    moduleInstalled: moduleInstalledPersisted,
    setModuleInstalled: setPersistentModuleInstalled,
  } = useRecoveryStatusStore();
  const smartAccountAddress = useMemo(() => {
    const address =
      aaAccount?.predictedAddress ?? storedSmartAccountAddress ?? undefined;
    return address ? (address as Address) : undefined;
  }, [aaAccount?.predictedAddress, storedSmartAccountAddress]);
  const isAccountDeployed = Boolean(
    aaAccount?.isDeployed ?? smartAccountDeployed ?? false,
  );
  const resolvedChainId = useMemo<SupportedChainId>(
    () =>
      (aaAccount?.chainId ??
        activeChainId ??
        DEFAULT_CHAIN_ID) as SupportedChainId,
    [aaAccount?.chainId, activeChainId],
  );
  const smartAccountReady = Boolean(smartAccountAddress && isAccountDeployed);

  const defaultN = 3;
  const [mValue, setMValue] = useState(
    storedGuardians.length > 0 ? requiredSignatures.toString() : "2",
  );
  const [nValue, setNValue] = useState(
    storedGuardians.length > 0 ? totalGuardians.toString() : "3",
  );
  const [guardianAddresses, setGuardianAddresses] = useState<string[]>(() => {
    if (storedGuardians.length > 0) {
      return storedGuardians.map((g) => g.address);
    }
    return Array(defaultN).fill("");
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<"form" | "list">(
    storedGuardians.length > 0 ? "list" : "form",
  );
  const [syncStatus, setSyncStatus] = useState<{
    hasAAWallet: boolean;
    isSynced: boolean;
    localGuardians: number;
    dbGuardians: number;
  } | null>(null);
  const [moduleStatusNonce, setModuleStatusNonce] = useState(0);
  const [checkingModule, setCheckingModule] = useState(false);
  const [moduleInstalledState, setModuleInstalledState] = useState<
    boolean | null
  >(null);
  const [installingModule, setInstallingModule] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [lastUserOpHash, setLastUserOpHash] = useState<Hex | null>(null);
  const [lastOperationHash, setLastOperationHash] = useState<Hex | null>(null);
  const [lastInstallPayload, setLastInstallPayload] =
    useState<UserOperation<"0.7"> | null>(null);
  const [lastGuardianAction, setLastGuardianAction] = useState<{
    actionType: string;
    payload: Record<string, unknown>;
    userOpHash: Hex;
    signature: Hex;
    generatedAt: string;
  } | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [activeRecoveryHash, setActiveRecoveryHash] = useState<Hex | null>(null);
  const moduleStatusLocked = moduleInstalledPersisted;
  const savedGuardianAddresses = useMemo(
    () => storedGuardians.map((g) => g.address.trim()).filter(Boolean),
    [storedGuardians],
  );
  const guardiansReady =
    savedGuardianAddresses.length > 0 &&
    requiredSignatures <= savedGuardianAddresses.length;

  // Check sync status on mount
  useEffect(() => {
    const checkSync = async () => {
      if (!user?.id) return;
      const status = await GuardianSyncService.getSyncStatus(user.id);
      setSyncStatus(status);
    };
    checkSync();
  }, [user?.id]);

  useEffect(() => {
    if (moduleStatusLocked) {
      setModuleInstalledState(true);
      setCheckingModule(false);
      return;
    }
    if (!smartAccountReady || !smartAccountAddress) {
      setModuleInstalledState(null);
      setModuleError(null);
      setCheckingModule(false);
      return;
    }
    let cancelled = false;
    setCheckingModule(true);
    SocialRecoveryService.isModuleInstalled(
      smartAccountAddress,
      resolvedChainId,
    )
      .then((installed) => {
        if (!cancelled) {
          setModuleInstalledState(installed);
          setModuleError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setModuleError(
            error instanceof Error
              ? error.message
              : "Failed to read recovery status",
          );
          setModuleInstalledState(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckingModule(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    smartAccountReady,
    smartAccountAddress,
    resolvedChainId,
    moduleStatusNonce,
    moduleStatusLocked,
  ]);

  const simulateGuardianAction = useCallback(
    async (actionType: string, payload: Record<string, unknown>) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      const passkey = await PasskeyService.getPasskey(user.id);
      if (!passkey) {
        throw new Error(
          "No passkey found on this device. Create a passkey first.",
        );
      }
      const message = JSON.stringify({
        actionType,
        payload,
        timestamp: Date.now(),
      });
      const fakeHash = sha256(toBytes(message)) as Hex;
      const signature = await PasskeyService.signWithPasskey(user.id, fakeHash);
      const encodedSignature = PasskeyService.encodeSignatureForContract(
        signature,
      ) as Hex;
      setLastGuardianAction({
        actionType,
        payload,
        userOpHash: fakeHash,
        signature: encodedSignature,
        generatedAt: new Date().toISOString(),
      });
      return { fakeHash, encodedSignature };
    },
    [user?.id],
  );

  const handleMNChange = useCallback((field: "m" | "n", value: string) => {
    const numValue = parseInt(value) || 0;
    if (field === "m") {
      setMValue(value);
    } else {
      setNValue(value);
      setGuardianAddresses((current) => {
        if (numValue > current.length) {
          return [...current, ...Array(numValue - current.length).fill("")];
        }
        return current.slice(0, numValue || 0);
      });
    }
  }, []);

  const handleAddressChange = useCallback((index: number, value: string) => {
    setGuardianAddresses((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const m = parseInt(mValue);
    const n = parseInt(nValue);

    if (!m || !n || m > n) {
      Alert.alert(
        "Invalid setup",
        "Approvals needed must be less than or equal to total contacts.",
      );
      return;
    }

    const filledAddresses = guardianAddresses.filter((addr) => addr.trim());
    if (filledAddresses.length !== n) {
      Alert.alert(
        "Incomplete",
        `Please enter all ${n} trusted contact addresses.`,
      );
      return;
    }

    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to continue.");
      return;
    }

    setIsSubmitting(true);

    try {
      await simulateGuardianAction("configure_guardians", {
        guardians: filledAddresses,
        threshold: m,
        totalGuardians: n,
      });
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert(
        "Passkey required",
        error instanceof Error
          ? error.message
          : "Failed to confirm with your passkey.",
      );
      return;
    }

    // Save guardians locally
    const newGuardians: Guardian[] = guardianAddresses.map((addr, idx) => ({
      id: `guardian-${Date.now()}-${idx}`,
      address: addr,
    }));

    setGuardians(newGuardians, m, n);

    // Try to sync to database
    const syncResult = await GuardianSyncService.syncGuardiansToDatabase(
      user.id,
    );

    setIsSubmitting(false);

    if (syncResult.success || syncResult.error === "AA_WALLET_NOT_DEPLOYED") {
      Alert.alert(
        "Recovery updated",
        "Trusted contact changes were confirmed and synced.",
      );
      // Refresh sync status
      const status = await GuardianSyncService.getSyncStatus(user.id);
      setSyncStatus(status);
    } else {
      Alert.alert(
        "Saved locally",
        "Trusted contacts were saved locally but not synced yet. You can sync manually later.",
        [{ text: "OK" }],
      );
    }

    setViewMode("list");
  }, [
    mValue,
    nValue,
    guardianAddresses,
    setGuardians,
    user?.id,
    simulateGuardianAction,
  ]);

  const handleSyncNow = useCallback(async () => {
    if (!user?.id) return;

    setIsSyncing(true);
    const result = await GuardianSyncService.syncGuardiansToDatabase(user.id);
    setIsSyncing(false);

    if (result.success || result.error === "AA_WALLET_NOT_DEPLOYED") {
      Alert.alert("Synced", "Trusted contacts synced successfully.");
      // Refresh sync status
      const status = await GuardianSyncService.getSyncStatus(user.id);
      setSyncStatus(status);
    } else {
      Alert.alert(
        "Sync failed",
        "Unable to sync trusted contacts right now. Try again later.",
      );
    }
  }, [user?.id]);

  const handleRefreshModuleStatus = useCallback(() => {
    if (!smartAccountReady) return;
    setModuleStatusNonce((nonce) => nonce + 1);
  }, [smartAccountReady]);

  const handleInstallModule = useCallback(async () => {
    if (!smartAccountReady || !smartAccountAddress) {
      Alert.alert(
        "Trezo account required",
        "Create your Trezo account before activating recovery.",
      );
      return;
    }
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to activate recovery.");
      return;
    }
    if (!guardiansReady) {
      Alert.alert(
        "Add trusted contacts",
        "Save at least one trusted contact before activating recovery.",
      );
      return;
    }
    const invalidGuardian = savedGuardianAddresses.find(
      (address) => !isAddress(address),
    );
    if (invalidGuardian) {
      Alert.alert(
        "Invalid address",
        `${invalidGuardian} is not a valid address.`,
      );
      return;
    }

    setInstallingModule(true);
    setModuleError(null);
    setLastUserOpHash(null);
    setLastOperationHash(null);

    try {
      const passkey = await PasskeyService.getPasskey(user.id);
      if (!passkey) {
        throw new Error(
          "No passkey found on this device. Create a passkey first.",
        );
      }

      const guardians = savedGuardianAddresses.map(
        (address) => address as Address,
      );
      const { userOp, userOpHash } =
        await SocialRecoveryService.buildInstallModuleUserOp({
          smartAccountAddress,
          guardians,
          threshold: requiredSignatures,
          passkeyId: passkey.credentialIdRaw as Hex,
          chainId: resolvedChainId,
          usePaymaster: true,
        });

      setLastUserOpHash(userOpHash);

      const signature = await PasskeyService.signWithPasskey(
        user.id,
        userOpHash,
      );
      const encodedSignature = PasskeyService.encodeSignatureForContract(
        signature,
      ) as Hex;
      const signedUserOp = { ...userOp, signature: encodedSignature };

      const mockOpHash = randomHex(32);
      setLastOperationHash(mockOpHash);
      setLastInstallPayload(signedUserOp);
      setModuleInstalledState(true);
      setPersistentModuleInstalled(true);
      Alert.alert(
        "Recovery activated",
        "Trusted contacts are now enabled for recovery.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to activate recovery. Please try again.";
      setModuleError(message);
      Alert.alert("Activation failed", message);
    } finally {
      setInstallingModule(false);
    }
  }, [
    guardiansReady,
    resolvedChainId,
    requiredSignatures,
    savedGuardianAddresses,
    smartAccountAddress,
    smartAccountReady,
    user?.id,
    setPersistentModuleInstalled,
  ]);

  const handleRemoveGuardian = useCallback(
    (id: string) => {
      const targetGuardian = storedGuardians.find((g) => g.id === id);
      if (!targetGuardian) return;
      if (storedGuardians.length <= 1) {
        Alert.alert(
          "Minimum required",
          "You need at least one trusted contact configured at all times.",
        );
        return;
      }
      Alert.alert(
        "Remove trusted contact",
        "Are you sure you want to remove this trusted contact?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                await simulateGuardianAction("remove_guardian", {
                  guardianId: targetGuardian.id,
                  guardianAddress: targetGuardian.address,
                });
              } catch (error) {
                Alert.alert(
                  "Passkey required",
                  error instanceof Error
                    ? error.message
                    : "Failed to confirm with your passkey.",
                );
                return;
              }
              const updated = storedGuardians.filter((g) => g.id !== id);
              if (updated.length === 0) {
                clearGuardians();
                setViewMode("form");
                setGuardianAddresses(Array(defaultN).fill(""));
                setMValue("2");
                setNValue("3");
              } else {
                setGuardians(updated, parseInt(mValue), updated.length);
              }
            },
          },
        ],
      );
    },
    [
      storedGuardians,
      mValue,
      setGuardians,
      clearGuardians,
      simulateGuardianAction,
    ],
  );

  const handleEditGuardians = useCallback(() => {
    setNValue(storedGuardians.length.toString());
    setGuardianAddresses(storedGuardians.map((g) => g.address));
    setViewMode("form");
  }, [storedGuardians]);

  const formatActionType = (value: string) => {
    switch (value) {
      case "configure_guardians":
        return "Configure contacts";
      case "remove_guardian":
        return "Remove contact";
      default:
        return "Recovery action";
    }
  };

  const handleShareRecoveryLink = useCallback(async () => {
    if (!smartAccountAddress) return;
    
    setIsGeneratingLink(true);
    try {
      const deployment = getDeployment(resolvedChainId);
      const moduleAddress = deployment?.socialRecovery as Address;
      
      // For simulation: generate a random new owner hash and a random recovery ID
      const mockNewOwnerHash = randomHex(32);
      const mockRecoveryId = randomHex(20);
      
      const hash = SocialRecoveryService.getRecoveryHash(
        smartAccountAddress,
        mockRecoveryId,
        mockNewOwnerHash
      );
      
      setActiveRecoveryHash(hash);

      const baseUrl = process.env.EXPO_PUBLIC_GUARDIAN_PORTAL_URL || 'https://guardian-approval.trezo.app';
      const portalUrl = `${baseUrl}/?hash=${hash}&module=${moduleAddress}`;
      
      await Share.share({
        message: `Trezo Recovery Request: Please help me recover my account by approving this hash on-chain: ${portalUrl}`,
        title: "Trezo Account Recovery",
      });
      
    } catch (error) {
      console.error("Failed to share recovery link:", error);
      Alert.alert("Error", "Failed to generate recovery link");
    } finally {
      setIsGeneratingLink(false);
    }
  }, [smartAccountAddress, resolvedChainId]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* HEADER */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Feather name="arrow-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={{ gap: 4 }}>
              <Text style={styles.screenTitle}>Trusted Contacts</Text>
              <Text style={styles.screenDesc}>
                Guardians who can help you recover your account.
              </Text>
            </View>
          </View>
          {viewMode === "form" && (
            <View style={styles.configCard}>
              <View style={styles.cardSectionHeader}>
                <Text style={styles.cardSectionLabel}>SETUP TRUSTED CONTACTS</Text>
              </View>

              <Text style={styles.configDesc}>
                Define how many trusted contacts you want to add and how many are required to approve a recovery.
              </Text>

            <View style={styles.mnContainer}>
              <View style={styles.mnInputGroup}>
                <Text style={styles.mnLabel}>Approvals Needed</Text>
                <TextInput
                  style={styles.mnInput}
                  value={mValue}
                  onChangeText={(val) => handleMNChange("m", val)}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Text style={styles.mnDivider}>of</Text>

              <View style={styles.mnInputGroup}>
                <Text style={styles.mnLabel}>Total Contacts</Text>
                <TextInput
                  style={styles.mnInput}
                  value={nValue}
                  onChangeText={(val) => handleMNChange("n", val)}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.addressesContainer}>
              <Text style={styles.addressesLabel}>
                Trusted Contact Addresses
              </Text>
              {guardianAddresses.map((address, index) => (
                <View key={index} style={styles.addressInputWrapper}>
                  <Text style={styles.addressIndex}>{index + 1}</Text>
                  <TextInput
                    style={styles.addressInput}
                    value={address}
                    onChangeText={(val) => handleAddressChange(index, val)}
                    placeholder={`0x... (Contact ${index + 1})`}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isSubmitting && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <Text style={styles.submitButtonText}>Confirm & Save</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {viewMode === "list" && (
            <View style={styles.existingCard}>
              <View style={styles.existingHeader}>
                <Text style={styles.cardSectionLabel}>ACTIVE TRUSTED CONTACTS</Text>
                <TouchableOpacity onPress={handleEditGuardians}>
                  <Text style={styles.editButton}>Manage</Text>
                </TouchableOpacity>
              </View>

            {/* Sync Status Indicator */}
            {syncStatus && (
              <View
                style={[
                  styles.syncStatusContainer,
                  !syncStatus.hasAAWallet
                    ? styles.syncStatusWarning
                    : !syncStatus.isSynced
                      ? styles.syncStatusNeedSync
                      : styles.syncStatusSynced,
                ]}
              >
                <Feather
                  name={
                    !syncStatus.hasAAWallet
                      ? "alert-circle"
                      : !syncStatus.isSynced
                        ? "upload-cloud"
                        : "check-circle"
                  }
                  size={16}
                  color={
                    !syncStatus.hasAAWallet
                      ? colors.warning
                      : !syncStatus.isSynced
                        ? colors.accent
                        : colors.success
                  }
                />
                <Text style={styles.syncStatusText}>
                  {!syncStatus.hasAAWallet
                    ? "Add at least 1 trusted contact"
                    : !syncStatus.isSynced
                      ? "Not synced yet"
                      : "Synced ✓"}
                </Text>
                {syncStatus.hasAAWallet && !syncStatus.isSynced && (
                  <TouchableOpacity
                    onPress={handleSyncNow}
                    disabled={isSyncing}
                    style={styles.syncButton}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color={colors.accent} />
                    ) : (
                      <Text style={styles.syncButtonText}>Sync Now</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {storedGuardians.map((guardian, index) => (
              <View
                key={guardian.id}
                style={[
                  styles.guardianRow,
                  index < storedGuardians.length - 1 &&
                    styles.guardianRowBorder,
                ]}
              >
                <View style={styles.guardianInfo}>
                  <View style={styles.guardianBadge}>
                    <Text style={styles.guardianBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.guardianAddress} numberOfLines={1}>
                    {guardian.address}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveGuardian(guardian.id)}
                >
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.guardianSummary}>
              <Feather name="info" size={16} color={colors.accent} />
              <Text style={styles.guardianSummaryText}>
                Approval requirement: {requiredSignatures} of{" "}
                {storedGuardians.length}
              </Text>
            </View>
          </View>
        )}
          <View style={styles.moduleCard}>
            <View style={styles.moduleHeader}>
              <Text style={styles.cardSectionLabel}>RECOVERY ENGINE</Text>
              <TouchableOpacity
                onPress={handleRefreshModuleStatus}
                style={styles.refreshButton}
                disabled={!smartAccountReady || checkingModule}
              >
                {checkingModule ? (
                  <ActivityIndicator size="small" color={colors.accentAlt} />
                ) : (
                  <Feather
                    name="refresh-ccw"
                    size={16}
                    color={smartAccountReady ? colors.accent : colors.textMuted}
                  />
                )}
              </TouchableOpacity>
            </View>
            <Text style={styles.moduleDescription}>
              Activate recovery so your trusted contacts can help you regain
              access if needed.
            </Text>
            <View
              style={[
                styles.moduleStatusBadge,
                moduleInstalledState
                  ? styles.moduleStatusInstalled
                  : styles.moduleStatusIdle,
                !smartAccountReady && styles.moduleStatusWarning,
              ]}
            >
              <Feather
                name={
                  !smartAccountReady
                    ? "alert-circle"
                    : moduleInstalledState
                      ? "check-circle"
                      : "shield-off"
                }
                size={16}
                color={
                  !smartAccountReady
                    ? colors.warning
                    : moduleInstalledState
                      ? colors.success
                      : colors.accentAlt
                }
              />
              <Text style={styles.moduleStatusText}>
                {!smartAccountReady
                  ? "Trezo account required"
                  : checkingModule
                    ? "Checking status..."
                    : moduleInstalledState
                      ? "Recovery is Active"
                      : "Recovery not active"}
              </Text>
            </View>
            {moduleError && (
              <Text style={styles.moduleError}>{moduleError}</Text>
            )}

            {smartAccountReady && guardiansReady && !moduleInstalledState && (
              <TouchableOpacity
                style={[
                  styles.installButton,
                  installingModule && styles.installButtonDisabled,
                ]}
                onPress={handleInstallModule}
                activeOpacity={0.85}
                disabled={installingModule}
              >
                {installingModule ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <Text style={styles.installButtonText}>
                    Activate Recovery Now
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {!smartAccountReady && (
              <Text style={styles.moduleHint}>
                Please create your Trezo account to enable this feature.
              </Text>
            )}
            {smartAccountReady && !guardiansReady && !moduleInstalledState && (
              <Text style={styles.moduleHint}>
                Add and save at least {requiredSignatures} trusted contacts
                first.
              </Text>
            )}
          </View>

            {moduleInstalledState && (
              <View style={styles.recoverySimCard}>
                <View style={styles.cardSectionHeader}>
                  <Text style={styles.cardSectionLabel}>RECOVERY SIMULATION</Text>
                </View>
                <Text style={styles.moduleDescription}>
                  Test your recovery setup by generating an approval link to share with your guardians.
                </Text>
                
                <TouchableOpacity
                  style={[
                    styles.shareLinkButton,
                    isGeneratingLink && styles.submitButtonDisabled,
                  ]}
                  onPress={handleShareRecoveryLink}
                  disabled={isGeneratingLink}
                >
                  {isGeneratingLink ? (
                    <ActivityIndicator size="small" color={colors.accent} />
                  ) : (
                    <>
                      <Feather name="share-2" size={18} color={colors.accent} />
                      <Text style={styles.shareLinkButtonText}>Share Approval Link</Text>
                    </>
                  )}
                </TouchableOpacity>

                {activeRecoveryHash && (
                  <View style={styles.activeHashContainer}>
                    <Text style={styles.hashLabel}>ACTIVE TEST HASH</Text>
                    <Text style={styles.hashValue} numberOfLines={1}>{activeRecoveryHash}</Text>
                  </View>
                )}
              </View>
            )}

          {/* DEV INFO SECTION (CLEANER) */}
          {__DEV__ && (lastUserOpHash || lastOperationHash) && (
            <View style={styles.existingCard}>
              <Text style={styles.cardSectionLabel}>TRANSACTION STATUS</Text>
              {lastUserOpHash && (
                <View style={styles.hashRow}>
                  <Text style={styles.hashLabel}>Request ID</Text>
                  <Text style={styles.hashValue}>{lastUserOpHash}</Text>
                </View>
              )}
              {lastOperationHash && (
                <View style={styles.hashRow}>
                  <Text style={styles.hashLabel}>Processing ID</Text>
                  <Text style={styles.hashValue}>{lastOperationHash}</Text>
                </View>
              )}
            </View>
          )}

          {/* HELP SECTION (Visual Parity with SecurityCenter) */}
          <View style={styles.helpCard}>
            <Text style={styles.helpTitle}>How does this protect me?</Text>
            <Text style={styles.helpText}>
              If you lose your phone or forget your passkey, your trusted
              contacts can collectively approve a recovery request to restore
              your access. This ensures you never lose your funds.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Saving trusted contacts…</Text>
        </View>
      )}
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
      marginBottom: 24,
      paddingTop: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    screenTitle: {
      color: colors.textPrimary,
      fontSize: 28,
      fontWeight: "800",
    },
    screenDesc: {
      color: colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 40,
    },
    configCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 20,
      marginBottom: 20,
    },
    cardSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    cardSectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      color: colors.accent,
      textTransform: "uppercase",
    },
    configDesc: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
    },
    mnContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 20,
      marginBottom: 28,
    },
    mnInputGroup: {
      alignItems: "center",
      gap: 8,
    },
    mnLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    mnInput: {
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      width: 80,
      height: 56,
      textAlign: "center",
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "700",
    },
    mnDivider: {
      color: colors.textMuted,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 8,
    },
    addressesContainer: {
      gap: 12,
    },
    addressesLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 4,
    },
    addressInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    addressIndex: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "700",
      width: 24,
    },
    addressInput: {
      flex: 1,
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: "monospace",
    },
    submitButton: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 24,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: colors.textOnAccent,
      fontSize: 15,
      fontWeight: "700",
    },
    existingCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 20,
      marginBottom: 20,
    },
    existingHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    existingTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    editButton: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: "600",
    },
    guardianRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
    },
    guardianRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    guardianInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    guardianBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: withAlpha(colors.accent, 0.15),
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.3),
      alignItems: "center",
      justifyContent: "center",
    },
    guardianBadgeText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "700",
    },
    guardianAddress: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: "monospace",
      flex: 1,
    },
    guardianSummary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: withAlpha(colors.accent, 0.1),
      borderRadius: 12,
      padding: 14,
      marginTop: 16,
    },
    guardianSummaryText: {
      color: colors.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    syncStatusContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    syncStatusWarning: {
      backgroundColor: withAlpha(colors.warning, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.warning, 0.2),
    },
    syncStatusNeedSync: {
      backgroundColor: withAlpha(colors.accent, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.2),
    },
    syncStatusSynced: {
      backgroundColor: withAlpha(colors.success, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.success, 0.2),
    },
    syncStatusText: {
      color: colors.textSecondary,
      fontSize: 12,
      flex: 1,
      lineHeight: 16,
    },
    syncButton: {
      backgroundColor: colors.accent,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minWidth: 70,
      alignItems: "center",
    },
    syncButtonText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "600",
    },
    payloadBox: {
      marginTop: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 14,
      backgroundColor: withAlpha(colors.surfaceCard, 0.6),
      gap: 8,
    },
    payloadTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    payloadRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    payloadLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    payloadValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontFamily: "monospace",
    },
    payloadSubLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 6,
    },
    payloadCode: {
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: "monospace",
      marginTop: 2,
    },
    payloadCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginTop: 20,
      gap: 6,
    },
    payloadHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    actionChip: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: withAlpha(colors.accentAlt, 0.15),
    },
    actionChipText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "600",
      textTransform: "uppercase",
    },
    moduleCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 20,
      marginBottom: 20,
      gap: 14,
    },
    moduleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    moduleTitle: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "700",
    },
    refreshButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.borderMuted, 0.5),
    },
    moduleDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    moduleStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 10,
    },
    moduleStatusInstalled: {
      backgroundColor: withAlpha(colors.success, 0.15),
    },
    moduleStatusIdle: {
      backgroundColor: withAlpha(colors.accent, 0.12),
    },
    moduleStatusWarning: {
      backgroundColor: withAlpha(colors.warning, 0.15),
    },
    moduleStatusText: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    moduleHint: {
      color: colors.textMuted,
      fontSize: 12,
    },
    moduleError: {
      color: colors.danger,
      fontSize: 12,
    },
    hashRow: {
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
      borderRadius: 12,
      padding: 10,
      marginTop: 4,
    },
    hashLabel: {
      color: colors.textMuted,
      fontSize: 11,
      marginBottom: 2,
    },
    hashValue: {
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: "monospace",
    },
    installButton: {
      marginTop: 8,
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    installButtonDisabled: {
      opacity: 0.6,
    },
    installButtonText: {
      color: colors.background,
      fontSize: 15,
      fontWeight: "700",
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: withAlpha(colors.background, 0.85),
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    helpCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      marginTop: 8,
      gap: 8,
    },
    helpTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    helpText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 20,
      paddingBottom: 40,
    },
    recoverySimCard: {
      backgroundColor: withAlpha(colors.accent, 0.05),
      borderRadius: 24,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.2),
      padding: 20,
      marginBottom: 20,
      gap: 14,
    },
    shareLinkButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: withAlpha(colors.accent, 0.1),
      borderRadius: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.3),
    },
    shareLinkButtonText: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: "700",
    },
    activeHashContainer: {
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.borderMuted,
    },
  });

export default GuardianRecoveryScreen;
