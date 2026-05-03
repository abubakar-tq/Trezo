import { SendPreparationService } from "@/src/features/send/services/SendPreparationService";
import { SendValidationService, type SendValidationOptions } from "@/src/features/send/services/SendValidationService";
import { SmartAccountExecutionService } from "@/src/features/wallet/services/SmartAccountExecutionService";
import { TransactionHistoryService } from "@/src/features/send/services/TransactionHistoryService";
import type { SendExecutionResult, SendIntent } from "@/src/features/send/types/send";

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

export type ExecuteSendOptions = {
  validation?: SendValidationOptions;
  waitForReceipt?: boolean;
  receiptTimeoutMs?: number;
  receiptPollIntervalMs?: number;
  bundlerUrl?: string;
  paymasterUrl?: string;
};

export class SendExecutionService {
  static async executeSend(intent: SendIntent, options?: ExecuteSendOptions): Promise<SendExecutionResult> {
    const draft = await TransactionHistoryService.createDraft(intent);

    let preparedUserOperation: Awaited<ReturnType<typeof SmartAccountExecutionService.prepareUserOperation>> | undefined;
    let signedUserOperation: Awaited<ReturnType<typeof SmartAccountExecutionService.signUserOperation>> | undefined;
    let userOpHash: `0x${string}` | undefined;
    let didSubmit = false;

    try {
      const validation = await SendValidationService.validate(intent, options?.validation);
      if (!validation.isValid) {
        const combinedError = validation.errors.map((item) => item.message).join(" ");
        await TransactionHistoryService.markFailed(draft.id, combinedError || "Send validation failed.");
        return {
          transactionId: draft.id,
          status: "failed",
          error: combinedError || "Send validation failed.",
        };
      }

      const preparedSend = SendPreparationService.prepare(intent, validation);
      await TransactionHistoryService.markPrepared(draft.id, preparedSend);

      preparedUserOperation = await SmartAccountExecutionService.prepareUserOperation(preparedSend.execution, {
        userId: intent.userId,
        usePaymaster: preparedSend.validation.feeMode === "sponsored",
        bundlerUrl: options?.bundlerUrl,
        paymasterUrl: options?.paymasterUrl,
      });

      await TransactionHistoryService.markSigning(draft.id);

      signedUserOperation = await SmartAccountExecutionService.signUserOperation(intent.userId, preparedUserOperation);
      await TransactionHistoryService.markSigned(draft.id, signedUserOperation);

      const submission = await SmartAccountExecutionService.submitUserOperation(signedUserOperation);
      didSubmit = true;
      userOpHash = submission.submittedUserOpHash;

      await TransactionHistoryService.markSubmitted(draft.id, submission.submittedUserOpHash);
      await TransactionHistoryService.markPending(draft.id);

      if (options?.waitForReceipt === false) {
        return {
          transactionId: draft.id,
          status: "pending",
          prepared: preparedSend,
          preparedUserOperation,
          signedUserOperation,
          userOpHash: submission.submittedUserOpHash,
        };
      }

      const receipt = await SmartAccountExecutionService.waitForReceipt(submission, {
        timeoutMs: options?.receiptTimeoutMs,
        pollIntervalMs: options?.receiptPollIntervalMs,
      });

      if (!receipt.success) {
        await TransactionHistoryService.markFailed(draft.id, "UserOperation receipt indicates failure");
        return {
          transactionId: draft.id,
          status: "failed",
          prepared: preparedSend,
          preparedUserOperation,
          signedUserOperation,
          userOpHash: submission.submittedUserOpHash,
          error: "UserOperation receipt indicates failure",
        };
      }

      await TransactionHistoryService.markConfirmed(draft.id, receipt);

      return {
        transactionId: draft.id,
        status: "confirmed",
        prepared: preparedSend,
        preparedUserOperation,
        signedUserOperation,
        userOpHash: submission.submittedUserOpHash,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      if (isUserCancellation(error) && !didSubmit) {
        await TransactionHistoryService.markCancelled(draft.id);
        return {
          transactionId: draft.id,
          status: "cancelled",
          preparedUserOperation,
          signedUserOperation,
          userOpHash,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      await TransactionHistoryService.markFailed(draft.id, error);
      return {
        transactionId: draft.id,
        status: "failed",
        preparedUserOperation,
        signedUserOperation,
        userOpHash,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
