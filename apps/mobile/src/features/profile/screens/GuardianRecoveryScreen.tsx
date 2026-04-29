import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SocialRecoveryService } from "@/src/features/wallet/services/SocialRecoveryService";
import LocalSignerService from "@/src/features/wallet/services/LocalSignerService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { useRecoveryStatusStore } from "@store/useRecoveryStatusStore";
import type { Guardian } from "@store/useRecoveryStatusStore";
import { GuardianSyncService } from "../services/GuardianSyncService";
import { useUserStore } from "@store/useUserStore";
import { isAddress, type Address, type Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

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
  const storedSmartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const smartAccountDeployed = useUserStore((state) => state.smartAccountDeployed);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);
  const {
    guardians: storedGuardians,
    requiredSignatures,
    totalGuardians,
    setGuardians,
    clearGuardians,
  } = useRecoveryStatusStore();
  const smartAccountAddress = useMemo(() => {
    const address = aaAccount?.predictedAddress ?? storedSmartAccountAddress ?? undefined;
    return address ? (address as Address) : undefined;
  }, [aaAccount?.predictedAddress, storedSmartAccountAddress]);
  const isAccountDeployed = Boolean(
    aaAccount?.isDeployed ?? smartAccountDeployed ?? false,
  );
  const resolvedChainId = useMemo<SupportedChainId>(
    () => (aaAccount?.chainId ?? activeChainId ?? DEFAULT_CHAIN_ID) as SupportedChainId,
    [aaAccount?.chainId, activeChainId],
  );
  const smartAccountReady = Boolean(smartAccountAddress && isAccountDeployed);

  const defaultN = 3;
  const [mValue, setMValue] = useState(storedGuardians.length > 0 ? requiredSignatures.toString() : "2");
  const [nValue, setNValue] = useState(storedGuardians.length > 0 ? totalGuardians.toString() : "3");
  const [guardianAddresses, setGuardianAddresses] = useState<string[]>(() => {
    if (storedGuardians.length > 0) {
      return storedGuardians.map((g) => g.address);
    }
    return Array(defaultN).fill("");
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<"form" | "list">(
    storedGuardians.length > 0 ? "list" : "form"
  );
  // TODO(TESTING): Timelock selector - hardcoded to 1 day in production
  const TIMELOCK_OPTIONS = [
    { label: "5 min", seconds: 300 },
    { label: "30 min", seconds: 1800 },
    { label: "1 hour", seconds: 3600 },
    { label: "1 day", seconds: 86400 },
  ];
  const [selectedTimelockIdx, setSelectedTimelockIdx] = useState(3); // default 1 day
  const [syncStatus, setSyncStatus] = useState<{
    hasWalletMetadata: boolean;
    walletMarkedDeployed: boolean;
    isSynced: boolean;
    localGuardians: number;
    dbGuardians: number;
  } | null>(null);
  const [moduleStatusNonce, setModuleStatusNonce] = useState(0);
  const [checkingModule, setCheckingModule] = useState(false);
  const [moduleInstalledState, setModuleInstalledState] = useState<boolean | null>(null);
  const [installingModule, setInstallingModule] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [lastUserOpHash, setLastUserOpHash] = useState<Hex | null>(null);
  const [lastOperationHash, setLastOperationHash] = useState<Hex | null>(null);
  const [lastInstallPayload, setLastInstallPayload] = useState<UserOperation<"0.7"> | null>(null);
  const [moduleStatusWarning, setModuleStatusWarning] = useState<string | null>(null);
  const [checkingLocalSigner, setCheckingLocalSigner] = useState(true);
  const [canSignForWallet, setCanSignForWallet] = useState(false);
  const savedGuardianAddresses = useMemo(
    () => storedGuardians.map((g) => g.address.trim()).filter(Boolean),
    [storedGuardians],
  );
  const guardiansReady = savedGuardianAddresses.length > 0 && requiredSignatures <= savedGuardianAddresses.length;

  useEffect(() => {
    let cancelled = false;

    const loadLocalSigner = async () => {
      if (!user?.id) {
        if (!cancelled) {
          setCanSignForWallet(false);
          setCheckingLocalSigner(false);
        }
        return;
      }

      const signerStatus = await LocalSignerService.getWalletSignerStatus({
        userId: user.id,
        smartAccountAddress: smartAccountAddress ?? null,
        chainId: resolvedChainId,
        expectedPasskeyId: aaAccount?.ownerAddress ?? null,
      });
      if (!cancelled) {
        setCanSignForWallet(signerStatus.canSignForWallet);
        setCheckingLocalSigner(false);
      }
    };

    setCheckingLocalSigner(true);
    void loadLocalSigner();

    return () => {
      cancelled = true;
    };
  }, [aaAccount?.ownerAddress, resolvedChainId, smartAccountAddress, user?.id]);

  // Check sync status on mount
  useEffect(() => {
    const checkSync = async () => {
      if (!user?.id) return;
      const status = await GuardianSyncService.getDatabaseGuardianStatus(user.id);
      setSyncStatus(status);
    };
    void checkSync();
  }, [moduleStatusNonce, user?.id]);

  useEffect(() => {
    if (!smartAccountReady || !smartAccountAddress) {
      setModuleInstalledState(null);
      setModuleError(null);
      setModuleStatusWarning(null);
      setCheckingModule(false);
      return;
    }
    let cancelled = false;
    setCheckingModule(true);
    SocialRecoveryService.isModuleInstalled(smartAccountAddress, resolvedChainId)
      .then((installed) => {
        if (!cancelled) {
          setModuleInstalledState(installed);
          setModuleError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setModuleError(error instanceof Error ? error.message : "Failed to read module status");
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
  }, [smartAccountReady, smartAccountAddress, resolvedChainId, moduleStatusNonce]);

  useEffect(() => {
    if (!syncStatus) {
      setModuleStatusWarning(null);
      return;
    }

    if (syncStatus.dbGuardians > 0 && moduleInstalledState === false) {
      setModuleStatusWarning("Saved in database, but not installed on current chain.");
      return;
    }

    if (syncStatus.dbGuardians === 0 && moduleInstalledState) {
      setModuleStatusWarning("Module is active on-chain, but no guardian metadata is saved in the database.");
      return;
    }

    setModuleStatusWarning(null);
  }, [moduleInstalledState, syncStatus]);

  const handleMNChange = useCallback(
    (field: "m" | "n", value: string) => {
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
    },
    []
  );

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
      Alert.alert("Invalid Configuration", "M must be less than or equal to N");
      return;
    }

    const filledAddresses = guardianAddresses.filter((addr) => addr.trim());
    if (filledAddresses.length !== n) {
      Alert.alert("Incomplete", `Please enter all ${n} guardian addresses`);
      return;
    }
    const normalizedAddresses = filledAddresses.map((addr) => addr.trim().toLowerCase());
    const invalidGuardian = normalizedAddresses.find((address) => !isAddress(address));
    if (invalidGuardian) {
      Alert.alert("Invalid Address", `${invalidGuardian} is not a valid Ethereum address.`);
      return;
    }
    if (new Set(normalizedAddresses).size !== normalizedAddresses.length) {
      Alert.alert("Duplicate Guardians", "Each guardian address must be unique.");
      return;
    }

    if (!user?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }
    if (moduleInstalledState && storedGuardians.length > 0) {
      Alert.alert(
        "On-Chain Guardians Active",
        "This screen manages pre-install guardian metadata. Once the module is installed, changing guardians here would drift from the on-chain guardian set. Use the active guardian configuration for recovery, or add an explicit wallet-authorized update flow before changing it.",
      );
      return;
    }

    setIsSubmitting(true);

    // Save guardians locally
    const newGuardians: Guardian[] = guardianAddresses.map((addr, idx) => ({
      id: `guardian-${Date.now()}-${idx}`,
      address: addr.trim().toLowerCase(),
    }));

    setGuardians(newGuardians, m, n);

    // Try to sync to database
    const syncResult = await GuardianSyncService.syncGuardiansToDatabase(user.id);
    
    setIsSubmitting(false);

    if (syncResult.success || syncResult.error === 'AA_WALLET_NOT_DEPLOYED') {
      Alert.alert("Recovery Updated", "Guardian changes were authenticated and synced.");
      // Refresh sync status
      const status = await GuardianSyncService.getDatabaseGuardianStatus(user.id);
      setSyncStatus(status);
    } else {
      Alert.alert(
        "Partially Saved",
        `Guardians saved locally but failed to sync to database. ${syncResult.error ?? "Please try syncing again."}`,
        [{ text: "OK" }]
      );
    }

    setViewMode("list");
  }, [guardianAddresses, mValue, moduleInstalledState, nValue, setGuardians, storedGuardians.length, user?.id]);

  const handleSyncNow = useCallback(async () => {
    if (!user?.id) return;
    
    setIsSyncing(true);
    const result = await GuardianSyncService.syncGuardiansToDatabase(user.id);
    setIsSyncing(false);

    if (result.success || result.error === 'AA_WALLET_NOT_DEPLOYED') {
      Alert.alert("Success", "Guardians synced to database!");
      // Refresh sync status
      const status = await GuardianSyncService.getDatabaseGuardianStatus(user.id);
      setSyncStatus(status);
    } else {
      Alert.alert("Sync Failed", result.error ?? "Failed to sync guardians to database. Please try again later.");
    }
  }, [user?.id]);

  const handleRefreshModuleStatus = useCallback(() => {
    if (!smartAccountReady) return;
    setModuleStatusNonce((nonce) => nonce + 1);
  }, [smartAccountReady]);

  const handleInstallModule = useCallback(async () => {
    if (!smartAccountReady || !smartAccountAddress) {
      Alert.alert("Smart Account Required", "Deploy your smart account before installing guardian recovery.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Authentication Required", "Please sign in to install the social recovery module.");
      return;
    }
    if (!guardiansReady) {
      Alert.alert("Add Guardians", "Save at least one guardian configuration before installing.");
      return;
    }
    const invalidGuardian = savedGuardianAddresses.find((address) => !isAddress(address));
    if (invalidGuardian) {
      Alert.alert("Invalid Address", `${invalidGuardian} is not a valid Ethereum address.`);
      return;
    }

    setInstallingModule(true);
    setModuleError(null);
    setLastUserOpHash(null);
    setLastOperationHash(null);

    try {
      const passkey = await PasskeyService.getPasskey(user.id);
      if (!passkey) {
        throw new Error("No passkey found on this device. Create a passkey in the AA deployment flow first.");
      }

      const guardians = savedGuardianAddresses.map((address) => address as Address);
      // TODO(TESTING): timelockSeconds is selectable for testing; fix to 86400 in production
      const timelockSeconds = TIMELOCK_OPTIONS[selectedTimelockIdx]?.seconds ?? 86400;
      const { userOp, userOpHash } = await SocialRecoveryService.buildInstallModuleUserOp({
        smartAccountAddress,
        guardians,
        threshold: requiredSignatures,
        passkeyId: passkey.credentialIdRaw as Hex,
        chainId: resolvedChainId,
        usePaymaster: true,
        timelockSeconds,
      });

      setLastUserOpHash(userOpHash);

      const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
      const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
      const signedUserOp = { ...userOp, signature: encodedSignature };

      const operationHash = await SocialRecoveryService.submitInstallModuleUserOp({
        signedUserOp,
        chainId: resolvedChainId,
      });
      const receipt = await SocialRecoveryService.waitForInstallModuleReceipt(
        operationHash,
        resolvedChainId,
      );
      if (!receipt.success) {
        throw new Error("Social recovery module installation reverted.");
      }

      setLastOperationHash(operationHash);
      setLastInstallPayload(signedUserOp);
      setModuleInstalledState(true);
      setModuleStatusNonce((nonce) => nonce + 1);
      Alert.alert(
        "Social Recovery Activated",
        "Guardian recovery module installation confirmed on-chain.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to install the social recovery module. Please try again.";
      setModuleError(message);
      Alert.alert("Installation Failed", message);
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
  ]);

  const handleRemoveGuardian = useCallback((id: string) => {
    const targetGuardian = storedGuardians.find((g) => g.id === id);
    if (!targetGuardian) return;
    if (moduleInstalledState) {
      Alert.alert(
        "On-Chain Guardians Active",
        "Guardian removal is locked here once the recovery module is installed. Changing the live guardian set needs a wallet-authorized on-chain update, not a local metadata edit.",
      );
      return;
    }
    if (storedGuardians.length <= 1) {
      Alert.alert("Minimum Required", "You need at least one guardian configured at all times.");
      return;
    }
    Alert.alert("Remove Guardian", "Are you sure you want to remove this guardian?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
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
    ]);
  }, [clearGuardians, mValue, moduleInstalledState, setGuardians, storedGuardians]);

  const handleEditGuardians = useCallback(() => {
    if (moduleInstalledState) {
      Alert.alert(
        "On-Chain Guardians Active",
        "Editing is locked after module installation so this screen cannot silently diverge from the guardian set enforced on-chain.",
      );
      return;
    }
    setNValue(storedGuardians.length.toString());
    setGuardianAddresses(storedGuardians.map((g) => g.address));
    setViewMode("form");
  }, [moduleInstalledState, storedGuardians]);

  if (checkingLocalSigner || !canSignForWallet) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Guardian Recovery</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.blockedCard}>
            {checkingLocalSigner ? (
              <>
                <ActivityIndicator size="small" color={colors.accentAlt} />
                <Text style={styles.blockedTitle}>Checking local signer access...</Text>
                <Text style={styles.blockedText}>
                  Trezo is verifying whether this device has a wallet passkey for guardian setup.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.blockedTitle}>This device cannot manage guardians yet</Text>
                <Text style={styles.blockedText}>
                  Guardian setup is a wallet-authorized action. This device can read saved guardian
                  metadata from your account, but without an active wallet passkey it cannot
                  install or edit the live guardian set.
                </Text>

                <TouchableOpacity
                  style={styles.blockedPrimaryButton}
                  onPress={() => navigation.navigate("RecoveryEntry" as never)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.blockedPrimaryButtonText}>Open recovery options</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.blockedSecondaryButton}
                  onPress={() => navigation.navigate("BackupRecovery" as never)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.blockedSecondaryButtonText}>Back to backup & recovery</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }
  if (!isAccountDeployed) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Guardian Recovery</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.blockedCard}>
            <Feather name="alert-circle" size={40} color={colors.warning} style={{ marginBottom: 16 }} />
            <Text style={styles.blockedTitle}>Deploy Your Wallet First</Text>
            <Text style={styles.blockedText}>
              Guardian recovery is an on-chain feature. Your wallet address exists but is not yet
              deployed to the network. Deploy your smart account to enable recovery configuration.
            </Text>
            {smartAccountAddress && (
              <Text style={[styles.blockedText, { fontFamily: 'monospace', fontSize: 12, marginTop: 8 }]}>
                {smartAccountAddress.slice(0, 10)}...{smartAccountAddress.slice(-8)}
              </Text>
            )}
            <TouchableOpacity
              style={styles.blockedPrimaryButton}
              onPress={() => navigation.navigate('DeployAccount' as never)}
              activeOpacity={0.85}
            >
              <Text style={styles.blockedPrimaryButtonText}>Deploy Wallet</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guardian Recovery</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === "form" && (
          <View style={styles.configCard}>
            <View style={styles.configHeader}>
              <Text style={styles.configTitle}>Configure Guardians</Text>
            </View>

            <Text style={styles.configDesc}>
              Set up M-of-N guardian recovery. M guardians out of N total must approve to recover
              your wallet.
            </Text>

            <View style={styles.mnContainer}>
              <View style={styles.mnInputGroup}>
                <Text style={styles.mnLabel}>Required (M)</Text>
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
                <Text style={styles.mnLabel}>Total (N)</Text>
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
              <Text style={styles.addressesLabel}>Guardian Addresses</Text>
              {guardianAddresses.map((address, index) => (
                <View key={index} style={styles.addressInputWrapper}>
                  <Text style={styles.addressIndex}>{index + 1}</Text>
                  <TextInput
                    style={styles.addressInput}
                    value={address}
                    onChangeText={(val) => handleAddressChange(index, val)}
                    placeholder={`0x... (Guardian ${index + 1})`}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Save Guardians</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {viewMode === "list" && (
          <View style={styles.existingCard}>
            <View style={styles.existingHeader}>
              <Text style={styles.existingTitle}>Current Guardians</Text>
              <TouchableOpacity onPress={handleEditGuardians}>
                <Text style={styles.editButton}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Sync Status Indicator */}
            {syncStatus && (
              <View style={[
                styles.syncStatusContainer,
                !syncStatus.hasWalletMetadata ? styles.syncStatusWarning :
                !syncStatus.isSynced ? styles.syncStatusNeedSync :
                styles.syncStatusSynced
              ]}>
                <Feather 
                  name={
                    !syncStatus.hasWalletMetadata ? "database" :
                    !syncStatus.isSynced ? "upload-cloud" :
                    "check-circle"
                  } 
                  size={16} 
                  color={
                    !syncStatus.hasWalletMetadata ? colors.warning :
                    !syncStatus.isSynced ? colors.accentAlt :
                    colors.success
                  } 
                />
                <Text style={styles.syncStatusText}>
                  {!syncStatus.hasWalletMetadata 
                    ? "No wallet metadata saved in the database yet."
                    : syncStatus.dbGuardians === 0
                    ? "Wallet metadata exists, but guardian configuration is not saved in the database."
                    : !syncStatus.isSynced
                    ? `Database has ${syncStatus.dbGuardians} guardian(s); this device has ${syncStatus.localGuardians}.`
                    : `Database synced with ${syncStatus.dbGuardians} guardian(s).`}
                </Text>
                {syncStatus.hasWalletMetadata && !syncStatus.isSynced && (
                  <TouchableOpacity 
                    onPress={handleSyncNow}
                    disabled={isSyncing}
                    style={styles.syncButton}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color={colors.accentAlt} />
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
                  index < storedGuardians.length - 1 && styles.guardianRowBorder,
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
                <TouchableOpacity onPress={() => handleRemoveGuardian(guardian.id)}>
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.guardianSummary}>
              <Feather name="info" size={16} color={colors.accentAlt} />
              <Text style={styles.guardianSummaryText}>
                {requiredSignatures} of {storedGuardians.length} guardians required for recovery
              </Text>
            </View>
          </View>
        )}
        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <Text style={styles.moduleTitle}>Social Recovery Module</Text>
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
                  color={smartAccountReady ? colors.accentAlt : colors.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.moduleDescription}>
            Install the on-chain guardian recovery module so your saved M-of-N guardian list can recover
            the wallet if you lose access.
          </Text>
          {moduleInstalledState && (
            <Text style={styles.moduleHint}>
              Guardian edits are locked here after installation so the app cannot drift away from the on-chain policy enforced by the module.
            </Text>
          )}
          {syncStatus && (
            <View
              style={[
                styles.syncStatusContainer,
                syncStatus.dbGuardians > 0 ? styles.syncStatusSynced : styles.syncStatusWarning,
              ]}
            >
              <Feather
                name="database"
                size={16}
                color={syncStatus.dbGuardians > 0 ? colors.success : colors.warning}
              />
              <Text style={styles.syncStatusText}>
                {syncStatus.dbGuardians > 0
                  ? `Database status: ${syncStatus.dbGuardians} guardian(s) saved${syncStatus.walletMarkedDeployed ? "" : ", but wallet metadata is not marked deployed on this chain."}`
                  : syncStatus.hasWalletMetadata
                    ? "Database status: wallet metadata exists, but no guardian configuration is saved."
                    : "Database status: no wallet metadata saved yet."}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.moduleStatusBadge,
              moduleInstalledState ? styles.moduleStatusInstalled : styles.moduleStatusIdle,
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
                ? "Deploy smart account to enable recovery"
                : checkingModule
                ? "Checking module status..."
                : moduleInstalledState
                ? "On-chain status: module installed"
                : "On-chain status: module not installed"}
            </Text>
          </View>
          {moduleError && <Text style={styles.moduleError}>{moduleError}</Text>}
          {moduleStatusWarning && <Text style={styles.moduleError}>{moduleStatusWarning}</Text>}
          {!smartAccountReady && (
            <Text style={styles.moduleHint}>
              Deploy your smart account first. Module installation requires an on-chain contract.
            </Text>
          )}
          {smartAccountReady && !guardiansReady && (
            <Text style={styles.moduleHint}>
              Add and save guardians (at least {requiredSignatures}) before installing.
            </Text>
          )}
          {lastUserOpHash && (
            <View style={styles.hashRow}>
              <Text style={styles.hashLabel}>UserOp Hash</Text>
              <Text style={styles.hashValue}>{lastUserOpHash}</Text>
            </View>
          )}
          {lastOperationHash && (
            <View style={styles.hashRow}>
              <Text style={styles.hashLabel}>Bundler Operation Hash</Text>
              <Text style={styles.hashValue}>{lastOperationHash}</Text>
            </View>
          )}
          {lastInstallPayload && (
            <View style={styles.payloadBox}>
              <Text style={styles.payloadTitle}>Latest Module Payload</Text>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Sender</Text>
                <Text style={styles.payloadValue}>{shortenHex(lastInstallPayload.sender)}</Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Nonce</Text>
                <Text style={styles.payloadValue}>{String(lastInstallPayload.nonce)}</Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Paymaster</Text>
                <Text style={styles.payloadValue}>
                  {lastInstallPayload.paymaster ? shortenHex(lastInstallPayload.paymaster) : "Not Sponsored"}
                </Text>
              </View>
              <Text style={styles.payloadSubLabel}>Call Data</Text>
              <Text style={styles.payloadCode}>{shortenHex(lastInstallPayload.callData, 16)}</Text>
              <Text style={styles.payloadSubLabel}>Signature</Text>
              <Text style={styles.payloadCode}>{shortenHex(lastInstallPayload.signature, 20)}</Text>
            </View>
          )}
          {/* TODO(TESTING): Timelock picker — remove before production */}
          {!moduleInstalledState && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.payloadLabel, { marginBottom: 8 }]}>
                ⏱ Timelock (testing only)
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {TIMELOCK_OPTIONS.map((opt, idx) => (
                  <TouchableOpacity
                    key={opt.label}
                    onPress={() => setSelectedTimelockIdx(idx)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: idx === selectedTimelockIdx ? colors.accentAlt : colors.border,
                      backgroundColor: idx === selectedTimelockIdx ? colors.accentAlt + '20' : colors.surface,
                    }}
                  >
                    <Text style={{
                      color: idx === selectedTimelockIdx ? colors.accentAlt : colors.textSecondary,
                      fontWeight: '700',
                      fontSize: 13,
                    }}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.installButton,
              (!smartAccountReady || !guardiansReady || moduleInstalledState || installingModule) &&
                styles.installButtonDisabled,
            ]}
            disabled={!smartAccountReady || !guardiansReady || moduleInstalledState || installingModule}
            onPress={handleInstallModule}
            activeOpacity={0.85}
          >
            {installingModule ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.installButtonText}>
                {moduleInstalledState ? "Module Installed" : "Install Social Recovery"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accentAlt} />
          <Text style={styles.loadingText}>Saving guardians…</Text>
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
    blockedCard: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: withAlpha(colors.warning, 0.28),
      backgroundColor: withAlpha(colors.warning, 0.1),
      padding: 20,
      gap: 12,
      marginTop: 16,
    },
    blockedTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
      lineHeight: 28,
    },
    blockedText: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 22,
    },
    blockedPrimaryButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    blockedPrimaryButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
    },
    blockedSecondaryButton: {
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.borderMuted,
      backgroundColor: colors.surfaceCard,
    },
    blockedSecondaryButtonText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    configCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginTop: 8,
    },
    configHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    configTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
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
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: "monospace",
    },
    submitButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 24,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
    },
    existingCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginTop: 8,
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
      color: colors.accentAlt,
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
      backgroundColor: withAlpha(colors.accentAlt, 0.15),
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.3),
      alignItems: "center",
      justifyContent: "center",
    },
    guardianBadgeText: {
      color: colors.accentAlt,
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
      backgroundColor: withAlpha(colors.accentAlt, 0.1),
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
      backgroundColor: withAlpha(colors.accentAlt, 0.1),
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
      backgroundColor: colors.accentAlt,
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
    moduleCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginTop: 20,
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
      backgroundColor: withAlpha(colors.accentAlt, 0.12),
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
      backgroundColor: colors.accentAlt,
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
  });

export default GuardianRecoveryScreen;
