import { getUserOperationReceipt } from "@/src/integration/viem/userOps";
import { TransactionHistoryService } from "@/src/features/send/services/TransactionHistoryService";
import type { TransactionRecord } from "@/src/features/send/types/send";
import type { SupportedChainId } from "@/src/integration/chains";
import { getBundlerUrl } from "@/src/core/network/chain";
import type { Hex } from "viem";
import type { UserOperationReceipt } from "viem/account-abstraction";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isReceiptSuccess = (receipt: UserOperationReceipt<"0.7">): boolean => {
  const directSuccess = (receipt as { success?: boolean }).success;
  if (typeof directSuccess === "boolean") {
    return directSuccess;
  }

  const status = (receipt.receipt as { status?: unknown }).status;
  if (typeof status === "string") {
    return status.toLowerCase() === "success";
  }
  if (typeof status === "bigint") {
    return status === 1n;
  }
  if (typeof status === "number") {
    return status === 1;
  }

  return false;
};

const isTerminalBundlerFailure = (errorValue: unknown): boolean => {
  const message = errorValue instanceof Error
    ? errorValue.message
    : typeof errorValue === "string"
      ? errorValue
      : "";

  const lowered = message.toLowerCase();
  return (
    lowered.includes("rejected")
    || lowered.includes("failed")
    || lowered.includes("invalid")
  );
};

export type ReceiptTrackerOptions = {
  timeoutMs?: number;
  pollIntervalMs?: number;
};

export class TransactionReceiptTracker {
  static async trackById(
    record: TransactionRecord,
    options?: ReceiptTrackerOptions,
  ): Promise<"confirmed" | "failed" | "pending"> {
    if (!record.userOpHash || !record.chainId) {
      return "pending";
    }

    const timeoutMs = options?.timeoutMs ?? 60_000;
    const pollIntervalMs = options?.pollIntervalMs ?? 2_000;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      try {
        const receipt = await getUserOperationReceipt(
          record.userOpHash,
          record.chainId as SupportedChainId,
          record.bundlerUrl ?? getBundlerUrl(record.chainId as SupportedChainId),
        );

        if (receipt) {
          const success = isReceiptSuccess(receipt);
          if (success) {
            await TransactionHistoryService.markConfirmed(record.id, {
              submittedUserOpHash: record.userOpHash as Hex,
              receipt,
              transactionHash: receipt.receipt.transactionHash as Hex | undefined,
              blockNumber: receipt.receipt.blockNumber,
              success: true,
            });
            return "confirmed";
          }

          await TransactionHistoryService.markFailed(record.id, "UserOperation receipt indicates failure");
          return "failed";
        }
      } catch (error) {
        if (isTerminalBundlerFailure(error)) {
          await TransactionHistoryService.markFailed(record.id, error);
          return "failed";
        }
      }

      await sleep(pollIntervalMs);
    }

    return "pending";
  }

  static async resumePendingForWallet(
    userId: string,
    walletAddress: string,
    chainId?: number,
    options?: ReceiptTrackerOptions,
  ): Promise<{ confirmed: number; failed: number; pending: number }> {
    const rows = await TransactionHistoryService.listTrackablePending(userId, walletAddress, chainId);

    let confirmed = 0;
    let failed = 0;
    let pending = 0;

    for (const row of rows) {
      const result = await this.trackById(row, options);
      if (result === "confirmed") confirmed += 1;
      if (result === "failed") failed += 1;
      if (result === "pending") pending += 1;
    }

    return { confirmed, failed, pending };
  }
}
