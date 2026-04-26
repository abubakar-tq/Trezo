import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useUserStore } from "@store/useUserStore";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { AccountDeploymentService, deriveDefaultWalletId } from "@/src/features/wallet/services/AccountDeploymentService";
import { devFundSmartAccount, DEV_FUNDING_AMOUNT_ETH } from "@/src/features/wallet/services/devFunding";
import { DEFAULT_CHAIN_ID, isPortableChain, type SupportedChainId } from "@/src/integration/chains";
import type { AAAccount } from "@/src/features/wallet/store/useWalletStore";
import { type Address } from "viem";

export const useAccountManagement = () => {
  const { user, profile, smartAccountAddress, smartAccountDeployed, setSmartAccountAddress, setSmartAccountDeployed } = useUserStore();
  const { aaAccount, setAAAccount, markAsDeployed } = useWalletStore();
  
  const [deployingAccount, setDeployingAccount] = useState(false);
  const [fundingAccount, setFundingAccount] = useState(false);
  const [accountActionStatus, setAccountActionStatus] = useState<string | null>(null);
  const [accountModalVisible, setAccountModalVisible] = useState(false);

  const userId = user?.id ?? null;
  const resolvedDeployChainId = (aaAccount?.chainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;

  const fundSmartAccount = useCallback(
    async (targetAddress?: string, options?: { silent?: boolean }) => {
      const destination = (targetAddress ?? smartAccountAddress) as Address | undefined;
      if (!destination) {
        if (!options?.silent) {
          Alert.alert("No Address", "Deploy your smart account before funding it.");
        }
        return null;
      }
      try {
        setFundingAccount(true);
        setAccountActionStatus("Funding smart account…");
        const { transactionHash } = await devFundSmartAccount({
          address: destination,
          chainId: resolvedDeployChainId,
        });
        if (!options?.silent) {
          Alert.alert("Account Funded", `Sent ${DEV_FUNDING_AMOUNT_ETH} ETH to:\n${destination}`);
        }
        return transactionHash;
      } catch (error) {
        if (!options?.silent) {
          Alert.alert("Funding Failed", error instanceof Error ? error.message : "Unable to fund account");
        }
        throw error;
      } finally {
        setFundingAccount(false);
        setAccountActionStatus(null);
      }
    },
    [smartAccountAddress, resolvedDeployChainId]
  );

  const handleDeploySmartAccount = useCallback(async () => {
    if (deployingAccount) return;
    if (!userId) {
      Alert.alert("Sign In Required", "Please sign in before deploying your smart account.");
      return;
    }
    try {
      setDeployingAccount(true);
      setAccountActionStatus("Preparing deployment…");

      let passkey = await PasskeyService.getPasskey(userId);
      if (!passkey) {
        const created = await PasskeyService.createPasskey(userId);
        passkey = created ?? (await PasskeyService.getPasskey(userId));
      }
      if (!passkey) throw new Error("Unable to access passkey credentials.");

      const walletIndex = aaAccount?.walletIndex ?? 0;
      const walletId = (aaAccount?.walletId ?? deriveDefaultWalletId(userId)) as `0x${string}`;
      const deploymentMode = aaAccount?.deploymentMode ?? (isPortableChain(resolvedDeployChainId) ? "portable" : "chain-specific");
      
      const predictedAddress = await AccountDeploymentService.predictAddress(
        walletId, passkey, resolvedDeployChainId, walletIndex, deploymentMode
      );
      
      setAccountActionStatus("Authenticating and sending deployment UserOperation…");
      const result = await AccountDeploymentService.deployWithPasskeyAuth(userId, {
        chainId: resolvedDeployChainId, passkey, walletId, walletIndex, mode: deploymentMode
      });

      const deployedAccount: AAAccount = {
        id: `local-${userId}`,
        userId,
        walletId,
        walletIndex,
        deploymentMode,
        predictedAddress: result.accountAddress,
        ownerAddress: passkey.credentialIdRaw,
        chainId: resolvedDeployChainId,
        isDeployed: true,
        deploymentTxHash: result.transactionHash,
        deployedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        walletName: `${profile?.username ?? "Primary"} Smart Account`,
      };

      setAAAccount(deployedAccount);
      setSmartAccountAddress(result.accountAddress);
      setSmartAccountDeployed(true);
      if (!result.alreadyDeployed) {
        markAsDeployed(result.transactionHash!, result.blockNumber!);
      }

      await fundSmartAccount(result.accountAddress, { silent: true });
      Alert.alert("Smart Account Ready", `Deployed at:\n${result.accountAddress}`);
    } catch (error) {
      Alert.alert("Deployment Failed", error instanceof Error ? error.message : "Unable to deploy account");
    } finally {
      setDeployingAccount(false);
      setAccountActionStatus(null);
    }
  }, [aaAccount, userId, profile?.username, resolvedDeployChainId, fundSmartAccount, setAAAccount, setSmartAccountAddress, setSmartAccountDeployed, markAsDeployed]);

  return {
    deployingAccount,
    fundingAccount,
    accountActionStatus,
    accountModalVisible,
    setAccountModalVisible,
    handleDeploySmartAccount,
    fundSmartAccount,
    smartAccountAddress,
    smartAccountDeployed,
  };
};
