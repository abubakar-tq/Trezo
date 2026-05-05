import { BalanceService } from "@/src/features/assets/services/BalanceService";
import { SwapPreparationService } from "@/src/features/swaps/services/SwapPreparationService";
import type { SwapExecutionResult, SwapIntent } from "@/src/features/swaps/types/swap";
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
      : "Unknown swap execution failure";

  return {
    errorCode,
    errorMessage,
  };
};

const createIntentId = (): string => {
  // Must be a UUID to match the wallet_transactions.intent_id UUID column.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: generate a v4-like UUID manually
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

type ExecuteSwapOptions = {
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
    chainId: SwapIntent["chainId"];
    account: SwapIntent["walletAddress"];
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
      return {
        status: "pending",
        row: pendingRow,
      };
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

    return {
      status: "confirmed",
      row: confirmed,
    };
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

    return {
      status: "failed",
      row: failed,
      error: errorMessage,
    };
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

export class SwapExecutionService {
  static async executeSwap(
    intent: SwapIntent,
    options?: ExecuteSwapOptions,
  ): Promise<SwapExecutionResult> {
    const plan = await SwapPreparationService.prepareSwap(intent);
    const intentId = createIntentId();

    let approvalDraftId: string | undefined;
    let approvalRow: WalletTransaction | undefined;
    let swapDraftId: string | undefined;
    let swapRow: WalletTransaction | undefined;

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

    const swapSequence = plan.approvalRequired ? 1 : 0;
    const swapDraft = await TransactionHistoryService.createDraft(
      withIntentMeta(plan.swapTransactionInput, intentId, swapSequence, approvalDraftId),
    );
    swapDraftId = swapDraft.id;

    const swapStep = await executeRow({
      userId: intent.userId,
      transactionId: swapDraft.id,
      execution: plan.swapExecution,
      waitForReceipt: options?.waitForReceipt !== false,
      receiptTimeoutMs: options?.receiptTimeoutMs,
      receiptPollIntervalMs: options?.receiptPollIntervalMs,
      bundlerUrl: options?.bundlerUrl,
      paymasterUrl: options?.paymasterUrl,
    });

    swapRow = swapStep.row;

    if (swapStep.status === "confirmed") {
      await BalanceService.refreshBalancesAfterTransaction({
        chainId: intent.chainId,
        walletAddress: intent.walletAddress,
        tokens: [intent.sellToken, intent.buyToken],
      });
    }

    return {
      intentId,
      approvalTransactionId: approvalDraftId,
      swapTransactionId: swapDraftId,
      status: swapStep.status,
      approval: approvalRow,
      swap: swapRow,
      error: swapStep.error,
    };
  }
}
