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

import { EmailRecoveryService } from "@/src/features/wallet/services/EmailRecoveryService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { isAddress, type Address, type Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

const shortenHex = (value: string | null | undefined, chars = 6) => {
  if (!value) return "-";
  if (value.length <= chars * 2 + 2) return value;
  return `${value.slice(0, chars + 2)}...${value.slice(-chars)}`;
};

const EmailRecoveryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const user = useUserStore((state) => state.user);
  const storedSmartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const smartAccountDeployed = useUserStore((state) => state.smartAccountDeployed);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);

  const smartAccountAddress = useMemo(() => {
    const address = aaAccount?.predictedAddress ?? storedSmartAccountAddress ?? undefined;
    return address ? (address as Address) : undefined;
  }, [aaAccount?.predictedAddress, storedSmartAccountAddress]);
  const isAccountDeployed = Boolean(aaAccount?.isDeployed ?? smartAccountDeployed ?? false);
  const resolvedChainId = useMemo<SupportedChainId>(
    () => (aaAccount?.chainId ?? activeChainId ?? DEFAULT_CHAIN_ID) as SupportedChainId,
    [aaAccount?.chainId, activeChainId],
  );
  const smartAccountReady = Boolean(smartAccountAddress && isAccountDeployed);

  const defaultGuardianCount = 3;
  const [guardianCountValue, setGuardianCountValue] = useState("3");
  const [thresholdValue, setThresholdValue] = useState("2");
  const [guardianAddresses, setGuardianAddresses] = useState<string[]>(
    () => Array(defaultGuardianCount).fill(""),
  );
  const [guardianWeights, setGuardianWeights] = useState<string[]>(
    () => Array(defaultGuardianCount).fill("1"),
  );
  const [delayDays, setDelayDays] = useState("1");
  const [expiryDays, setExpiryDays] = useState("3");

  const [checkingModule, setCheckingModule] = useState(false);
  const [moduleInstalledState, setModuleInstalledState] = useState<boolean | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  const [moduleStatusNonce, setModuleStatusNonce] = useState(0);
  const [installingModule, setInstallingModule] = useState(false);
  const [lastUserOpHash, setLastUserOpHash] = useState<Hex | null>(null);
  const [lastOperationHash, setLastOperationHash] = useState<Hex | null>(null);
  const [lastInstallPayload, setLastInstallPayload] = useState<UserOperation<"0.7"> | null>(null);

  const expectedGuardians = useMemo(
    () => Math.max(parseInt(guardianCountValue, 10) || 0, 0),
    [guardianCountValue],
  );
  const trimmedGuardians = useMemo(
    () => guardianAddresses.map((address) => address.trim()).filter(Boolean),
    [guardianAddresses],
  );
  const normalizedGuardianWeights = useMemo(
    () => guardianWeights.map((weight) => Math.max(parseInt(weight, 10) || 0, 0)),
    [guardianWeights],
  );
  const totalGuardianWeight = useMemo(
    () => normalizedGuardianWeights.reduce((sum, weight) => sum + weight, 0),
    [normalizedGuardianWeights],
  );
  const hasDuplicateGuardians = useMemo(() => {
    const normalized = trimmedGuardians.map((address) => address.toLowerCase());
    return new Set(normalized).size !== normalized.length;
  }, [trimmedGuardians]);
  const guardiansReady = expectedGuardians > 0 && trimmedGuardians.length === expectedGuardians;

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

  const handleGuardianCountChange = useCallback((value: string) => {
    const parsed = parseInt(value, 10) || 0;
    setGuardianCountValue(value);
    setGuardianAddresses((current) => {
      if (parsed > current.length) {
        return [...current, ...Array(parsed - current.length).fill("")];
      }
      return current.slice(0, parsed);
    });
    setGuardianWeights((current) => {
      if (parsed > current.length) {
        return [...current, ...Array(parsed - current.length).fill("1")];
      }
      return current.slice(0, parsed);
    });
  }, []);

  const handleAddressChange = useCallback((index: number, value: string) => {
    setGuardianAddresses((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const handleWeightChange = useCallback((index: number, value: string) => {
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

  const handleInstallModule = useCallback(async () => {
    if (!smartAccountReady || !smartAccountAddress) {
      Alert.alert("Smart Account Required", "Deploy your smart account before installing email recovery.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Authentication Required", "Please sign in to install the email recovery module.");
      return;
    }
    if (!guardiansReady) {
      Alert.alert("Add Guardians", "Fill in all guardian addresses before installing.");
      return;
    }

    const invalidGuardian = trimmedGuardians.find((address) => !isAddress(address));
    if (invalidGuardian) {
      Alert.alert("Invalid Address", `${invalidGuardian} is not a valid Ethereum address.`);
      return;
    }

    const parsedThreshold = parseInt(thresholdValue, 10) || 0;
    const parsedDelay = parseInt(delayDays, 10) || 0;
    const parsedExpiry = parseInt(expiryDays, 10) || 0;

    if (parsedThreshold <= 0) {
      Alert.alert("Invalid Threshold", "Threshold must be greater than zero.");
      return;
    }
    if (hasDuplicateGuardians) {
      Alert.alert("Duplicate Guardians", "Each guardian address must be unique.");
      return;
    }
    if (parsedDelay <= 0 || parsedExpiry <= 0) {
      Alert.alert("Invalid Timing", "Delay and expiry must be greater than zero.");
      return;
    }
    if (parsedExpiry < parsedDelay) {
      Alert.alert("Invalid Timing", "Expiry must be greater than or equal to the delay.");
      return;
    }

    let parsedWeights: bigint[];
    try {
      parsedWeights = guardianWeights.map((weight, index) => {
        const parsed = parseInt(weight, 10) || 0;
        if (parsed <= 0) {
          throw new Error(`Guardian weight at index ${index + 1} must be greater than zero.`);
        }
        return BigInt(parsed);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Guardian weights must be greater than zero.";
      Alert.alert("Invalid Weights", message);
      return;
    }
    const totalWeight = parsedWeights.reduce((sum, weight) => sum + weight, 0n);
    if (BigInt(parsedThreshold) > totalWeight) {
      Alert.alert("Invalid Threshold", "Threshold cannot exceed the total guardian weight.");
      return;
    }

    setInstallingModule(true);
    setModuleError(null);
    setLastUserOpHash(null);
    setLastOperationHash(null);

    try {
      const passkey = await PasskeyService.getPasskey(user.id);
      if (!passkey) {
        throw new Error("No passkey found on this device. Create a passkey first.");
      }

      const { userOp, userOpHash } = await EmailRecoveryService.buildInstallModuleUserOp({
        smartAccountAddress,
        guardians: trimmedGuardians.map((address) => address as Address),
        weights: parsedWeights,
        threshold: BigInt(parsedThreshold),
        delay: BigInt(parsedDelay) * 86400n,
        expiry: BigInt(parsedExpiry) * 86400n,
        passkeyId: passkey.credentialIdRaw as Hex,
        chainId: resolvedChainId,
        usePaymaster: true,
      });

      setLastUserOpHash(userOpHash);

      const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
      const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
      const signedUserOp = { ...userOp, signature: encodedSignature };

      const operationHash = await EmailRecoveryService.submitInstallModuleUserOp({
        signedUserOp,
        chainId: resolvedChainId,
      });

      setLastOperationHash(operationHash);
      setLastInstallPayload(signedUserOp);
      setModuleInstalledState(true);
      Alert.alert("Email Recovery Activated", "Email recovery module installation was submitted.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to install the email recovery module.";
      setModuleError(message);
      Alert.alert("Installation Failed", message);
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
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Email Recovery</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Guardian Configuration</Text>
          <Text style={styles.cardDesc}>
            Configure guardians and weights for email-based recovery. Use the same guardian
            addresses that will verify recovery emails.
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Total Guardians</Text>
              <TextInput
                style={styles.numberInput}
                value={guardianCountValue}
                onChangeText={handleGuardianCountChange}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Threshold</Text>
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
            <Text style={styles.summaryText}>Total weight: {totalGuardianWeight}</Text>
            {hasDuplicateGuardians && (
              <Text style={[styles.summaryText, styles.summaryWarning]}>
                Duplicate addresses detected
              </Text>
            )}
          </View>

          {guardianAddresses.map((address, index) => (
            <View key={`guardian-${index}`} style={styles.guardianRow}>
              <View style={styles.guardianColumn}>
                <Text style={styles.inputLabel}>Guardian {index + 1} Address</Text>
                <TextInput
                  style={styles.textInput}
                  value={address}
                  onChangeText={(value) => handleAddressChange(index, value)}
                  placeholder="0x..."
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
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
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recovery Timing</Text>
          <Text style={styles.cardDesc}>
            Delay and expiry are expressed in days. Recovery can be executed after the delay and
            before the expiry.
          </Text>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Delay (days)</Text>
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
            <Text style={styles.cardTitle}>Email Recovery Module</Text>
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
          <Text style={styles.cardDesc}>
            Install the on-chain email recovery module so guardians can approve recovery emails.
          </Text>
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
                ? "Module installed"
                : "Module not installed"}
            </Text>
          </View>
          {moduleError && <Text style={styles.moduleError}>{moduleError}</Text>}
          {!smartAccountReady && (
            <Text style={styles.moduleHint}>
              Deploy your smart account first. Module installation requires an on-chain contract.
            </Text>
          )}
          {smartAccountReady && !guardiansReady && (
            <Text style={styles.moduleHint}>
              Add guardians and weights before installing.
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
                {moduleInstalledState ? "Module Installed" : "Install Email Recovery"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
      gap: 16,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    summaryText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "500",
    },
    summaryWarning: {
      color: colors.warning,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 16,
    },
    moduleCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 16,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    cardDesc: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    inputRow: {
      flexDirection: "row",
      gap: 16,
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
    numberInput: {
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    textInput: {
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 13,
      fontFamily: "monospace",
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
      width: 100,
      gap: 8,
    },
    moduleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    refreshButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.accentAlt, 0.1),
    },
    moduleStatusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 12,
    },
    moduleStatusIdle: {
      backgroundColor: withAlpha(colors.accentAlt, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.2),
    },
    moduleStatusInstalled: {
      backgroundColor: withAlpha(colors.success, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(colors.success, 0.2),
    },
    moduleStatusWarning: {
      backgroundColor: withAlpha(colors.warning, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(colors.warning, 0.2),
    },
    moduleStatusText: {
      color: colors.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    moduleError: {
      color: colors.danger,
      fontSize: 12,
    },
    moduleHint: {
      color: colors.textMuted,
      fontSize: 12,
    },
    hashRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    hashLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    hashValue: {
      color: colors.textSecondary,
      fontSize: 12,
      flex: 1,
      textAlign: "right",
    },
    payloadBox: {
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
      borderRadius: 12,
      padding: 12,
      gap: 8,
    },
    payloadTitle: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    payloadRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 8,
    },
    payloadLabel: {
      color: colors.textMuted,
      fontSize: 12,
    },
    payloadValue: {
      color: colors.textSecondary,
      fontSize: 12,
    },
    payloadSubLabel: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 4,
    },
    payloadCode: {
      color: colors.textSecondary,
      fontSize: 11,
      fontFamily: "monospace",
    },
    installButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    installButtonDisabled: {
      opacity: 0.6,
    },
    installButtonText: {
      color: "#ffffff",
      fontSize: 15,
      fontWeight: "700",
    },
  });

export default EmailRecoveryScreen;
