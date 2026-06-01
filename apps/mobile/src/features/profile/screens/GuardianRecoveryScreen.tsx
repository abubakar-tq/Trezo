import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
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
import { FontFamilies } from "@shared/components/TokenRegistry";

import { useRecoveryStatusStore } from "@store/useRecoveryStatusStore";
import type { Guardian } from "@store/useRecoveryStatusStore";
import { GuardianSyncService } from "../services/GuardianSyncService";
import { useUserStore } from "@store/useUserStore";
import { isAddress, type Address, type Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";
import { GuardianUpdateModal } from "./GuardianUpdateModal";
import type { RootStackParamList } from "@/src/types/navigation";

const shortenHex = (value: string | null | undefined, chars = 6) => {
  if (!value) return "—";
  if (value.length <= chars * 2 + 2) return value;
  return `${value.slice(0, chars + 2)}…${value.slice(-chars)}`;
};

const shortenAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

// TODO(TESTING): Timelock selector - hardcode to 1 day before production.
const TIMELOCK_OPTIONS = [
  { label: "5 min", seconds: 300 },
  { label: "30 min", seconds: 1800 },
  { label: "1 hour", seconds: 3600 },
  { label: "1 day", seconds: 86400 },
] as const;

const GuardianRecoveryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
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
  const [viewMode, setViewMode] = useState<"form" | "list">(
    storedGuardians.length > 0 ? "list" : "form"
  );
  const [selectedTimelockIdx, setSelectedTimelockIdx] = useState(3); // default 1 day
  const [moduleStatusNonce, setModuleStatusNonce] = useState(0);
  const [checkingModule, setCheckingModule] = useState(false);
  const [moduleInstalledState, setModuleInstalledState] = useState<boolean | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [onChainGuardians, setOnChainGuardians] = useState<readonly Address[]>([]);
  const [onChainThreshold, setOnChainThreshold] = useState<bigint>(0n);
  const [installingModule, setInstallingModule] = useState(false);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [lastUserOpHash, setLastUserOpHash] = useState<Hex | null>(null);
  const [lastOperationHash, setLastOperationHash] = useState<Hex | null>(null);
  const [lastInstallPayload, setLastInstallPayload] = useState<UserOperation<"0.7"> | null>(null);
  const [checkingLocalSigner, setCheckingLocalSigner] = useState(true);
  const [canSignForWallet, setCanSignForWallet] = useState(false);

  const guardianCount = moduleInstalledState ? onChainGuardians.length : storedGuardians.length;

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

  useEffect(() => {
    if (!smartAccountReady || !smartAccountAddress) {
      setModuleInstalledState(null);
      setModuleError(null);
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
    if (!moduleInstalledState || !smartAccountAddress) {
      setOnChainGuardians([]);
      setOnChainThreshold(0n);
      return;
    }
    let cancelled = false;
    SocialRecoveryService.getRecoveryDetails(smartAccountAddress, resolvedChainId)
      .then((details) => {
        if (cancelled) return;
        setOnChainGuardians(details.guardians);
        setOnChainThreshold(details.threshold);
      })
      .catch((err) => {
        console.warn("[GuardianRecovery] getRecoveryDetails failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, [moduleInstalledState, smartAccountAddress, resolvedChainId, moduleStatusNonce]);

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
    } else {
      Alert.alert(
        "Partially Saved",
        `Guardians saved locally but failed to sync to database. ${syncResult.error ?? "Please try syncing again."}`,
        [{ text: "OK" }]
      );
    }

    setViewMode("list");
  }, [guardianAddresses, mValue, moduleInstalledState, nValue, setGuardians, storedGuardians.length, user?.id]);

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
      // Timelock is fixed to 1 day in production; the __DEV__ picker only changes it for testing.
      const timelockSeconds = __DEV__ ? (TIMELOCK_OPTIONS[selectedTimelockIdx]?.seconds ?? 86400) : 86400;
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
      const raw = error instanceof Error ? error.message : String(error);
      // The SmartAccount's ModuleManager reverts "MM: EXECUTOR_EXISTS" when
      // re-installing an already-installed executor. Convert that into a
      // helpful message + refresh the local state instead of showing the
      // raw viem RPC blob.
      const alreadyInstalled =
        raw.includes("MM: EXECUTOR_EXISTS") ||
        raw.includes("4d4d3a204558454355544f525f4558495354"); // hex of the string above
      if (alreadyInstalled) {
        setModuleInstalledState(true);
        setModuleStatusNonce((nonce) => nonce + 1);
        setModuleError(null);
        Alert.alert(
          "Module Already Installed",
          "The social recovery module is already active on this wallet. No need to install it again — open Backup & Recovery → Guardian Recovery to view or update guardians.",
        );
      } else {
        setModuleError(raw);
        Alert.alert("Installation Failed", raw);
      }
    } finally {
      setInstallingModule(false);
    }
  }, [
    guardiansReady,
    resolvedChainId,
    requiredSignatures,
    savedGuardianAddresses,
    selectedTimelockIdx,
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
          <Text style={styles.headerTitle}>Guardians</Text>
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
                <ActivityIndicator size="small" color={colors.accent} />
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
                  onPress={() =>
                    navigation.canGoBack()
                      ? navigation.goBack()
                      : navigation.navigate("RecoveryEntry", { reason: "no_local_passkey" })
                  }
                  activeOpacity={0.85}
                >
                  <Text style={styles.blockedPrimaryButtonText}>Open recovery options</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.blockedSecondaryButton}
                  onPress={() => navigation.navigate("BackupRecovery")}
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
          <Text style={styles.headerTitle}>Guardians</Text>
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
              <Text style={[styles.blockedText, { fontFamily: FontFamilies.mono, fontSize: 12, marginTop: 8 }]}>
                {smartAccountAddress.slice(0, 10)}...{smartAccountAddress.slice(-8)}
              </Text>
            )}
            <TouchableOpacity
              style={styles.blockedPrimaryButton}
              onPress={() => navigation.navigate("DeployAccount")}
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guardians</Text>
        <TouchableOpacity
          onPress={handleRefreshModuleStatus}
          style={styles.refreshButton}
          disabled={!smartAccountReady || checkingModule}
        >
          {checkingModule ? (
            <ActivityIndicator size="small" color={colors.textMuted} />
          ) : (
            <Feather
              name="refresh-ccw"
              size={16}
              color={smartAccountReady ? colors.textMuted : colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Summary card */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16 }}>
            <View style={styles.icChip}>
              <Feather name="shield" size={17} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>
                {moduleInstalledState ? "Social recovery is on" : "Social recovery is off"}
              </Text>
              <Text style={styles.summaryMeta}>
                {moduleInstalledState && guardianCount > 0
                  ? `${requiredSignatures} of ${guardianCount} guardians required`
                  : "Set up guardians to enable recovery"}
              </Text>
            </View>
            {moduleInstalledState !== null && (
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: moduleInstalledState ? colors.success : colors.textMuted,
                ...(moduleInstalledState ? { shadowColor: colors.success, shadowOpacity: 0.5, shadowRadius: 4, elevation: 2 } : {}),
              }} />
            )}
            {checkingModule && <ActivityIndicator size="small" color={colors.textMuted} />}
          </View>
        </View>

        {/* Form mode: configure guardians */}
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
                <ActivityIndicator size="small" color={colors.textOnAccent} />
              ) : (
                <Text style={styles.submitButtonText}>Save Guardians</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* List mode: guardian rows */}
        {viewMode === "list" && storedGuardians.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>YOUR GUARDIANS</Text>
            <View style={styles.card}>
              {storedGuardians.map((guardian, index) => {
                const isOnChain = moduleInstalledState && onChainGuardians.some(
                  (a) => a.toLowerCase() === guardian.address.toLowerCase()
                );
                const statusLabel = isOnChain ? "Active" : (moduleInstalledState ? "Active" : "Pending");
                const isActive = !moduleInstalledState || isOnChain;

                return (
                  <View
                    key={guardian.id}
                    style={[
                      styles.guardianRow,
                      index < storedGuardians.length - 1 && styles.guardianRowBorder,
                    ]}
                  >
                    <View style={styles.guardianInfo}>
                      <View style={styles.guardianBadge}>
                        <Text style={styles.guardianBadgeText}>0x</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.guardianAddress}>
                          {shortenAddr(guardian.address)}
                        </Text>
                        <Text style={[
                          styles.csub,
                          !isActive && { color: colors.warning },
                        ]}>
                          {statusLabel}
                          {!isActive && " ●"}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveGuardian(guardian.id)}
                      style={styles.removeBtn}
                    >
                      <Text style={styles.removeBtnText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Add guardian row */}
              {!moduleInstalledState && (
                <TouchableOpacity
                  style={styles.addGuardianRow}
                  onPress={handleEditGuardians}
                  activeOpacity={0.7}
                >
                  <Feather name="plus" size={16} color={colors.accent} />
                  <Text style={styles.addGuardianText}>Add a guardian</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {/* Update guardians on-chain CTA */}
        {moduleInstalledState && onChainGuardians.length > 0 && (
          <TouchableOpacity
            onPress={() => setUpdateModalOpen(true)}
            style={styles.updateGuardiansBtn}
          >
            <Feather name="zap" size={16} color={colors.textOnAccent} />
            <Text style={styles.updateGuardiansBtnText}>Update Guardians On-Chain</Text>
          </TouchableOpacity>
        )}

        {/* Settings section */}
        <Text style={styles.sectionLabel}>SETTINGS</Text>
        <View style={styles.card}>
          <View style={styles.thresholdRow}>
            <View style={styles.thresholdIconWrap}>
              <Feather name="settings" size={15} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.thresholdLabel}>Threshold</Text>
              <Text style={styles.thresholdMeta}>
                {mValue} of {storedGuardians.length > 0 ? storedGuardians.length : nValue} must approve
              </Text>
            </View>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleMNChange("m", Math.max(1, parseInt(mValue) - 1).toString())}
                disabled={parseInt(mValue) <= 1}
              >
                <Feather name="minus" size={14} color={parseInt(mValue) <= 1 ? colors.textMuted : colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{mValue}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleMNChange("m", Math.min(
                  storedGuardians.length > 0 ? storedGuardians.length : parseInt(nValue),
                  parseInt(mValue) + 1
                ).toString())}
                disabled={parseInt(mValue) >= (storedGuardians.length > 0 ? storedGuardians.length : parseInt(nValue))}
              >
                <Feather name="plus" size={14} color={
                  parseInt(mValue) >= (storedGuardians.length > 0 ? storedGuardians.length : parseInt(nValue))
                    ? colors.textMuted
                    : colors.textPrimary
                } />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Safety delay note */}
        <Text style={styles.safetyNote}>
          A 24-hour safety delay applies before guardian changes take effect.
        </Text>

        {/* Module errors */}
        {moduleError && <Text style={styles.moduleError}>{moduleError}</Text>}

        {/* DEV: debug payload blocks */}
        {__DEV__ && lastUserOpHash && (
          <View style={styles.hashRow}>
            <Text style={styles.hashLabel}>UserOp Hash</Text>
            <Text style={styles.hashValue}>{lastUserOpHash}</Text>
          </View>
        )}
        {__DEV__ && lastOperationHash && (
          <View style={styles.hashRow}>
            <Text style={styles.hashLabel}>Bundler Operation Hash</Text>
            <Text style={styles.hashValue}>{lastOperationHash}</Text>
          </View>
        )}
        {__DEV__ && lastInstallPayload && (
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
        {__DEV__ && !moduleInstalledState && (
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
                    borderColor: idx === selectedTimelockIdx ? colors.accent : colors.border,
                    backgroundColor: idx === selectedTimelockIdx ? colors.accent + '20' : colors.surface,
                  }}
                >
                  <Text style={{
                    color: idx === selectedTimelockIdx ? colors.accent : colors.textSecondary,
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

        {/* Install CTA */}
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
            <ActivityIndicator size="small" color={colors.textOnAccent} />
          ) : (
            <Text style={styles.installButtonText}>
              {moduleInstalledState ? "Module Installed" : "Install Social Recovery"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loadingText}>Saving guardians…</Text>
        </View>
      )}
      {updateModalOpen && smartAccountAddress && onChainGuardians.length > 0 && (
        <GuardianUpdateModal
          visible={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
          onSuccess={() => {
            setUpdateModalOpen(false);
            setModuleStatusNonce((n) => n + 1);
          }}
          smartAccountAddress={smartAccountAddress as Address}
          currentGuardians={onChainGuardians}
          currentThreshold={onChainThreshold}
          chainId={resolvedChainId}
        />
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
    refreshButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${colors.borderMuted}80`,
    },
    blockedCard: {
      borderRadius: 24,
      borderWidth: 1,
      borderColor: `${colors.warning}47`,
      backgroundColor: `${colors.warning}1A`,
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
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    blockedPrimaryButtonText: {
      color: colors.textOnAccent,
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
    // Summary card
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      overflow: "hidden",
    },
    icChip: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: `${colors.accent}12`,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    summaryMeta: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    // Section labels
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.8,
      marginTop: 24,
      marginBottom: 8,
      paddingHorizontal: 4,
    },
    // Guardian rows
    guardianRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    guardianRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderMuted,
    },
    guardianInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    guardianBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: `${colors.accent}10`,
      alignItems: "center",
      justifyContent: "center",
    },
    guardianBadgeText: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "700",
      fontFamily: FontFamilies.mono,
    },
    guardianAddress: {
      color: colors.textPrimary,
      fontSize: 13,
      fontFamily: FontFamilies.monoMedium,
      fontWeight: "500",
    },
    csub: {
      color: colors.success,
      fontSize: 11,
      fontWeight: "500",
      marginTop: 2,
    },
    removeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    removeBtnText: {
      color: colors.danger,
      fontSize: 12,
      fontWeight: "600",
    },
    addGuardianRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderMuted,
    },
    addGuardianText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "500",
    },
    // Update guardians CTA
    updateGuardiansBtn: {
      marginTop: 12,
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
    },
    updateGuardiansBtnText: {
      color: colors.textOnAccent,
      fontWeight: "800",
      fontSize: 15,
    },
    // Settings / threshold row
    thresholdRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    thresholdIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: `${colors.accent}12`,
      alignItems: "center",
      justifyContent: "center",
    },
    thresholdLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    thresholdMeta: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stepperBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: `${colors.textPrimary}0F`,
      alignItems: "center",
      justifyContent: "center",
    },
    stepperValue: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      minWidth: 20,
      textAlign: "center",
    },
    safetyNote: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 12,
      paddingHorizontal: 4,
    },
    // Form card
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
      backgroundColor: `${colors.textPrimary}0F`,
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
      backgroundColor: `${colors.textPrimary}0F`,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: FontFamilies.mono,
    },
    submitButton: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 24,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: colors.textOnAccent,
      fontSize: 16,
      fontWeight: "700",
    },
    // Error / hint
    moduleError: {
      color: colors.danger,
      fontSize: 12,
      marginTop: 4,
      paddingHorizontal: 4,
    },
    // Dev payload
    payloadBox: {
      marginTop: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 14,
      backgroundColor: `${colors.surfaceCard}99`,
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
      fontFamily: FontFamilies.mono,
    },
    payloadSubLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 6,
    },
    payloadCode: {
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: FontFamilies.mono,
      marginTop: 2,
    },
    hashRow: {
      backgroundColor: `${colors.textPrimary}0A`,
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
      fontFamily: FontFamilies.mono,
    },
    // Install CTA
    installButton: {
      marginTop: 16,
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    installButtonDisabled: {
      opacity: 0.6,
    },
    installButtonText: {
      color: colors.textOnAccent,
      fontSize: 15,
      fontWeight: "700",
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: `${colors.background}D9`,
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
