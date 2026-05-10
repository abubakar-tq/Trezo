import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import { TrezoBottomSheet } from "@shared/components/sheets/TrezoBottomSheet";
import { DeployAccountSheetBody } from "./DeployAccountSheetBody";
import type { DeployStep } from "@features/wallet/types/deploy";
import { getChainConfig, isPortableChain, type SupportedChainId } from "@/src/integration/chains";
import { useAccountState } from "@features/wallet/hooks/useAccountState";
import {
  AccountDeploymentService,
  deriveDefaultWalletId,
} from "@features/wallet/services/AccountDeploymentService";
import PasskeyService from "@features/wallet/services/PasskeyService";
import WalletSyncService from "@features/wallet/services/WalletSyncService";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";
import { getSupabaseClient } from "@lib/supabase";

export type ActivationSheetHandle = {
  present: (chainId: number, onSuccess: () => void) => void;
  dismiss: () => void;
};

export const ActivationSheet = forwardRef<ActivationSheetHandle>((_, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [step, setStep] = useState<DeployStep>("intro");
  const [chainId, setChainId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const onSuccessRef = useRef<(() => void) | null>(null);

  const accountState = useAccountState();

  // Store selectors — mirror DeployAccountScreen exactly
  const user = useUserStore((s) => s.user);
  const setSmartAccountAddress = useUserStore((s) => s.setSmartAccountAddress);
  const setSmartAccountDeployed = useUserStore((s) => s.setSmartAccountDeployed);
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const activeChainId = useWalletStore((s) => s.activeChainId);
  const setAAAccount = useWalletStore((s) => s.setAAAccount);
  const setDeploymentStatus = useWalletStore((s) => s.setDeploymentStatus);
  const markAsDeployed = useWalletStore((s) => s.markAsDeployed);

  useImperativeHandle(ref, () => ({
    present: (cId, onSuccess) => {
      setChainId(cId);
      setStep("intro");
      setErrorMessage(null);
      setDeployedAddress(null);
      onSuccessRef.current = onSuccess;
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const resolvedChainId = (chainId ?? activeChainId ?? 31337) as SupportedChainId;
  const chainName = getChainConfig(resolvedChainId)?.name ?? "this chain";

  const runActivation = useCallback(async () => {
    if (!chainId) return;

    try {
      if (!user) {
        setErrorMessage("User not authenticated");
        setStep("error");
        return;
      }

      const deploymentChainId = resolvedChainId;

      // ── Passkey: create only when unprovisioned; reuse existing when provisioned ──
      let passkey: Awaited<ReturnType<typeof PasskeyService.createPasskey>>;
      if (accountState.status === "unprovisioned") {
        setStep("passkey");
        passkey = await PasskeyService.createPasskey(user.id);
      } else {
        // Provisioned: existing passkey is already bound — just retrieve it from storage.
        const existing = await PasskeyService.getPasskey(user.id);
        if (!existing) {
          setErrorMessage("No passkey found on this device. Please re-register.");
          setStep("error");
          return;
        }
        passkey = existing;
      }

      const walletIndex = aaAccount?.walletIndex ?? 0;
      const walletId = (aaAccount?.walletId ?? deriveDefaultWalletId(user.id)) as `0x${string}`;
      const deploymentMode =
        aaAccount?.deploymentMode ??
        (isPortableChain(deploymentChainId) ? "portable" : "chain-specific");

      const predictedAddress = await AccountDeploymentService.predictAddress(
        walletId,
        passkey,
        deploymentChainId,
        walletIndex,
        deploymentMode,
      );
      setSmartAccountAddress(predictedAddress);

      await WalletSyncService.persistWalletMetadata({
        userId: user.id,
        predictedAddress,
        ownerAddress: passkey.credentialIdRaw,
        walletName: aaAccount?.walletName ?? "Passkey Smart Account",
        chainId: deploymentChainId,
        walletId,
        walletIndex,
        deploymentMode,
      }).catch((error) => {
        console.warn("[ActivationSheet] Failed to persist predicted wallet metadata", error);
      });

      // ── Deploy ─────────────────────────────────────────────────────────────
      setStep("deploying");
      setDeploymentStatus("deploying");

      const chain = getChainConfig(deploymentChainId);
      const usePaymaster = Boolean(chain.paymasterUrl);

      // Exact call from DeployAccountScreen.handleDeploy:
      const result = await AccountDeploymentService.deployWithPasskeyAuth(
        user.id,
        {
          chainId: deploymentChainId,
          passkey,
          walletId: walletId as `0x${string}`,
          walletIndex,
          mode: deploymentMode,
          usePaymaster,
          paymasterUrl: chain.paymasterUrl,
        },
      );

      const accountAddress = result.accountAddress;

      if (!result.alreadyDeployed) {
        markAsDeployed(result.transactionHash!, Number(result.blockNumber));
      } else {
        setDeploymentStatus("deployed");
      }

      setAAAccount({
        id: user.id || "passkey-wallet",
        userId: user.id || "passkey-wallet",
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
        chainId: deploymentChainId,
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
        chainId: deploymentChainId,
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
        console.warn("[ActivationSheet] Failed to persist deployed wallet metadata", error);
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
              chain_id: deploymentChainId,
              tx_hash: result.transactionHash ?? null,
            },
          })
          .then(({ error }) => {
            if (error) console.warn("[ActivationSheet] notification insert failed:", error.message);
          });
      }

      setDeployedAddress(accountAddress);
      setStep("success");
    } catch (e: any) {
      console.error("[ActivationSheet] Activation error:", e);
      const msg = e instanceof Error ? e.message : "Activation failed";
      setErrorMessage(msg);
      setDeploymentStatus("failed", msg);
      setStep("error");
    }
  }, [
    chainId,
    resolvedChainId,
    user,
    aaAccount,
    setSmartAccountAddress,
    setSmartAccountDeployed,
    setAAAccount,
    setDeploymentStatus,
    markAsDeployed,
    accountState.status,
  ]);

  return (
    <TrezoBottomSheet ref={sheetRef} snapPoints={["60%"]} enableDynamicSizing>
      {chainId !== null && (
        <DeployAccountSheetBody
          step={step}
          chainName={chainName}
          deployedAddress={deployedAddress}
          errorMessage={errorMessage}
          onActivate={runActivation}
          onRetry={runActivation}
          onDone={() => {
            sheetRef.current?.dismiss();
            onSuccessRef.current?.();
          }}
        />
      )}
    </TrezoBottomSheet>
  );
});

ActivationSheet.displayName = "ActivationSheet";
