/**
 * BridgeExecutionService.ts
 *
 * Executes a bridge plan as one (or two, if approval is needed) UserOps
 * through the smart account. Same shape as SwapExecutionService:
 *   1. Optional ERC20 approval to the SpokePool
 *   2. SpokePool.depositV3 carrying the encoded BridgeMessage
 *
 * Receipt confirmation on the source chain only signals that the deposit was
 * accepted by Across — the actual destination-chain fill happens
 * asynchronously when the relayer (see ADR 0008) settles the deposit.
 */

import { BalanceService } from "@/src/features/assets/services/BalanceService";
import { BridgePreparationService } from "@/src/features/swaps/services/BridgePreparationService";
import type {
  BridgeExecutionResult,
  BridgeIntent,
} from "@/src/features/swaps/types/bridge";
import {
  TransactionHistoryService,
  type CreateWalletTransactionInput,
  type WalletTransaction,
} from "@/src/features/transactions";
import { SmartAccountExecutionService } from "@/src/features/wallet/services/SmartAccountExecutionService";

const isUserCancellation = (errorValue: unknown): boolean => {
  const message = errorValue instanceof Error
    ? errorValue.message
    : typeof errorValue === "string"
      ? errorValue
      : "";

  const lowered = message.toLowerCase();
  return (
    lowered.includes("cancel")
    || lowered.includes("cancelled")
    || lowered.includes("aborted")
    || lowered.includes("notallowed")
    || lowered.includes("user denied")
  );
};

const getErrorDetails = (errorValue: unknown): { errorCode?: string | null; errorMessage: string } => {
  const errorCode = typeof errorValue === "object"
    && errorValue !== null
    && "code" in errorValue
    ? String((errorValue as { code?: unknown }).code)
    : null;

  const errorMessage = errorValue instanceof Error
    ? errorValue.message
    : typeof errorValue === "string"
      ? errorValue
      : "Unknown bridge execution failure";

  return { errorCode, errorMessage };
};

const createIntentId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

type ExecuteBridgeOptions = {
  waitForReceipt?: boolean;
  receiptTimeoutMs?: number;
  receiptPollIntervalMs?: number;
  bundlerUrl?: string;
  paymasterUrl?: string;
};

type ExecutionStepResult = {
  status: "pending" | "confirmed" | "failed" | "cancelled";
  row: WalletTransaction;
  error?: string;
};

const executeRow = async (params: {
  userId: string;
  transactionId: string;
  execution: {
    chainId: BridgeIntent["sourceChainId"];
    account: BridgeIntent["walletAddress"];
    target: `0x${string}`;
    value: bigint;
    data: `0x${string}`;
    operationLabel: string;
    riskLevel: "low" | "medium" | "high";
    metadata?: Record<string, unknown>;
  };
  waitForReceipt: boolean;
  receiptTimeoutMs?: number;
  receiptPollIntervalMs?: number;
  bundlerUrl?: string;
  paymasterUrl?: string;
}): Promise<ExecutionStepResult> => {
  let didSubmit = false;

  try {
    await TransactionHistoryService.markPrepared(params.transactionId, {
      targetAddress: params.execution.target,
      valueRaw: params.execution.value.toString(),
      calldata: params.execution.data,
      metadata: params.execution.metadata,
    });

    const preparedUserOp = await SmartAccountExecutionService.prepareUserOperation(params.execution, {
      userId: params.userId,
      usePaymaster: true,
      bundlerUrl: params.bundlerUrl,
      paymasterUrl: params.paymasterUrl,
    });

    await TransactionHistoryService.markSigning(params.transactionId);

    const signedUserOp = await SmartAccountExecutionService.signUserOperation(params.userId, preparedUserOp);

    await TransactionHistoryService.markSigned(params.transactionId, {
      signatureBytes: signedUserOp.signature.length > 2
        ? (signedUserOp.signature.length - 2) / 2
        : 0,
      userOpHash: signedUserOp.userOpHash,
    });

    const submission = await SmartAccountExecutionService.submitUserOperation(signedUserOp);
    didSubmit = true;

    await TransactionHistoryService.markSubmitted({
      id: params.transactionId,
      userOpHash: submission.submittedUserOpHash,
    });

    const pendingRow = await TransactionHistoryService.markPending(params.transactionId);

    if (!params.waitForReceipt) {
      return { status: "pending", row: pendingRow };
    }

    const receipt = await SmartAccountExecutionService.waitForReceipt(submission, {
      timeoutMs: params.receiptTimeoutMs,
      pollIntervalMs: params.receiptPollIntervalMs,
    });

    if (!receipt.success) {
      const failed = await TransactionHistoryService.markFailed({
        id: params.transactionId,
        errorMessage: "UserOperation receipt indicates failure",
        debugContext: {
          submittedUserOpHash: receipt.submittedUserOpHash,
          receiptSuccess: false,
        },
      });
      return {
        status: "failed",
        row: failed,
        error: "UserOperation receipt indicates failure",
      };
    }

    const confirmed = await TransactionHistoryService.markConfirmed({
      id: params.transactionId,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      debugContext: {
        submittedUserOpHash: receipt.submittedUserOpHash,
        receiptSuccess: true,
      },
    });

    return { status: "confirmed", row: confirmed };
  } catch (error) {
    if (isUserCancellation(error) && !didSubmit) {
      const cancelled = await TransactionHistoryService.markCancelled(params.transactionId, "passkey_prompt_cancelled");
      return {
        status: "cancelled",
        row: cancelled,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const { errorCode, errorMessage } = getErrorDetails(error);
    const failed = await TransactionHistoryService.markFailed({
      id: params.transactionId,
      errorCode,
      errorMessage,
    });

    return { status: "failed", row: failed, error: errorMessage };
  }
};

const withIntentMeta = (
  base: CreateWalletTransactionInput,
  intentId: string,
  sequenceIndex: number,
  parentTransactionId?: string,
): CreateWalletTransactionInput => ({
  ...base,
  intentId,
  sequenceIndex,
  parentTransactionId: parentTransactionId ?? null,
});

export class BridgeExecutionService {
  static async executeBridge(
    intent: BridgeIntent,
    options?: ExecuteBridgeOptions,
  ): Promise<BridgeExecutionResult> {
    let plan = await BridgePreparationService.prepareBridge(intent);
    const intentId = createIntentId();

    // ── Staleness check on the quote ─────────────────────────────────────────
    const MAX_QUOTE_AGE_MS = 30_000;
    if (Date.now() - plan.quotedAt > MAX_QUOTE_AGE_MS) {
      const fresh = await BridgePreparationService.prepareBridge(intent);
      const oldOut = plan.quote.outputAmountRaw;
      const newOut = fresh.quote.outputAmountRaw;
      const allowedDriftBps = BigInt(intent.slippageBps);
      if (newOut < oldOut) {
        const driftBps = ((oldOut - newOut) * 10_000n) / oldOut;
        if (driftBps > allowedDriftBps) {
          throw new Error("Bridge quote is stale: output moved beyond slippage tolerance");
        }
      }
      plan = fresh;
    }

    let approvalDraftId: string | undefined;
    let approvalRow: WalletTransaction | undefined;
    let bridgeDraftId: string | undefined;
    let bridgeRow: WalletTransaction | undefined;

    if (plan.approvalRequired) {
      if (!plan.approvalExecution || !plan.approvalTransactionInput) {
        throw new Error("Approval was required but approval execution details were not prepared.");
      }

      const approvalDraft = await TransactionHistoryService.createDraft(
        withIntentMeta(plan.approvalTransactionInput, intentId, 0),
      );
      approvalDraftId = approvalDraft.id;

      const approvalStep = await executeRow({
        userId: intent.userId,
        transactionId: approvalDraft.id,
        execution: plan.approvalExecution,
        waitForReceipt: options?.waitForReceipt !== false,
        receiptTimeoutMs: options?.receiptTimeoutMs,
        receiptPollIntervalMs: options?.receiptPollIntervalMs,
        bundlerUrl: options?.bundlerUrl,
        paymasterUrl: options?.paymasterUrl,
      });

      approvalRow = approvalStep.row;

      if (approvalStep.status === "failed" || approvalStep.status === "cancelled") {
        return {
          intentId,
          approvalTransactionId: approvalDraftId,
          status: approvalStep.status,
          approval: approvalRow,
          error: approvalStep.error,
        };
      }

      if (approvalStep.status === "pending") {
        return {
          intentId,
          approvalTransactionId: approvalDraftId,
          status: "pending",
          approval: approvalRow,
        };
      }
    }

    const bridgeSequence = plan.approvalRequired ? 1 : 0;
    const bridgeDraft = await TransactionHistoryService.createDraft(
      withIntentMeta(plan.bridgeTransactionInput, intentId, bridgeSequence, approvalDraftId),
    );
    bridgeDraftId = bridgeDraft.id;

    const bridgeStep = await executeRow({
      userId: intent.userId,
      transactionId: bridgeDraft.id,
      execution: plan.bridgeExecution,
      waitForReceipt: options?.waitForReceipt !== false,
      receiptTimeoutMs: options?.receiptTimeoutMs,
      receiptPollIntervalMs: options?.receiptPollIntervalMs,
      bundlerUrl: options?.bundlerUrl,
      paymasterUrl: options?.paymasterUrl,
    });

    bridgeRow = bridgeStep.row;

    if (bridgeStep.status === "confirmed") {
      // Source-chain balance moved; refresh it. The destination-side balance
      // will update when the relayer fills the deposit.
      await BalanceService.refreshBalancesAfterTransaction({
        chainId: intent.sourceChainId,
        walletAddress: intent.walletAddress,
        tokens: [intent.inputToken],
      });
    }

    return {
      intentId,
      approvalTransactionId: approvalDraftId,
      bridgeTransactionId: bridgeDraftId,
      status: bridgeStep.status,
      approval: approvalRow,
      bridge: bridgeRow,
      error: bridgeStep.error,
    };
  }
}
