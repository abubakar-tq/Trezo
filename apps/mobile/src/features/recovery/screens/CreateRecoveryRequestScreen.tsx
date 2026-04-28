import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { keccak256, toBytes, type Address, type Hex } from "viem";

import { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import { CHAINS, DEFAULT_CHAIN_ID, SUPPORTED_CHAIN_IDS, type SupportedChainId } from "@/src/integration/chains";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useUserStore } from "@/src/store/useUserStore";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { RecoveryRequestService } from "@/src/features/wallet/services/RecoveryRequestService";
import { SocialRecoveryService } from "@/src/features/wallet/services/SocialRecoveryService";
import { SupabaseWalletService } from "@/src/features/wallet/services/SupabaseWalletService";
import { buildRecoveryIntent, computeRecoveryDigest, type ChainRecoveryScope } from "@/src/integration/viem/recoveryIntent";
import { getDeployment } from "@/src/integration/viem";

const REQUEST_TTL_SECONDS = 7 * 24 * 60 * 60;

const CreateRecoveryRequestScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const user = useUserStore((state) => state.user);
  const storedSmartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);

  const smartAccountAddress = (aaAccount?.predictedAddress ?? storedSmartAccountAddress ?? null) as Address | null;
  const resolvedChainId = (aaAccount?.chainId ?? activeChainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;

  const [isCreating, setIsCreating] = useState(false);
  const [lastSummary, setLastSummary] = useState<string>("Waiting to create request");

  const handleCreateRequest = async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in before creating a recovery request.");
      return;
    }
    if (!smartAccountAddress) {
      Alert.alert("Wallet missing", "A smart-account address is required.");
      return;
    }

    setIsCreating(true);
    setLastSummary("Creating passkey and reading chain state...");

    try {
      const passkey = await PasskeyService.createPasskey(user.id);
      const recoveryService = new RecoveryRequestService();
      const walletService = new SupabaseWalletService();

      const candidateChains = SUPPORTED_CHAIN_IDS.filter((chainId) => {
        if (chainId === DEFAULT_CHAIN_ID) return true;
        return Boolean(CHAINS[chainId]?.rpcUrl);
      });

      const chainState = await SocialRecoveryService.getMultiChainRecoveryState(
        smartAccountAddress,
        candidateChains,
      );

      const eligibleChains = chainState.filter(
        (state) =>
          state.moduleConfigured &&
          state.accountDeployed &&
          state.moduleInstalled &&
          state.guardians.length > 0 &&
          state.threshold > 0n,
      );

      if (eligibleChains.length === 0) {
        throw new Error("No eligible chain found. Ensure guardian recovery is installed and configured on-chain.");
      }

      const scopes: ChainRecoveryScope[] = [];
      for (const state of eligibleChains) {
        const deployment = getDeployment(state.chainId);
        if (!deployment?.socialRecovery) {
          continue;
        }

        const hashes = await SocialRecoveryService.getRecoveryHashes(smartAccountAddress, state.chainId);
        if (!hashes) {
          continue;
        }

        scopes.push({
          chainId: state.chainId,
          wallet: smartAccountAddress,
          socialRecovery: deployment.socialRecovery,
          nonce: state.nonce,
          guardianSetHash: hashes.guardianSetHash,
          policyHash: hashes.policyHash,
        });
      }

      if (scopes.length === 0) {
        throw new Error("Failed to build recovery chain scopes.");
      }

      const primaryChain = eligibleChains[0];
      const primaryDeployment = getDeployment(primaryChain.chainId);
      if (!primaryDeployment?.socialRecovery) {
        throw new Error(`Social recovery deployment missing for chain ${primaryChain.chainId}.`);
      }

      const now = Math.floor(Date.now() / 1000);
      const deadline = now + REQUEST_TTL_SECONDS;
      const requestId = keccak256(toBytes(`${user.id}:${smartAccountAddress}:${Date.now()}:${Math.random()}`)) as Hex;
      const metadataHash = keccak256(
        toBytes(`${passkey.deviceName}:${passkey.deviceType}:${new Date().toISOString()}`),
      ) as Hex;

      const intent = buildRecoveryIntent({
        requestId,
        passkey: {
          idRaw: passkey.credentialIdRaw as Hex,
          px: BigInt(passkey.publicKeyX),
          py: BigInt(passkey.publicKeyY),
        },
        chainScopes: scopes,
        validAfter: BigInt(now),
        deadline: BigInt(deadline),
        metadataHash,
      });

      const digest = computeRecoveryDigest(intent, primaryDeployment.socialRecovery);
      const aaWalletId =
        aaAccount?.id ??
        (await walletService.getAAWalletForChain(user.id, resolvedChainId))?.id ??
        (await walletService.getAAWallet(user.id))?.id;

      if (!aaWalletId) {
        throw new Error("AA wallet metadata is missing in Supabase.");
      }

      setLastSummary("Persisting request metadata...");

      const created = await recoveryService.createRecoveryRequest({
        userId: user.id,
        aaWalletId,
        walletAddress: smartAccountAddress,
        requestHash: requestId,
        digest,
        newPasskeyHash: intent.newPasskeyHash,
        newPasskeyIdRaw: passkey.credentialIdRaw,
        newPasskeyJson: {
          idRaw: passkey.credentialIdRaw,
          px: BigInt(passkey.publicKeyX).toString(),
          py: BigInt(passkey.publicKeyY).toString(),
        },
        chainScopeHash: intent.chainScopeHash,
        guardianAddresses: primaryChain.guardians,
        threshold: Number(primaryChain.threshold),
        nonce: Number(primaryChain.nonce),
        validAfter: new Date(now * 1000).toISOString(),
        deadline: new Date(deadline * 1000).toISOString(),
        timelockSeconds: Number(primaryChain.timelockSeconds),
        targetChainIds: scopes.map((scope) => Number(scope.chainId)),
        requesterNote: `Recovery requested from ${passkey.deviceName}`,
        recoveryIntentJson: {
          ...intent,
          validAfter: intent.validAfter.toString(),
          deadline: intent.deadline.toString(),
        },
        chainScopesJson: scopes.map((scope) => ({
          ...scope,
          chainId: Number(scope.chainId),
          nonce: Number(scope.nonce),
        })),
        status: "collecting_approvals",
      });

      for (const scope of scopes) {
        await recoveryService.updateChainStatus({
          requestId: created.id,
          chainId: Number(scope.chainId),
          status: "pending",
          nonceAtCreation: Number(scope.nonce),
          guardianSetHash: scope.guardianSetHash,
          policyHash: scope.policyHash,
        });
      }

      setLastSummary(`Request created on ${scopes.length} chain(s).`);
      navigation.navigate("ShareRecoveryRequest", { requestId: created.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create recovery request.";
      Alert.alert("Recovery request failed", message);
      setLastSummary(message);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.kicker}>Create request</Text>
        <Text style={styles.title}>Build and publish the guardian recovery payload.</Text>
        <Text style={styles.body}>
          This creates a new passkey on this device, reads guardian policy from chain state, computes the portable recovery digest, and stores request metadata in Supabase.
        </Text>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Status</Text>
          <Text style={styles.summaryValue}>{lastSummary}</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, isCreating && styles.disabledButton]}
          onPress={() => void handleCreateRequest()}
          disabled={isCreating}
        >
          {isCreating ? <ActivityIndicator color={theme.colors.textOnAccent} /> : <Text style={styles.primaryButtonText}>Create Request</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.tertiaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.tertiaryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 24,
      backgroundColor: colors.background,
      justifyContent: "center",
    },
    card: {
      borderRadius: 28,
      padding: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 16,
    },
    kicker: {
      color: colors.accent,
      textTransform: "uppercase",
      letterSpacing: 2,
      fontSize: 12,
      fontWeight: "700",
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: "800",
      lineHeight: 32,
    },
    body: {
      color: colors.textMuted,
      fontSize: 15,
      lineHeight: 22,
    },
    summaryBox: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: colors.surfaceMuted,
      gap: 4,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 12,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
    },
    primaryButton: {
      paddingVertical: 16,
      borderRadius: 18,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledButton: {
      opacity: 0.7,
    },
    primaryButtonText: {
      color: colors.textOnAccent,
      fontWeight: "700",
      fontSize: 16,
    },
    tertiaryButton: {
      paddingVertical: 16,
      borderRadius: 18,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    tertiaryButtonText: {
      color: colors.text,
      fontWeight: "700",
      fontSize: 16,
    },
  });

export default CreateRecoveryRequestScreen;
