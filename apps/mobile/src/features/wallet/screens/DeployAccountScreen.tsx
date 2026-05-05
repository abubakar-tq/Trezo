/**
 * Deploy Account Screen
 *
 * Guides users through the AA wallet deployment process:
 * 1. Explain benefits of Account Abstraction
 * 2. Show deployment cost estimate
 * 3. Check EOA balance (ensure enough for gas)
 * 4. Create passkey with biometric prompt
 * 5. Deploy via ERC-4337 bundler + passkey-authenticated UserOperation
 * 6. Show success screen with deployed address
 */

import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
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
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

type DeployStep = "intro" | "passkey" | "deploying" | "success" | "error";
  
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
      setCurrentStep("passkey");
    } else if (currentStep === "passkey") {
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

      // Create passkey (biometric prompt handled inside)
      const passkey = await PasskeyService.createPasskey(user.id);

      // Predict AA address from stable wallet identity; passkey state stays outside the address formula.
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

      await WalletSyncService.persistWalletMetadata({
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
      }).catch((error) => {
        console.warn("[DeployAccount] Failed to persist deployed wallet metadata", error);
      });

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

  const renderStep = () => {
    switch (currentStep) {
      case "intro":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Feather name="zap" size={32} color={colors.accent} />
            </View>

            <Text style={styles.stepTitle}>Smart Account Benefits</Text>
            <Text style={styles.stepDescription}>
              Deploy an Account Abstraction wallet with your passkey:
            </Text>

            <View style={styles.benefitsList}>
              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Feather name="gift" size={20} color={colors.success} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>Gasless Transactions</Text>
                  <Text style={styles.benefitText}>
                    Send transactions without paying gas fees thanks to
                    paymaster sponsorship
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Feather name="shield" size={20} color={colors.accent} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>
                    Social Recovery (coming soon)
                  </Text>
                  <Text style={styles.benefitText}>
                    Add trusted guardians to recover your wallet if you lose
                    access
                  </Text>
                </View>
              </View>

              <View style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Feather name="smartphone" size={20} color={colors.warning} />
                </View>
                <View style={styles.benefitContent}>
                  <Text style={styles.benefitTitle}>Multi-Device Access</Text>
                  <Text style={styles.benefitText}>
                    Use biometric authentication across multiple devices
                    securely
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
              <Text style={styles.primaryButtonText}>Continue</Text>
              <Feather name="arrow-right" size={18} color={colors.background} />
            </TouchableOpacity>
          </View>
        );
      case "passkey":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.iconCircle}>
              <Feather name="lock" size={32} color={colors.accent} />
            </View>

            <Text style={styles.stepTitle}>Secure with Biometrics</Text>
            <Text style={styles.stepDescription}>
              Create a passkey using your device&apos;s biometric authentication
            </Text>

            <View style={styles.passkeyCard}>
              <Feather
                name="shield-off"
                size={48}
                color={colors.accent}
                style={{ opacity: 0.3 }}
              />
              <Text style={styles.passkeyTitle}>Touch to Authenticate</Text>
              <Text style={styles.passkeyText}>
                Use your fingerprint or face ID to secure your smart account
              </Text>
            </View>

            <View style={styles.infoBox}>
              <Feather name="lock" size={16} color={colors.success} />
              <Text style={styles.infoText}>
                Your biometric data stays on your device. We only store a
                cryptographic public key.
              </Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
              <Feather name="unlock" size={18} color={colors.background} />
              <Text style={styles.primaryButtonText}>Authenticate</Text>
            </TouchableOpacity>
          </View>
        );

      case "deploying":
        return (
          <View style={styles.stepContainer}>
            <ActivityIndicator size="large" color={colors.accent} />

            <Text style={styles.stepTitle}>Deploying Your Smart Account</Text>
            <Text style={styles.stepDescription}>
              Please wait while we deploy your account on-chain...
            </Text>

            <View style={styles.progressSteps}>
              <View style={styles.progressStep}>
                <View style={[styles.progressDot, styles.progressDotActive]}>
                  <Feather name="check" size={14} color={colors.background} />
                </View>
                <Text style={styles.progressLabel}>Predicting address</Text>
              </View>

              <View style={styles.progressLine} />

              <View style={styles.progressStep}>
                <View style={[styles.progressDot, styles.progressDotActive]}>
                  <ActivityIndicator size="small" color={colors.background} />
                </View>
                <Text style={styles.progressLabel}>Deploying contract</Text>
              </View>

              <View style={styles.progressLine} />

              <View style={styles.progressStep}>
                <View style={styles.progressDot} />
                <Text
                  style={[styles.progressLabel, styles.progressLabelInactive]}
                >
                  Confirming transaction
                </Text>
              </View>
            </View>

            <Text style={styles.deployNote}>
              This may take 10-30 seconds depending on network congestion
            </Text>
          </View>
        );

      case "success":
        return (
          <View style={styles.stepContainer}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: withAlpha(colors.success, 0.15) },
              ]}
            >
              <Feather name="check-circle" size={32} color={colors.success} />
            </View>

            <Text style={styles.stepTitle}>Smart Account Deployed! 🎉</Text>
            <Text style={styles.stepDescription}>
              Your Account Abstraction wallet is now live on-chain
            </Text>

            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>
                Your Smart Account Address
              </Text>
              <Text style={styles.addressValue}>
                {deployedAddress || aaAccount?.predictedAddress}
              </Text>
              <Text style={styles.addressNote}>
                You can now send gasless transactions and enjoy all AA benefits
              </Text>
            </View>

            <View style={styles.successFeatures}>
              <View style={styles.successFeature}>
                <Feather name="check" size={16} color={colors.success} />
                <Text style={styles.successFeatureText}>
                  Gasless transactions enabled
                </Text>
              </View>
              <View style={styles.successFeature}>
                <Feather name="check" size={16} color={colors.success} />
                <Text style={styles.successFeatureText}>
                  Biometric authentication active
                </Text>
              </View>
              <View style={styles.successFeature}>
                <Feather name="check" size={16} color={colors.success} />
                <Text style={styles.successFeatureText}>
                  Ready for guardians & recovery
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleGoHome}
            >
              <Feather name="home" size={18} color={colors.background} />
              <Text style={styles.primaryButtonText}>Go to Home</Text>
            </TouchableOpacity>
          </View>
        );

      case "error":
        return (
          <View style={styles.stepContainer}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: withAlpha(colors.danger, 0.15) },
              ]}
            >
              <Feather name="alert-triangle" size={32} color={colors.danger} />
            </View>

            <Text style={styles.stepTitle}>Deployment Failed</Text>
            <Text style={styles.stepDescription}>
              Something went wrong during the deployment process
            </Text>

            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Error Details</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleGoHome}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleRetry}
              >
                <Feather
                  name="refresh-ccw"
                  size={18}
                  color={colors.background}
                />
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

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
        <Text style={styles.headerTitle}>Deploy Smart Account</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
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
      borderBottomColor: withAlpha(colors.border, 0.3),
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: withAlpha(colors.surfaceElevated, 0.6),
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
    stepContainer: {
      alignItems: "center",
      gap: 20,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: withAlpha(colors.accent, 0.15),
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: withAlpha(colors.accent, 0.3),
      marginTop: 20,
    },
    stepTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    stepDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 22,
      paddingHorizontal: 10,
    },
    benefitsList: {
      width: "100%",
      gap: 16,
      marginTop: 10,
    },
    benefitItem: {
      flexDirection: "row",
      gap: 14,
      backgroundColor: withAlpha(colors.surfaceElevated, 0.5),
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.4),
    },
    benefitIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: withAlpha(colors.success, 0.15),
      alignItems: "center",
      justifyContent: "center",
    },
    benefitContent: {
      flex: 1,
      gap: 4,
    },
    benefitTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    benefitText: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    costCard: {
      width: "100%",
      backgroundColor: withAlpha(colors.accent, 0.08),
      borderWidth: 1.5,
      borderColor: withAlpha(colors.accent, 0.3),
      borderRadius: 20,
      padding: 24,
      alignItems: "center",
      gap: 8,
    },
    costLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    costValue: {
      fontSize: 36,
      fontWeight: "800",
      color: colors.accent,
    },
    costNote: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
    },
    infoBox: {
      flexDirection: "row",
      gap: 10,
      backgroundColor: withAlpha(colors.accent, 0.08),
      padding: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: withAlpha(colors.accent, 0.2),
      alignItems: "flex-start",
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    balanceCard: {
      width: "100%",
      backgroundColor: withAlpha(colors.surfaceElevated, 0.6),
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.4),
      borderRadius: 20,
      padding: 24,
      alignItems: "center",
      gap: 8,
    },
    balanceLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    balanceValue: {
      fontSize: 32,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    balanceAddress: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    },
    statusBox: {
      width: "100%",
      flexDirection: "row",
      gap: 10,
      padding: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      alignItems: "center",
    },
    statusSuccess: {
      backgroundColor: withAlpha(colors.success, 0.1),
      borderColor: withAlpha(colors.success, 0.4),
    },
    statusWarning: {
      backgroundColor: withAlpha(colors.warning, 0.1),
      borderColor: withAlpha(colors.warning, 0.4),
    },
    statusText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      lineHeight: 18,
    },
    passkeyCard: {
      width: "100%",
      backgroundColor: withAlpha(colors.surfaceElevated, 0.5),
      borderWidth: 2,
      borderColor: withAlpha(colors.accent, 0.3),
      borderRadius: 20,
      padding: 32,
      alignItems: "center",
      gap: 12,
    },
    passkeyTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    passkeyText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },
    progressSteps: {
      width: "100%",
      alignItems: "center",
      gap: 0,
      marginVertical: 20,
    },
    progressStep: {
      alignItems: "center",
      gap: 8,
    },
    progressDot: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: withAlpha(colors.textMuted, 0.2),
      borderWidth: 2,
      borderColor: withAlpha(colors.border, 0.4),
      alignItems: "center",
      justifyContent: "center",
    },
    progressDotActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    progressLabel: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    progressLabelInactive: {
      color: colors.textMuted,
    },
    progressLine: {
      width: 2,
      height: 30,
      backgroundColor: withAlpha(colors.border, 0.4),
    },
    deployNote: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 10,
    },
    addressCard: {
      width: "100%",
      backgroundColor: withAlpha(colors.success, 0.08),
      borderWidth: 1.5,
      borderColor: withAlpha(colors.success, 0.3),
      borderRadius: 20,
      padding: 20,
      alignItems: "center",
      gap: 10,
    },
    addressLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    addressValue: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
      fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
      textAlign: "center",
    },
    addressNote: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 17,
    },
    successFeatures: {
      width: "100%",
      gap: 10,
    },
    successFeature: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
    },
    successFeatureText: {
      fontSize: 14,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    errorCard: {
      width: "100%",
      backgroundColor: withAlpha(colors.danger, 0.08),
      borderWidth: 1.5,
      borderColor: withAlpha(colors.danger, 0.3),
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    errorTitle: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.danger,
    },
    errorMessage: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
    },
    primaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.accent,
      paddingHorizontal: 32,
      paddingVertical: 16,
      borderRadius: 16,
      width: "100%",
      marginTop: 10,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.background,
      letterSpacing: 0.5,
    },
    secondaryButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.textMuted, 0.15),
      paddingVertical: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: withAlpha(colors.border, 0.4),
    },
    secondaryButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    buttonRow: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
      marginTop: 10,
    },
  });
