import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
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

import { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import { withAlpha } from "@utils/color";
import { CHAINS, DEFAULT_CHAIN_ID, SUPPORTED_CHAIN_IDS, type SupportedChainId } from "@/src/integration/chains";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useUserStore } from "@/src/store/useUserStore";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import {
  EmailRecoveryGroupService,
} from "@/src/features/wallet/services/EmailRecoveryGroupService";
import { EmailRecoveryService, type LoadedEmailRecoveryMetadata } from "@/src/features/wallet/services/EmailRecoveryService";
import type { Address, Hex } from "viem";

const DEFAULT_DEADLINE_DAYS = 7;

const EmailRecoveryStartScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const user = useUserStore((state) => state.user);
  const storedSmartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);

  const smartAccountAddress = useMemo<Address | undefined>(
    () => (aaAccount?.predictedAddress ?? storedSmartAccountAddress ?? undefined) as Address | undefined,
    [aaAccount?.predictedAddress, storedSmartAccountAddress],
  );
  const resolvedChainId = useMemo<SupportedChainId>(
    () => (aaAccount?.chainId ?? activeChainId ?? DEFAULT_CHAIN_ID) as SupportedChainId,
    [aaAccount?.chainId, activeChainId],
  );

  const [metadata, setMetadata] = useState<LoadedEmailRecoveryMetadata | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(true);
  const [selectedChainIds, setSelectedChainIds] = useState<SupportedChainId[]>([]);
  const [deadlineDays, setDeadlineDays] = useState(DEFAULT_DEADLINE_DAYS);
  const [isCreating, setIsCreating] = useState(false);
  const [creatingStep, setCreatingStep] = useState<string>("");

  useEffect(() => {
    if (!smartAccountAddress) {
      setLoadingMetadata(false);
      return;
    }
    let cancelled = false;
    setLoadingMetadata(true);
    EmailRecoveryService.loadMetadata({ smartAccountAddress })
      .then((data) => {
        if (cancelled) return;
        setMetadata(data);
        if (data) {
          const installed = data.installations
            .filter((i) => i.installStatus === "installed")
            .map((i) => i.chainId as SupportedChainId);
          setSelectedChainIds(installed);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingMetadata(false);
      });
    return () => { cancelled = true; };
  }, [smartAccountAddress]);

  const installedChains = useMemo(() => {
    if (!metadata) return [];
    return metadata.installations
      .filter((i) => i.installStatus === "installed")
      .map((i) => i.chainId as SupportedChainId);
  }, [metadata]);

  const toggleChain = useCallback((chainId: SupportedChainId) => {
    setSelectedChainIds((prev) =>
      prev.includes(chainId)
        ? prev.filter((id) => id !== chainId)
        : [...prev, chainId],
    );
  }, []);

  const canCreate = useMemo(() => {
    return (
      Boolean(user?.id) &&
      Boolean(smartAccountAddress) &&
      metadata !== null &&
      selectedChainIds.length > 0 &&
      !isCreating
    );
  }, [user?.id, smartAccountAddress, metadata, selectedChainIds.length, isCreating]);

  const handleCreateAndSend = useCallback(async () => {
    if (!user?.id || !smartAccountAddress) {
      Alert.alert("Sign in required", "Please sign in and have a wallet before starting recovery.");
      return;
    }
    if (selectedChainIds.length === 0) {
      Alert.alert("Select chains", "Choose at least one chain to recover on.");
      return;
    }

    setIsCreating(true);
    setCreatingStep("Creating new passkey on this device...");

    try {
      const passkey = await PasskeyService.createPasskey(user.id);

      setCreatingStep("Building multichain recovery payload...");
      const result = await EmailRecoveryGroupService.createGroup({
        userId: user.id,
        smartAccountAddress,
        newPasskey: {
          idRaw: passkey.credentialIdRaw as Hex,
          px: BigInt(passkey.publicKeyX),
          py: BigInt(passkey.publicKeyY),
        },
        targetChainIds: selectedChainIds,
        deadlineSeconds: deadlineDays * 24 * 60 * 60,
      });

      setCreatingStep("Sending guardian approval emails...");
      await EmailRecoveryGroupService.sendApprovals(result.groupId);

      setCreatingStep("");
      navigation.navigate("EmailRecoveryGroupStatus", { groupId: result.groupId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start email recovery.";
      Alert.alert("Recovery start failed", message);
    } finally {
      setIsCreating(false);
      setCreatingStep("");
    }
  }, [user?.id, smartAccountAddress, selectedChainIds, deadlineDays, navigation]);

  if (loadingMetadata) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Start Email Recovery</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.accentAlt} />
          <Text style={styles.loadingText}>Loading recovery config...</Text>
        </View>
      </View>
    );
  }

  if (!metadata) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Start Email Recovery</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Email Recovery Not Configured</Text>
            <Text style={styles.cardDesc}>
              Set up email recovery guardians on your wallet before starting a recovery request.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate("EmailRecovery")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Configure Email Recovery</Text>
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
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Start Email Recovery</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>New Passkey</Text>
          <Text style={styles.cardDesc}>
            A new passkey will be created on this device. Once your trusted contacts approve recovery,
            this passkey will be activated on all selected chains.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Target Chains</Text>
          <Text style={styles.cardDesc}>
            Select which chains to recover on. Only chains with email recovery installed are shown.
          </Text>
          {installedChains.length === 0 ? (
            <Text style={styles.emptyText}>
              No chains with email recovery installed. Install the module first.
            </Text>
          ) : (
            installedChains.map((chainId) => {
              const chainName = CHAINS[chainId]?.name ?? `Chain ${chainId}`;
              const isSelected = selectedChainIds.includes(chainId);
              return (
                <TouchableOpacity
                  key={chainId}
                  style={[styles.chainRow, isSelected && styles.chainRowSelected]}
                  onPress={() => toggleChain(chainId)}
                  activeOpacity={0.85}
                >
                  <View style={styles.chainCheck}>
                    {isSelected ? (
                      <Feather name="check-circle" size={20} color={theme.colors.accentAlt} />
                    ) : (
                      <Feather name="circle" size={20} color={theme.colors.textMuted} />
                    )}
                  </View>
                  <Text style={[styles.chainName, isSelected && styles.chainNameSelected]}>
                    {chainName}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Deadline</Text>
          <Text style={styles.cardDesc}>
            Guardian approvals must be collected before the deadline. Default is 7 days.
          </Text>
          <View style={styles.deadlineRow}>
            <TouchableOpacity
              style={styles.deadlineButton}
              onPress={() => setDeadlineDays((d) => Math.max(1, d - 1))}
              activeOpacity={0.85}
            >
              <Feather name="minus" size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.deadlineValue}>{deadlineDays} days</Text>
            <TouchableOpacity
              style={styles.deadlineButton}
              onPress={() => setDeadlineDays((d) => Math.min(30, d + 1))}
              activeOpacity={0.85}
            >
              <Feather name="plus" size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trusted Contacts</Text>
          <Text style={styles.cardDesc}>
            {metadata.guardians.length} trusted contact{metadata.guardians.length !== 1 ? "s" : ""} will be asked to approve this recovery.
            {metadata.config.threshold} approval{metadata.config.threshold !== 1 ? "s" : ""} needed.
          </Text>
          {metadata.guardians.map((guardian, index) => (
            <View key={guardian.emailHash} style={styles.guardianRow}>
              <View style={styles.guardianIndex}>
                <Text style={styles.guardianIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.guardianInfo}>
                <Text style={styles.guardianEmail}>
                  {guardian.resolvedEmail ?? guardian.maskedEmail}
                  {guardian.isLocked ? " (locked)" : ""}
                </Text>
                <Text style={styles.guardianWeight}>weight {guardian.weight}</Text>
              </View>
            </View>
          ))}
        </View>

        {isCreating && creatingStep ? (
          <View style={styles.card}>
            <ActivityIndicator size="small" color={theme.colors.accentAlt} />
            <Text style={styles.creatingStepText}>{creatingStep}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primaryButton, !canCreate && styles.disabledButton]}
          disabled={!canCreate}
          onPress={() => void handleCreateAndSend()}
          activeOpacity={0.85}
        >
          {isCreating ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.primaryButtonText}>
              Create Recovery Request
            </Text>
          )}
        </TouchableOpacity>
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
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 15,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 12,
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
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      fontStyle: "italic",
    },
    chainRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
      backgroundColor: withAlpha(colors.textPrimary, 0.03),
    },
    chainRowSelected: {
      borderColor: colors.accentAlt,
      backgroundColor: withAlpha(colors.accentAlt, 0.08),
    },
    chainCheck: {
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    chainName: {
      color: colors.textSecondary,
      fontSize: 15,
      fontWeight: "600",
    },
    chainNameSelected: {
      color: colors.textPrimary,
    },
    deadlineRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
    },
    deadlineButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.textPrimary, 0.04),
    },
    deadlineValue: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
      minWidth: 80,
      textAlign: "center",
    },
    guardianRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    guardianIndex: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: withAlpha(colors.accentAlt, 0.12),
      alignItems: "center",
      justifyContent: "center",
    },
    guardianIndexText: {
      color: colors.accentAlt,
      fontSize: 12,
      fontWeight: "700",
    },
    guardianInfo: {
      flex: 1,
    },
    guardianEmail: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    guardianWeight: {
      color: colors.textMuted,
      fontSize: 12,
    },
    creatingStepText: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: "center",
      marginTop: 4,
    },
    primaryButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledButton: {
      opacity: 0.5,
    },
    primaryButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
    },
  });

export default EmailRecoveryStartScreen;
