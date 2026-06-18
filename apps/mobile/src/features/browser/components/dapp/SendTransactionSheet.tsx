import React, { forwardRef, useImperativeHandle } from "react";
import { useWalletStore } from "@features/wallet/store/useWalletStore";
import { useUserStore } from "@/src/store/useUserStore";
import { useDAppSessionsStore } from "@features/browser/store/useDAppSessionsStore";
import { TransactionConfirmSheet } from "@features/transactions/components/TransactionConfirmSheet";
import { useTransactionConfirmation } from "@features/transactions/hooks/useTransactionConfirmation";
import { buildDappPreview } from "./buildDappPreview";
import {
  DEFAULT_CHAIN_ID,
  getChainConfig,
  SUPPORTED_CHAIN_IDS,
  type SupportedChainId,
} from "@/src/integration/chains";

export type SendTransactionHandle = {
  ask: (
    origin: string,
    tx: { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` },
  ) => Promise<boolean>;
};

export const SendTransactionSheet = forwardRef<SendTransactionHandle>((_, ref) => {
  // ── Unified confirm-sheet orchestrator ─────────────────────────────────────
  const tc = useTransactionConfirmation();

  useImperativeHandle(ref, () => ({
    ask: async (origin, tx) => {
      // Read identity + chain fresh from stores to avoid stale-closure values
      // (this sheet mounts once and persists, so closure-captured values can be
      // stale null even after login — matching the getState() pattern already
      // used for the session chainId below).
      const accountAddress = (
        useWalletStore.getState().aaAccount?.predictedAddress ??
        useUserStore.getState().smartAccountAddress ??
        null
      ) as `0x${string}` | null;
      const userId = useUserStore.getState().user?.id ?? null;

      // Guard: wallet identity must be resolved before we can confirm
      if (!accountAddress || !userId) return false;

      // Resolve chainId from the existing dApp session for this origin;
      // fall back to activeChainId / DEFAULT_CHAIN_ID.
      const session = useDAppSessionsStore.getState().findSession(origin);
      const rawChainId =
        session?.chainId ??
        useWalletStore.getState().activeChainId ??
        DEFAULT_CHAIN_ID;
      const chainId: SupportedChainId = (SUPPORTED_CHAIN_IDS as readonly number[]).includes(rawChainId)
        ? (rawChainId as SupportedChainId)
        : DEFAULT_CHAIN_ID;

      const chainConfig = getChainConfig(chainId);
      const networkName = chainConfig?.name ?? `Chain ${chainId}`;

      // Build the TxPreview from the raw dApp call params
      const preview = buildDappPreview(origin, tx, accountAddress, chainId, networkName);

      // Build the execution descriptor that the hook uses for UserOp preparation + gas
      const execution = {
        chainId,
        account: accountAddress,
        target: tx.to,
        value: tx.value ? BigInt(tx.value) : 0n,
        data: (tx.data ?? "0x") as `0x${string}`,
        operationLabel: "dapp-call",
        riskLevel: "medium" as const,
      };

      // present sheet, run prepare+simulate, await user decision
      const { approved } = await tc.confirm({
        preview,
        execution,
        userId,
        usePaymaster: Boolean(chainConfig?.paymasterUrl),
      });

      return approved;
    },
  }));

  return (
    <TransactionConfirmSheet
      ref={tc.sheetRef}
      preview={tc.preview}
      simulation={tc.simulation}
      gasFee={tc.gasFee}
      loading={tc.loading}
      onApprove={tc.onApprove}
      onReject={tc.onReject}
      onDismiss={tc.onDismiss}
    />
  );
});

SendTransactionSheet.displayName = "SendTransactionSheet";
