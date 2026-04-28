import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
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
} from "react-native";

import {
    EmailRecoveryService,
    type EmailRecoverySecurityMode,
    type LoadedEmailRecoveryMetadata,
} from "@/src/features/wallet/services/EmailRecoveryService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import {
    DEFAULT_CHAIN_ID,
    type SupportedChainId,
} from "@/src/integration/chains";
import { RootStackParamList } from "@/src/types/navigation";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { isValidEmail } from "@utils/validation";
import { type Address, type Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

const shortenHex = (value: string | null | undefined, chars = 6) => {
  if (!value) return "-";
  if (value.length <= chars * 2 + 2) return value;
  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`;
};

const EmailRecoveryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
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

  const defaultGuardianCount = 3;
  const [guardianCountValue, setGuardianCountValue] = useState("3");
  const [thresholdValue, setThresholdValue] = useState("2");
  const [guardianEmails, setGuardianEmails] = useState<string[]>(() =>
    Array(defaultGuardianCount).fill(""),
  );
  const [guardianWeights, setGuardianWeights] = useState<string[]>(() =>
    Array(defaultGuardianCount).fill("1"),
  );
  const [delayDays, setDelayDays] = useState("1");
  const [expiryDays, setExpiryDays] = useState("3");
  const [securityMode, setSecurityMode] =
    useState<EmailRecoverySecurityMode>("none");
  const [vaultKeyInput, setVaultKeyInput] = useState("");
  const [hasVaultKey, setHasVaultKey] = useState(false);

  const [checkingModule, setCheckingModule] = useState(false);
  const [moduleInstalledState, setModuleInstalledState] = useState<
    boolean | null
  >(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleStatusNonce, setModuleStatusNonce] = useState(0);
  const [installingModule, setInstallingModule] = useState(false);
  const [lastUserOpHash, setLastUserOpHash] = useState<Hex | null>(null);
  const [lastOperationHash, setLastOperationHash] = useState<Hex | null>(null);
  const [lastInstallPayload, setLastInstallPayload] =
    useState<UserOperation<"0.7"> | null>(null);
  const [derivedGuardians, setDerivedGuardians] = useState<
    { email: string; guardianAddress: Address }[]
  >([]);
  const [loadingStoredMetadata, setLoadingStoredMetadata] = useState(false);
  const [storedMetadata, setStoredMetadata] =
    useState<LoadedEmailRecoveryMetadata | null>(null);
  const [metadataWarning, setMetadataWarning] = useState<string | null>(null);

  const installStatusLabel = useMemo(() => {
    const status =
      storedMetadata?.installations.find(
        (i) => i.chainId === Number(resolvedChainId),
      )?.installStatus ?? "not_installed";
    switch (status) {
      case "installed":
        return "Active";
      case "pending":
        return "Pending";
      default:
        return "Not active";
    }
  }, [resolvedChainId, storedMetadata]);

  const expectedGuardians = useMemo(
    () => Math.max(parseInt(guardianCountValue, 10) || 0, 0),
    [guardianCountValue],
  );
  const trimmedGuardians = useMemo(
    () =>
      guardianEmails
        .map((email) => EmailRecoveryService.normalizeGuardianEmail(email))
        .filter(Boolean),
    [guardianEmails],
  );
  const normalizedGuardianWeights = useMemo(
    () =>
      guardianWeights.map((weight) => Math.max(parseInt(weight, 10) || 0, 0)),
    [guardianWeights],
  );
  const totalGuardianWeight = useMemo(
    () => normalizedGuardianWeights.reduce((sum, weight) => sum + weight, 0),
    [normalizedGuardianWeights],
  );
  const hasDuplicateGuardians = useMemo(() => {
    const normalized = trimmedGuardians.map((email) => email.toLowerCase());
    return new Set(normalized).size !== normalized.length;
  }, [trimmedGuardians]);
  const guardiansReady =
    expectedGuardians > 0 && trimmedGuardians.length === expectedGuardians;

  useEffect(() => {
    if (!smartAccountReady || !smartAccountAddress) {
      setModuleInstalledState(null);
      setModuleError(null);
      setCheckingModule(false);
      return;
    }
    let cancelled = false;
    setCheckingModule(true);
    EmailRecoveryService.isModuleInstalled(smartAccountAddress, resolvedChainId)
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
  ]);

  useEffect(() => {
    if (!user?.id || !smartAccountAddress) {
      setStoredMetadata(null);
      setLoadingStoredMetadata(false);
      return;
    }

    let cancelled = false;
    setLoadingStoredMetadata(true);
    EmailRecoveryService.loadMetadata({
      smartAccountAddress,
    })
      .then((metadata) => {
        if (cancelled) return;
        setStoredMetadata(metadata);
        if (!metadata) return;

        const guardianCount = Math.max(metadata.guardians.length, 1);
        setGuardianCountValue(String(guardianCount));
        setThresholdValue(String(metadata.config.threshold));
        setDelayDays(
          String(Math.max(Math.floor(metadata.config.delaySeconds / 86400), 1)),
        );
        setExpiryDays(
          String(
            Math.max(Math.floor(metadata.config.expirySeconds / 86400), 1),
          ),
        );
        setSecurityMode(metadata.config.securityMode ?? "none");
        setGuardianEmails(
          metadata.guardians.map((guardian) => {
            if (guardian.resolvedEmail) return guardian.resolvedEmail;
            if (metadata.config.securityMode === "none")
              return guardian.maskedEmail;
            return "";
          }),
        );
        setGuardianWeights(
          metadata.guardians.map((guardian) =>
            String(Math.max(guardian.weight, 1)),
          ),
        );

        EmailRecoveryService.hasVaultKey(smartAccountAddress)
          .then(setHasVaultKey)
          .catch(() => setHasVaultKey(false));
      })
      .catch((error) => {
        if (cancelled) return;
        setMetadataWarning(
          error instanceof Error
            ? error.message
            : "Failed to load recovery metadata from backend.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStoredMetadata(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [smartAccountAddress, user?.id]);

  useEffect(() => {
    if (
      !storedMetadata ||
      moduleInstalledState === null ||
      !smartAccountAddress
    ) {
      return;
    }

    const currentInstall = storedMetadata.installations.find(
      (i) => i.chainId === Number(resolvedChainId),
    );
    const backendStatus = currentInstall?.installStatus ?? "not_installed";

    if (backendStatus === "installed" && !moduleInstalledState) {
      setMetadataWarning(
        "We see recovery marked active, but this device shows it as inactive. Please verify again.",
      );
      return;
    }
    if (backendStatus !== "installed" && moduleInstalledState) {
      setMetadataWarning(
        "Recovery looks active here, but needs a sync. We'll update it now.",
      );
      EmailRecoveryService.syncCurrentChainInstallStatus({
        configId: storedMetadata.config.id,
        chainId: resolvedChainId,
        installStatus: "installed",
      })
        .then(() => {
          setStoredMetadata((current) => {
            if (!current) return current;
            const updated: LoadedEmailRecoveryMetadata["installations"] =
              current.installations.map((i) =>
                i.chainId === Number(resolvedChainId)
                  ? { ...i, installStatus: "installed" as const }
                  : i,
              );
            if (!updated.find((i) => i.chainId === Number(resolvedChainId))) {
              updated.push({
                chainId: Number(resolvedChainId),
                installStatus: "installed" as const,
                installUserOpHash: null,
                installedAt: new Date().toISOString(),
                lastCheckedAt: new Date().toISOString(),
              });
            }
            return { ...current, installations: updated };
          });
          setMetadataWarning(null);
        })
        .catch(() => {
          // Keep warning visible if backend sync fails.
        });
      return;
    }

    setMetadataWarning(null);
  }, [
    moduleInstalledState,
    resolvedChainId,
    smartAccountAddress,
    storedMetadata,
  ]);

  const handleGuardianCountChange = useCallback((value: string) => {
    const parsed = parseInt(value, 10) || 0;
    setGuardianCountValue(value);
    setDerivedGuardians([]);

    // Instead of deleting extra rows, we just hide them in UI, or expand if more are needed
    setGuardianEmails((current) => {
      if (parsed > current.length) {
        return [...current, ...Array(parsed - current.length).fill("")];
      }
      return current; // Don't wipe previous entries
    });
    setGuardianWeights((current) => {
      if (parsed > current.length) {
        return [...current, ...Array(parsed - current.length).fill("1")];
      }
      return current; // Don't wipe previous entries
    });
  }, []);

  const handleDeleteGuardian = useCallback((index: number) => {
    setGuardianEmails((prev) => prev.filter((_, i) => i !== index));
    setGuardianWeights((prev) => prev.filter((_, i) => i !== index));

    setGuardianCountValue((prev) => {
      const currentVal = parseInt(prev, 10) || 0;
      return String(Math.max(0, currentVal - 1));
    });
    setDerivedGuardians([]);
  }, []);

  const handleGuardianEmailChange = useCallback(
    (index: number, value: string) => {
      setDerivedGuardians([]);
      setGuardianEmails((prev) => {
        const updated = [...prev];
        updated[index] = value;
        return updated;
      });
    },
    [],
  );

  const handleWeightChange = useCallback((index: number, value: string) => {
    setDerivedGuardians([]);
    setGuardianWeights((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const handleRefreshModuleStatus = useCallback(() => {
    if (!smartAccountReady) return;
    setModuleStatusNonce((nonce) => nonce + 1);
  }, [smartAccountReady]);

  const handleSaveToCloud = useCallback(async () => {
    if (!smartAccountReady || !smartAccountAddress) {
      Alert.alert(
        "Trezo account required",
        "Create your Trezo account before syncing.",
      );
      return;
    }
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to sync.");
      return;
    }
    if (!guardiansReady) {
      Alert.alert(
        "Add trusted emails",
        "Fill in all trusted emails before syncing.",
      );
      return;
    }

    const invalidGuardian = trimmedGuardians.find(
      (email) => !isValidEmail(email),
    );
    if (invalidGuardian) {
      Alert.alert(
        "Invalid email",
        `${invalidGuardian} is not a valid email address.`,
      );
      return;
    }

    const parsedThreshold = parseInt(thresholdValue, 10) || 0;
    const parsedDelay = parseInt(delayDays, 10) || 0;
    const parsedExpiry = parseInt(expiryDays, 10) || 0;

    if (parsedThreshold <= 0) {
      Alert.alert(
        "Invalid approval requirement",
        "Approval requirement must be greater than zero.",
      );
      return;
    }

    const computedTotalWeight = guardianWeights
      .slice(0, expectedGuardians)
      .reduce((sum, weight) => sum + (parseInt(weight, 10) || 0), 0);

    if (parsedThreshold > computedTotalWeight) {
      Alert.alert(
        "Approval requirement too high",
        "Approval requirement cannot exceed the total weight.",
      );
      return;
    }

    if (hasDuplicateGuardians) {
      Alert.alert("Duplicate emails", "Each trusted email must be unique.");
      return;
    }
    if (parsedDelay <= 0 || parsedExpiry <= 0) {
      Alert.alert(
        "Invalid timing",
        "Security wait and expiry must be greater than zero.",
      );
      return;
    }
    if (parsedExpiry < parsedDelay) {
      Alert.alert(
        "Invalid timing",
        "Expiry must be greater than or equal to the security wait.",
      );
      return;
    }

    let parsedWeights: bigint[];
    try {
      parsedWeights = guardianWeights.map((weight, index) => {
        const parsed = parseInt(weight, 10) || 0;
        if (parsed <= 0) {
          throw new Error(
            `Weight at row ${index + 1} must be greater than zero.`,
          );
        }
        return BigInt(parsed);
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Weights must be greater than zero.";
      Alert.alert("Invalid weights", message);
      return;
    }

    const totalWeight = parsedWeights.reduce((sum, weight) => sum + weight, 0n);
    if (BigInt(parsedThreshold) > totalWeight) {
      Alert.alert(
        "Invalid approval requirement",
        "Approval requirement cannot exceed the total weight.",
      );
      return;
    }

    setInstallingModule(true);
    try {
      await EmailRecoveryService.persistMetadata({
        userId: user.id,
        smartAccountAddress,
        chainId: resolvedChainId,
        guardianEmails: trimmedGuardians,
        guardianWeights: parsedWeights,
        threshold: BigInt(parsedThreshold),
        delaySeconds: BigInt(parsedDelay) * 86400n,
        expirySeconds: BigInt(parsedExpiry) * 86400n,
        securityMode,
        installStatus: moduleInstalledState ? "installed" : "pending",
        installUserOpHash:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
      });

      const refreshedMetadata = await EmailRecoveryService.loadMetadata({
        smartAccountAddress,
      });
      setStoredMetadata(refreshedMetadata);
      Alert.alert("Sync complete", "Settings synced successfully.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to sync settings.";
      Alert.alert("Sync failed", message);
    } finally {
      setInstallingModule(false);
    }
  }, [
    smartAccountReady,
    smartAccountAddress,
    user?.id,
    guardiansReady,
    trimmedGuardians,
    hasDuplicateGuardians,
    resolvedChainId,
    guardianWeights,
    thresholdValue,
    delayDays,
    expiryDays,
    securityMode,
    moduleInstalledState,
  ]);

  const handleInstallModule = useCallback(async () => {
    if (!smartAccountReady || !smartAccountAddress) {
      Alert.alert(
        "Trezo account required",
        "Create your Trezo account before activating email recovery.",
      );
      return;
    }
    if (!user?.id) {
      Alert.alert(
        "Sign in required",
        "Please sign in to activate email recovery.",
      );
      return;
    }
    if (!guardiansReady) {
      Alert.alert(
        "Add trusted emails",
        "Fill in all trusted emails before activating.",
      );
      return;
    }

    const invalidGuardian = trimmedGuardians.find(
      (email) => !isValidEmail(email),
    );
    if (invalidGuardian) {
      Alert.alert(
        "Invalid email",
        `${invalidGuardian} is not a valid email address.`,
      );
      return;
    }

    const parsedThreshold = parseInt(thresholdValue, 10) || 0;
    const parsedDelay = parseInt(delayDays, 10) || 0;
    const parsedExpiry = parseInt(expiryDays, 10) || 0;

    if (parsedThreshold <= 0) {
      Alert.alert(
        "Invalid approval requirement",
        "Approval requirement must be greater than zero.",
      );
      return;
    }

    const computedTotalWeight = guardianWeights
      .slice(0, expectedGuardians)
      .reduce((sum, weight) => sum + (parseInt(weight, 10) || 0), 0);

    if (parsedThreshold > computedTotalWeight) {
      Alert.alert(
        "Approval requirement too high",
        "Approval requirement cannot exceed the total weight.",
      );
      return;
    }

    if (hasDuplicateGuardians) {
      Alert.alert("Duplicate emails", "Each trusted email must be unique.");
      return;
    }
    if (parsedDelay <= 0 || parsedExpiry <= 0) {
      Alert.alert(
        "Invalid timing",
        "Security wait and expiry must be greater than zero.",
      );
      return;
    }
    if (parsedExpiry < parsedDelay) {
      Alert.alert(
        "Invalid timing",
        "Expiry must be greater than or equal to the security wait.",
      );
      return;
    }

    let parsedWeights: bigint[];
    try {
      parsedWeights = guardianWeights.map((weight, index) => {
        const parsed = parseInt(weight, 10) || 0;
        if (parsed <= 0) {
          throw new Error(
            `Weight at row ${index + 1} must be greater than zero.`,
          );
        }
        return BigInt(parsed);
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Weights must be greater than zero.";
      Alert.alert("Invalid weights", message);
      return;
    }
    const totalWeight = parsedWeights.reduce((sum, weight) => sum + weight, 0n);
    if (BigInt(parsedThreshold) > totalWeight) {
      Alert.alert(
        "Invalid approval requirement",
        "Approval requirement cannot exceed the total weight.",
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

      const derivedGuardians =
        await EmailRecoveryService.deriveGuardianAddresses(
          smartAccountAddress,
          trimmedGuardians,
          resolvedChainId,
        );
      setDerivedGuardians(
        derivedGuardians.map(({ email, guardianAddress }) => ({
          email,
          guardianAddress,
        })),
      );

      const { userOp, userOpHash } =
        await EmailRecoveryService.buildInstallModuleUserOp({
          smartAccountAddress,
          guardians: derivedGuardians.map(
            ({ guardianAddress }) => guardianAddress,
          ),
          weights: parsedWeights,
          threshold: BigInt(parsedThreshold),
          delay: BigInt(parsedDelay) * 86400n,
          expiry: BigInt(parsedExpiry) * 86400n,
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

      const operationHash =
        await EmailRecoveryService.submitInstallModuleUserOp({
          signedUserOp,
          chainId: resolvedChainId,
        });

      await EmailRecoveryService.persistMetadata({
        userId: user.id,
        smartAccountAddress,
        chainId: resolvedChainId,
        guardianEmails: trimmedGuardians,
        guardianWeights: parsedWeights,
        threshold: BigInt(parsedThreshold),
        delaySeconds: BigInt(parsedDelay) * 86400n,
        expirySeconds: BigInt(parsedExpiry) * 86400n,
        securityMode,
        installStatus: "pending",
        installUserOpHash: operationHash,
      });

      const refreshedMetadata = await EmailRecoveryService.loadMetadata({
        smartAccountAddress,
      });
      setStoredMetadata(refreshedMetadata);

      setLastOperationHash(operationHash);
      setLastInstallPayload(signedUserOp);
      setModuleInstalledState(true);
      Alert.alert(
        "Email recovery activated",
        "Email recovery activation was submitted.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to activate email recovery.";
      setModuleError(message);
      Alert.alert("Activation failed", message);
    } finally {
      setInstallingModule(false);
    }
  }, [
    delayDays,
    expiryDays,
    guardiansReady,
    resolvedChainId,
    smartAccountAddress,
    smartAccountReady,
    thresholdValue,
    trimmedGuardians,
    user?.id,
    guardianWeights,
    hasDuplicateGuardians,
    securityMode,
  ]);

  const handleExportRecoveryKit = useCallback(async () => {
    if (!smartAccountAddress) {
      Alert.alert(
        "Trezo account required",
        "Create or load your Trezo account first.",
      );
      return;
    }

    try {
      const vaultKey =
        await EmailRecoveryService.getVaultKeyBase64(smartAccountAddress);
      if (!vaultKey) {
        Alert.alert(
          "No recovery kit found",
          "Enable Extra Security and save recovery once to generate a recovery kit.",
        );
        return;
      }
      navigation.navigate("RecoveryKitExport", {
        vaultKey,
        smartAccountAddress,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load vault key.";
      Alert.alert("Export failed", message);
    }
  }, [navigation, smartAccountAddress]);

  const handleImportVaultKey = useCallback(async () => {
    if (!smartAccountAddress) {
      Alert.alert(
        "Trezo account required",
        "Create or load your Trezo account first.",
      );
      return;
    }
    if (!vaultKeyInput.trim()) {
      Alert.alert(
        "Recovery kit required",
        "Paste your recovery kit key to import.",
      );
      return;
    }

    try {
      await EmailRecoveryService.importVaultKeyBase64(
        smartAccountAddress,
        vaultKeyInput.trim(),
      );
      setVaultKeyInput("");
      setHasVaultKey(true);

      const refreshedMetadata = await EmailRecoveryService.loadMetadata({
        smartAccountAddress,
      });
      setStoredMetadata(refreshedMetadata);

      Alert.alert(
        "Recovery kit imported",
        "Trusted emails are now unlocked on this device.",
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to import recovery kit.";
      Alert.alert("Import failed", message);
    }
  }, [smartAccountAddress, vaultKeyInput]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Trusted Email</Text>
        <Text style={styles.screenDesc}>
          Set up secure recovery using your trusted email contacts.
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.configCard}>
          <View style={styles.cardSectionHeader}>
            <Text style={styles.cardSectionLabel}>ACTIVE CONFIGURATION</Text>
          </View>
          {loadingStoredMetadata ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : storedMetadata ? (
            <>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Approval requirement</Text>
                <Text style={styles.payloadValue}>
                  {storedMetadata.config.threshold}
                </Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>
                  Security wait / Expiry (days)
                </Text>
                <Text style={styles.payloadValue}>
                  {Math.floor(storedMetadata.config.delaySeconds / 86400)} /{" "}
                  {Math.floor(storedMetadata.config.expirySeconds / 86400)}
                </Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Privacy mode</Text>
                <Text style={styles.payloadValue}>
                  {storedMetadata.config.securityMode === "extra"
                    ? "Extra (encrypted)"
                    : "Standard"}
                </Text>
              </View>
              <Text style={styles.payloadSubLabel}>Masked Trusted Emails</Text>
              {storedMetadata.guardians.map((guardian) => (
                <View key={guardian.emailHash} style={styles.payloadRow}>
                  <Text style={styles.payloadLabel}>
                    {guardian.resolvedEmail ?? guardian.maskedEmail}
                    {guardian.isLocked ? " (locked)" : ""}
                  </Text>
                  <Text style={styles.payloadValue}>
                    weight {guardian.weight}
                  </Text>
                </View>
              ))}
              <Text style={styles.payloadSubLabel}>
                Current Activation Status
              </Text>
              <Text style={styles.payloadValue}>{installStatusLabel}</Text>
              {storedMetadata.installations.find(
                (i) => i.chainId === Number(resolvedChainId),
              )?.installStatus !== "installed" && (
                <Text style={styles.moduleHint}>
                  Recovery not active on this network. Activate to enable it.
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.moduleHint}>
              No trusted email recovery setup found yet.
            </Text>
          )}
          {metadataWarning ? (
            <Text style={styles.moduleError}>{metadataWarning}</Text>
          ) : null}
        </View>

        <View style={styles.configCard}>
          <View style={styles.cardSectionHeader}>
            <Text style={styles.cardSectionLabel}>PRIVACY & SECURITY</Text>
          </View>
          <Text style={styles.configDesc}>
            Standard mode stores masked trusted emails. Extra mode encrypts them
            and requires a recovery kit.
          </Text>

          <View style={styles.inputRow}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                securityMode === "none" ? styles.modeButtonActive : undefined,
              ]}
              onPress={() => setSecurityMode("none")}
              activeOpacity={0.85}
            >
              <Text style={styles.modeButtonText}>Standard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                securityMode === "extra" ? styles.modeButtonActive : undefined,
              ]}
              onPress={() => setSecurityMode("extra")}
              activeOpacity={0.85}
            >
              <Text style={styles.modeButtonText}>Extra Security</Text>
            </TouchableOpacity>
          </View>

          {securityMode === "extra" ? (
            <>
              <Text style={styles.moduleHint}>
                Recovery kit on this device:{" "}
                {hasVaultKey ? "Available" : "Not imported"}
              </Text>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleExportRecoveryKit}
                activeOpacity={0.85}
                disabled={!smartAccountAddress}
              >
                <Text style={styles.secondaryButtonText}>
                  Export Recovery Kit (QR)
                </Text>
              </TouchableOpacity>

              <TextInput
                style={styles.textInput}
                value={vaultKeyInput}
                onChangeText={setVaultKeyInput}
                placeholder="Paste recovery kit key (Base64)"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleImportVaultKey}
                activeOpacity={0.85}
                disabled={!smartAccountAddress}
              >
                <Text style={styles.secondaryButtonText}>
                  Import Recovery Kit
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.moduleHint}>
              Recovery kit export/import is only required in Extra Security
              mode.
            </Text>
          )}
        </View>

        <View style={styles.configCard}>
          <View style={styles.cardSectionHeader}>
            <Text style={styles.cardSectionLabel}>TRUSTED CONTACTS</Text>
          </View>
          <Text style={styles.configDesc}>
            Add trusted email addresses that will collectively help you regain
            access.
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Total Trusted Emails</Text>
              <TextInput
                style={styles.numberInput}
                value={guardianCountValue}
                onChangeText={handleGuardianCountChange}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Approval Requirement</Text>
              <TextInput
                style={styles.numberInput}
                value={thresholdValue}
                onChangeText={setThresholdValue}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              Total weight: {totalGuardianWeight}
            </Text>
            {hasDuplicateGuardians && (
              <Text style={[styles.summaryText, styles.summaryWarning]}>
                Duplicate emails detected
              </Text>
            )}
          </View>

          {guardianEmails.map((email, index) => (
            <View key={`guardian-${index}`} style={styles.guardianRowContainer}>
              <View style={styles.guardianRow}>
                <View style={styles.guardianColumn}>
                  <Text style={styles.inputLabel}>
                    Trusted Email {index + 1}
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={(value) =>
                      handleGuardianEmailChange(index, value)
                    }
                    placeholder="email@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                  />
                </View>
                <View style={styles.weightColumn}>
                  <Text style={styles.inputLabel}>Weight</Text>
                  <TextInput
                    style={styles.numberInput}
                    value={guardianWeights[index] ?? "1"}
                    onChangeText={(value) => handleWeightChange(index, value)}
                    keyboardType="number-pad"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>

              {/* Optional Delete Button */}
              {guardianEmails.length > 1 && (
                <TouchableOpacity
                  style={styles.deleteGuardianButton}
                  onPress={() => handleDeleteGuardian(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove trusted email ${index + 1}`}
                >
                  <Feather
                    name="trash-2"
                    size={20}
                    color={theme.colors.danger}
                  />
                </TouchableOpacity>
              )}
            </View>
          ))}
          {derivedGuardians.length > 0 && (
            <View style={styles.payloadBox}>
              <Text style={styles.payloadTitle}>
                Derived Recovery Addresses
              </Text>
              {derivedGuardians.map(({ email, guardianAddress }) => (
                <View key={email} style={styles.payloadRow}>
                  <Text style={styles.payloadLabel}>{email}</Text>
                  <Text style={styles.payloadValue}>
                    {shortenHex(guardianAddress)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.configCard}>
          <View style={styles.cardSectionHeader}>
            <Text style={styles.cardSectionLabel}>TIMING CONTROLS</Text>
          </View>
          <Text style={styles.configDesc}>
            Configure the security delay and expiration for recovery requests.
          </Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Security Wait (days)</Text>
              <TextInput
                style={styles.numberInput}
                value={delayDays}
                onChangeText={setDelayDays}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expiry (days)</Text>
              <TextInput
                style={styles.numberInput}
                value={expiryDays}
                onChangeText={setExpiryDays}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </View>

        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <Text style={styles.cardSectionLabel}>RECOVERY ENGINE</Text>
            <TouchableOpacity
              onPress={handleRefreshModuleStatus}
              style={styles.refreshButton}
              disabled={!smartAccountReady || checkingModule}
            >
              {checkingModule ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Feather
                  name="refresh-ccw"
                  size={16}
                  color={smartAccountReady ? colors.accent : colors.textMuted}
                />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.cardDesc}>
            Activate email recovery so trusted emails can help you regain access
            if needed.
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
                    : colors.accent
              }
            />
            <Text style={styles.moduleStatusText}>
              {!smartAccountReady
                ? "Create your Trezo account to enable recovery"
                : checkingModule
                  ? "Checking status..."
                  : moduleInstalledState
                    ? "Recovery active"
                    : "Recovery not active"}
            </Text>
          </View>
          {moduleError && <Text style={styles.moduleError}>{moduleError}</Text>}
          {!smartAccountReady && (
            <Text style={styles.moduleHint}>
              Create your Trezo account first to enable recovery.
            </Text>
          )}
          {smartAccountReady && !guardiansReady && (
            <Text style={styles.moduleHint}>
              Add trusted emails and weights before activating.
            </Text>
          )}
          {__DEV__ && lastUserOpHash && (
            <View style={styles.hashRow}>
              <Text style={styles.hashLabel}>Request ID</Text>
              <Text style={styles.hashValue}>{lastUserOpHash}</Text>
            </View>
          )}
          {__DEV__ && lastOperationHash && (
            <View style={styles.hashRow}>
              <Text style={styles.hashLabel}>Processing ID</Text>
              <Text style={styles.hashValue}>{lastOperationHash}</Text>
            </View>
          )}
          {__DEV__ && lastInstallPayload && (
            <View style={styles.payloadBox}>
              <Text style={styles.payloadTitle}>Latest Setup Details</Text>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Sender</Text>
                <Text style={styles.payloadValue}>
                  {shortenHex(lastInstallPayload.sender)}
                </Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Nonce</Text>
                <Text style={styles.payloadValue}>
                  {String(lastInstallPayload.nonce)}
                </Text>
              </View>
              <View style={styles.payloadRow}>
                <Text style={styles.payloadLabel}>Sponsorship</Text>
                <Text style={styles.payloadValue}>
                  {lastInstallPayload.paymaster
                    ? shortenHex(lastInstallPayload.paymaster)
                    : "Not sponsored"}
                </Text>
              </View>
              <Text style={styles.payloadSubLabel}>Request Data</Text>
              <Text style={styles.payloadCode}>
                {shortenHex(lastInstallPayload.callData, 16)}
              </Text>
              <Text style={styles.payloadSubLabel}>Signature</Text>
              <Text style={styles.payloadCode}>
                {shortenHex(lastInstallPayload.signature, 20)}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.installButton,
              (!smartAccountReady ||
                !guardiansReady ||
                moduleInstalledState ||
                installingModule) &&
                styles.installButtonDisabled,
            ]}
            disabled={
              !smartAccountReady ||
              !guardiansReady ||
              moduleInstalledState ||
              installingModule
            }
            onPress={handleInstallModule}
            activeOpacity={0.85}
          >
            {installingModule ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.installButtonText}>
                {moduleInstalledState
                  ? "Recovery Active"
                  : "Activate Email Recovery"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.installButton,
              styles.syncButton,
              (!smartAccountReady || !guardiansReady || installingModule) &&
                styles.installButtonDisabled,
            ]}
            disabled={!smartAccountReady || !guardiansReady || installingModule}
            onPress={handleSaveToCloud}
            activeOpacity={0.85}
          >
            {installingModule ? (
              <ActivityIndicator size="small" color={colors.textOnAccent} />
            ) : (
              <Text style={styles.installButtonText}>Sync to Cloud</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Secure Cloud Sync</Text>
          <Text style={styles.helpText}>
            Syncing to Trezo Cloud allows you to recover your account from any
            device using your trusted emails. Your data is protected by your
            on-chain security module.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
      paddingHorizontal: 20,
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
      paddingHorizontal: 20,
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
    inputRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    inputGroup: {
      flex: 1,
      gap: 8,
    },
    inputLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    modeButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
    },
    modeButtonActive: {
      borderColor: colors.accent,
      backgroundColor: withAlpha(colors.accent, 0.1),
    },
    modeButtonText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    numberInput: {
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    textInput: {
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
      fontSize: 15,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
      marginBottom: 16,
    },
    summaryText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    summaryWarning: {
      color: colors.danger,
    },
    guardianRowContainer: {
      marginBottom: 20,
    },
    guardianRow: {
      flexDirection: "row",
      gap: 12,
      alignItems: "flex-end",
    },
    guardianColumn: {
      flex: 1,
      gap: 8,
    },
    weightColumn: {
      width: 90,
      gap: 8,
    },
    deleteGuardianButton: {
      marginTop: 8,
      alignSelf: "flex-end",
      padding: 8,
    },
    moduleCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 20,
      marginBottom: 20,
      gap: 16,
    },
    moduleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    refreshButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.borderMuted, 0.5),
    },
    moduleStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 10,
    },
    moduleStatusIdle: {
      backgroundColor: withAlpha(colors.accent, 0.1),
    },
    moduleStatusInstalled: {
      backgroundColor: withAlpha(colors.success, 0.1),
    },
    moduleStatusWarning: {
      backgroundColor: withAlpha(colors.warning, 0.1),
    },
    moduleStatusText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      flex: 1,
    },
    moduleError: {
      color: colors.danger,
      fontSize: 12,
      marginTop: 4,
    },
    moduleHint: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 16,
    },
    payloadBox: {
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
      borderRadius: 16,
      padding: 16,
      marginTop: 8,
      gap: 8,
    },
    payloadTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      marginBottom: 4,
    },
    payloadRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    payloadLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    payloadValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "right",
    },
    payloadSubLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      marginTop: 8,
    },
    payloadCode: {
      color: colors.textPrimary,
      fontSize: 12,
      fontFamily: "monospace",
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      padding: 8,
      borderRadius: 8,
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      backgroundColor: withAlpha(colors.accent, 0.05),
      marginBottom: 12,
    },
    secondaryButtonText: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: "700",
    },
    installButton: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    installButtonDisabled: {
      opacity: 0.5,
    },
    installButtonText: {
      color: colors.textOnAccent,
      fontSize: 15,
      fontWeight: "700",
    },
    syncButton: {
      marginTop: 12,
    },
    helpCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      marginBottom: 40,
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
  });

export default EmailRecoveryScreen;
