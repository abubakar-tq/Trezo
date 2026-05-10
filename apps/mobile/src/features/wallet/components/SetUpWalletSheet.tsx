import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import { TrezoBottomSheet } from "@shared/components/sheets/TrezoBottomSheet";
import { BorderRadius } from "@shared/components/TokenRegistry";
import { LABELS } from "@shared/copy/labels";
import {
  AccountDeploymentService,
  deriveDefaultWalletId,
} from "@features/wallet/services/AccountDeploymentService";
import PasskeyService from "@features/wallet/services/PasskeyService";
import WalletSyncService from "@features/wallet/services/WalletSyncService";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";
import {
  DEFAULT_CHAIN_ID,
  isPortableChain,
  type SupportedChainId,
} from "@/src/integration/chains";
import { useAppTheme } from "@theme";

export type SetUpSheetHandle = {
  present: (onSuccess: () => void) => void;
  dismiss: () => void;
};

type Step = "intro" | "passkey" | "predicting" | "success" | "error";

export const SetUpWalletSheet = forwardRef<SetUpSheetHandle>((_, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [step, setStep] = useState<Step>("intro");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const onSuccessRef = useRef<(() => void) | null>(null);
  const { theme } = useAppTheme();

  const user = useUserStore((s) => s.user);
  const setSmartAccountAddress = useUserStore((s) => s.setSmartAccountAddress);
  const aaAccount = useWalletStore((s) => s.aaAccount);

  useImperativeHandle(ref, () => ({
    present: (cb) => {
      setStep("intro");
      setErrorMessage(null);
      onSuccessRef.current = cb;
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const run = useCallback(async () => {
    if (!user) {
      setErrorMessage("Sign in first.");
      setStep("error");
      return;
    }

    try {
      setStep("passkey");
      const passkey = await PasskeyService.createPasskey(user.id);

      setStep("predicting");

      const deploymentChainId = DEFAULT_CHAIN_ID as SupportedChainId;
      const walletIndex = aaAccount?.walletIndex ?? 0;
      const walletId = (
        aaAccount?.walletId ?? deriveDefaultWalletId(user.id)
      ) as `0x${string}`;
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
      }).then((wallet) => {
        WalletSyncService.applyWalletToStores(wallet, false);
      }).catch((error) => {
        console.warn("[SetUpWalletSheet] Failed to persist predicted wallet metadata", error);
      });

      setStep("success");
    } catch (e: any) {
      console.error("[SetUpWalletSheet] Setup error:", e);
      const msg = e instanceof Error ? e.message : "Setup failed";
      setErrorMessage(msg);
      setStep("error");
    }
  }, [user, aaAccount, setSmartAccountAddress]);

  return (
    <TrezoBottomSheet ref={sheetRef} snapPoints={["55%"]} enableDynamicSizing>
      <View style={styles.stage}>
        {step === "intro" && (
          <>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {LABELS.setUpYourWallet}
            </Text>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              Confirm with your passkey to create your wallet address.
            </Text>
            <Pressable
              onPress={run}
              style={[styles.cta, { backgroundColor: theme.colors.accent }]}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
          </>
        )}
        {step === "passkey" && (
          <>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              {LABELS.passkeyConfirmation}
            </Text>
          </>
        )}
        {step === "predicting" && (
          <>
            <ActivityIndicator size="large" color={theme.colors.accent} />
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Preparing your address.
            </Text>
          </>
        )}
        {step === "success" && (
          <>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              You're ready to receive.
            </Text>
            <Pressable
              onPress={() => {
                sheetRef.current?.dismiss();
                onSuccessRef.current?.();
              }}
              style={[styles.cta, { backgroundColor: theme.colors.accent }]}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
          </>
        )}
        {step === "error" && (
          <>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
              Setup failed.
            </Text>
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              {errorMessage ?? "Please try again."}
            </Text>
            <Pressable
              onPress={run}
              style={[styles.cta, { backgroundColor: theme.colors.accent }]}
            >
              <Text style={styles.ctaText}>Retry</Text>
            </Pressable>
          </>
        )}
      </View>
    </TrezoBottomSheet>
  );
});

SetUpWalletSheet.displayName = "SetUpWalletSheet";

const styles = StyleSheet.create({
  stage: { alignItems: "center", paddingVertical: 24, gap: 16 },
  title: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  body: { fontSize: 14, textAlign: "center", paddingHorizontal: 16 },
  cta: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: BorderRadius.xl,
    marginTop: 8,
  },
  ctaText: { color: "#000", fontWeight: "700" },
});
