import { SendPreparationService } from "@/src/features/send/services/SendPreparationService";
import { SendValidationService, type SendValidationOptions } from "@/src/features/send/services/SendValidationService";
import type { SendIntent, SendExecutionResult } from "@/src/features/send/types/send";
import {
  TransactionHistoryService,
  type CreateWalletTransactionInput,
} from "@/src/features/transactions";
import { SmartAccountExecutionService } from "@/src/features/wallet/services/SmartAccountExecutionService";
import { formatUnits } from "viem";

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
      : "Unknown send execution failure";

  return {
    errorCode,
    errorMessage,
  };
};

const composeSendTransactionDraft = (intent: SendIntent): CreateWalletTransactionInput => ({
  userId: intent.userId,
  aaWalletId: intent.aaWalletId,
  walletAddress: intent.walletAddress,
  chainId: intent.chainId,
  type: intent.token.type === "native" ? "send_native" : "send_erc20",
  direction: "outgoing",
  tokenType: intent.token.type,
  tokenAddress: intent.token.type === "erc20" ? intent.token.address : null,
  tokenSymbol: intent.token.symbol,
  tokenDecimals: intent.token.decimals,
  fromAddress: intent.walletAddress,
  toAddress: intent.recipient as `0x${string}`,
  amountDisplay: intent.amountDecimal,
  targetAddress: intent.recipient as `0x${string}`,
  valueRaw: "0",
  calldata: "0x",
  metadata: intent.memo ? { memo: intent.memo } : {},
});

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
    const draft = await TransactionHistoryService.createDraft(composeSendTransactionDraft(intent));

    let preparedUserOperation: Awaited<ReturnType<typeof SmartAccountExecutionService.prepareUserOperation>> | undefined;
    let signedUserOperation: Awaited<ReturnType<typeof SmartAccountExecutionService.signUserOperation>> | undefined;
    let userOpHash: `0x${string}` | undefined;
    let didSubmit = false;

    try {
      const validation = await SendValidationService.validate(intent, options?.validation);
      if (!validation.isValid) {
        const combinedError = validation.errors.map((item) => item.message).join(" ");
        await TransactionHistoryService.markFailed({
          id: draft.id,
          errorCode: "validation_failed",
          errorMessage: combinedError || "Send validation failed.",
        });
        return {
          transactionId: draft.id,
          status: "failed",
          error: combinedError || "Send validation failed.",
        };
      }

      const preparedSend = SendPreparationService.prepare(intent, validation);
      await TransactionHistoryService.markPrepared(draft.id, {
        type: preparedSend.intent.token.type === "native" ? "send_native" : "send_erc20",
        tokenType: preparedSend.intent.token.type,
        tokenAddress: preparedSend.intent.token.type === "erc20"
          ? preparedSend.intent.token.address
          : null,
        tokenSymbol: preparedSend.intent.token.symbol,
        tokenDecimals: preparedSend.intent.token.decimals,
        toAddress: preparedSend.validation.recipient,
        amountRaw: preparedSend.validation.amountRaw.toString(),
        amountDisplay: formatUnits(preparedSend.validation.amountRaw, preparedSend.intent.token.decimals),
        targetAddress: preparedSend.targetAddress,
        valueRaw: preparedSend.valueRaw.toString(),
        calldata: preparedSend.calldata,
        paymasterUsed: preparedSend.validation.feeMode === "sponsored",
        feeMode: preparedSend.validation.feeMode === "sponsored" ? "sponsored" : "wallet_native",
        metadata: preparedSend.intent.memo ? { memo: preparedSend.intent.memo } : {},
      });

      preparedUserOperation = await SmartAccountExecutionService.prepareUserOperation(preparedSend.execution, {
        userId: intent.userId,
        usePaymaster: preparedSend.validation.feeMode === "sponsored",
        bundlerUrl: options?.bundlerUrl,
        paymasterUrl: options?.paymasterUrl,
      });

      await TransactionHistoryService.markSigning(draft.id);

      signedUserOperation = await SmartAccountExecutionService.signUserOperation(intent.userId, preparedUserOperation);
      await TransactionHistoryService.markSigned(draft.id, {
        signatureBytes: signedUserOperation.signature.length > 2
          ? (signedUserOperation.signature.length - 2) / 2
          : 0,
        userOpHash: signedUserOperation.userOpHash,
      });

      const submission = await SmartAccountExecutionService.submitUserOperation(signedUserOperation);
      didSubmit = true;
      userOpHash = submission.submittedUserOpHash;

      await TransactionHistoryService.markSubmitted({
        id: draft.id,
        userOpHash: submission.submittedUserOpHash,
      });
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
        await TransactionHistoryService.markFailed({
          id: draft.id,
          errorMessage: "UserOperation receipt indicates failure",
          debugContext: {
            submittedUserOpHash: receipt.submittedUserOpHash,
          },
        });
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

      await TransactionHistoryService.markConfirmed({
        id: draft.id,
        transactionHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        debugContext: {
          submittedUserOpHash: receipt.submittedUserOpHash,
          receiptSuccess: true,
        },
      });

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
        await TransactionHistoryService.markCancelled(draft.id, "passkey_prompt_cancelled");
        return {
          transactionId: draft.id,
          status: "cancelled",
          preparedUserOperation,
          signedUserOperation,
          userOpHash,
          error: error instanceof Error ? error.message : String(error),
        };
      }

      const { errorCode, errorMessage } = getErrorDetails(error);
      await TransactionHistoryService.markFailed({
        id: draft.id,
        errorCode,
        errorMessage,
      });
      return {
        transactionId: draft.id,
        status: "failed",
        preparedUserOperation,
        signedUserOperation,
        userOpHash,
        error: errorMessage,
      };
    }
  }
}
