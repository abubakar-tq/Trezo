import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { CHAIN_CONFIG } from "@/src/core/network/chain";
import {
  AccountDeploymentService,
  deriveDefaultWalletId,
} from "@/src/features/wallet/services/AccountDeploymentService";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import WalletSyncService from "@/src/features/wallet/services/WalletSyncService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { getChainConfig, isPortableChain, type SupportedChainId } from "@/src/integration/chains";
import { getSupabaseClient } from "@lib/supabase";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { DeployAccountSheetBody } from "@features/wallet/components/DeployAccountSheetBody";
import type { DeployStep } from "@features/wallet/types/deploy";

export default function DeployAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const user = useUserStore((state) => state.user);
  const setSmartAccountAddress = useUserStore((state) => state.setSmartAccountAddress);
  const setSmartAccountDeployed = useUserStore((state) => state.setSmartAccountDeployed);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);
  const setAAAccount = useWalletStore((state) => state.setAAAccount);
  const setDeploymentStatus = useWalletStore(
    (state) => state.setDeploymentStatus,
  );
  const markAsDeployed = useWalletStore((state) => state.markAsDeployed);

  const [currentStep, setCurrentStep] = useState<DeployStep>("intro");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [deployedAddress, setDeployedAddress] = useState<string>("");
  const deploymentChainId = useMemo(
    () => (aaAccount?.chainId ?? activeChainId ?? CHAIN_CONFIG.chainId) as SupportedChainId,
    [aaAccount?.chainId, activeChainId],
  );

  // Check if already deployed
  useEffect(() => {
    if (aaAccount?.isDeployed) {
      setCurrentStep("success");
      setDeployedAddress(aaAccount.predictedAddress);
    }
  }, [aaAccount]);

  const handleNext = useCallback(() => {
    if (currentStep === "intro") {
      handleCreatePasskey();
    }
  }, [currentStep]);

  const handleCreatePasskey = async () => {
    try {
      if (!user) {
        setErrorMessage("User not authenticated");
        setCurrentStep("error");
        return;
      }

      // Show the passkey spinner while the system credential UI is in flight.
      setCurrentStep("passkey");

      // Reuse the device's existing passkey if present; only create one on first
      // use. The AA address is derived from the passkey public key, so minting a
      // new passkey here (e.g. when deploying on a second chain) would change the
      // address and orphan the wallet already deployed under the old passkey.
      const passkey = await PasskeyService.getOrCreatePasskey(user.id);

      // Predict AA address from stable wallet identity + the reused passkey.
      const chainId = deploymentChainId;
      const walletIndex = aaAccount?.walletIndex ?? 0;
      const walletId = (aaAccount?.walletId ?? deriveDefaultWalletId(user.id)) as `0x${string}`;
      const deploymentMode = aaAccount?.deploymentMode ?? (isPortableChain(chainId) ? "portable" : "chain-specific");
      const predictedAddress = await AccountDeploymentService.predictAddress(
        walletId,
        passkey,
        chainId,
        walletIndex,
        deploymentMode,
      );
      setSmartAccountAddress(predictedAddress);

      await WalletSyncService.persistWalletMetadata({
        userId: user.id,
        predictedAddress,
        ownerAddress: passkey.credentialIdRaw,
        walletName: aaAccount?.walletName ?? "Passkey Smart Account",
        chainId,
        walletId,
        walletIndex,
        deploymentMode,
      }).catch((error) => {
        console.warn("[DeployAccount] Failed to persist predicted wallet metadata", error);
      });

      // Proceed to deployment
      await handleDeploy(passkey, predictedAddress as string, walletId, walletIndex, deploymentMode);
    } catch (error) {
      console.error("Error creating passkey:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to create passkey",
      );
      setCurrentStep("error");
    }
  };

  const handleDeploy = async (
    passkey: Awaited<ReturnType<typeof PasskeyService.createPasskey>>,
    predictedAddress: string,
    walletId: `0x${string}`,
    walletIndex: number,
    deploymentMode: "portable" | "chain-specific",
  ) => {
    setCurrentStep("deploying");
    setDeploymentStatus("deploying");

    try {
      const chainId = deploymentChainId;
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      const chain = getChainConfig(chainId);
      const usePaymaster = Boolean(chain.paymasterUrl);

      const result = await AccountDeploymentService.deployWithPasskeyAuth(
        user.id,
        {
          chainId,
          passkey,
          walletId: walletId as `0x${string}`,
          walletIndex,
          mode: deploymentMode,
          usePaymaster,
          paymasterUrl: chain.paymasterUrl,
        },
      );

      const accountAddress = result.accountAddress;

      // Update wallet store with deployment info
      if (!result.alreadyDeployed) {
        markAsDeployed(result.transactionHash!, Number(result.blockNumber));
      } else {
        setDeploymentStatus("deployed");
      }
      setAAAccount({
        id: user?.id || "passkey-wallet",
        userId: user?.id || "passkey-wallet",
        walletId,
        walletIndex,
        deploymentMode,
        predictedAddress: accountAddress,
        ownerAddress: passkey.credentialIdRaw,
        isDeployed: true,
        deploymentTxHash: result.alreadyDeployed
          ? aaAccount?.deploymentTxHash
          : result.transactionHash,
        deploymentBlockNumber: result.alreadyDeployed
          ? aaAccount?.deploymentBlockNumber
          : Number(result.blockNumber),
        walletName: "Passkey Smart Account",
        chainId,
        createdAt: new Date().toISOString(),
        deployedAt: new Date().toISOString(),
      });
      setSmartAccountAddress(accountAddress);
      setSmartAccountDeployed(true);

      const syncedWallet = await WalletSyncService.persistWalletMetadata({
        userId: user.id,
        predictedAddress: accountAddress,
        ownerAddress: passkey.credentialIdRaw,
        walletName: aaAccount?.walletName ?? "Passkey Smart Account",
        chainId,
        walletId,
        walletIndex,
        deploymentMode,
        isDeployed: true,
        deploymentTxHash: result.alreadyDeployed ? undefined : result.transactionHash,
        deploymentBlockNumber: result.alreadyDeployed
          ? undefined
          : Number(result.blockNumber),
        deployedAt: new Date().toISOString(),
      }).then((wallet) => {
        WalletSyncService.applyWalletToStores(wallet, true);
        return wallet;
      }).catch((error) => {
        console.warn("[DeployAccount] Failed to persist deployed wallet metadata", error);
        return null;
      });

      if (!result.alreadyDeployed) {
        getSupabaseClient()
          .from("notifications")
          .insert({
            user_id: user.id,
            aa_wallet_id: syncedWallet?.id ?? null,
            category: "system",
            status: "unread",
            title: "Smart Account Deployed",
            body: `Your smart account (${accountAddress.slice(0, 6)}…${accountAddress.slice(-4)}) is live on-chain.`,
            icon: "zap",
            accent: null,
            payload: {
              type: "account_deployed",
              address: accountAddress,
              chain_id: chainId,
              tx_hash: result.transactionHash ?? null,
            },
          })
          .then(({ error }) => {
            if (error) console.warn("[DeployAccount] notification insert failed:", error.message);
          });
      }

      setDeployedAddress(accountAddress);
      setCurrentStep("success");
    } catch (error) {
      console.error("Deployment error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Deployment failed",
      );
      setDeploymentStatus(
        "failed",
        error instanceof Error ? error.message : undefined,
      );
      setCurrentStep("error");
    }
  };

  const handleRetry = useCallback(() => {
    setCurrentStep("intro");
    setErrorMessage("");
    setDeploymentStatus("idle");
  }, [setDeploymentStatus]);

  const handleGoHome = useCallback(() => {
    navigation.reset({
      index: 0,
      routes: [{ name: "TabNavigation" }],
    });
  }, [navigation]);

  const chainName = getChainConfig(deploymentChainId)?.name ?? "this chain";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {currentStep !== "deploying" && currentStep !== "success" && (
          <Pressable
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={20} color={colors.textPrimary} />
          </Pressable>
        )}
        <Text style={styles.headerTitle}>Activate Account</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <DeployAccountSheetBody
          step={currentStep}
          chainName={chainName}
          deployedAddress={deployedAddress || aaAccount?.predictedAddress || null}
          errorMessage={errorMessage || null}
          onActivate={handleNext}
          onRetry={handleRetry}
          onDone={handleGoHome}
        />
      </ScrollView>
    </View>
  );
}

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
      paddingHorizontal: 16,
      paddingTop: 60,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.surfaceElevated,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      padding: 24,
    },
  });
