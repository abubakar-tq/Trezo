import { getBundlerUrl } from "@/src/core/network/chain";
import { TransactionHistoryService } from "@/src/features/transactions/services/TransactionHistoryService";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import type { SupportedChainId } from "@/src/integration/chains";
import { getUserOperationReceipt } from "@/src/integration/viem/userOps";
import type { Address, Hex } from "viem";
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
    || lowered.includes("revert")
  );
};

const loadRequiredTrackFields = (row: WalletTransaction): {
  userOpHash: Hex;
  chainId: SupportedChainId;
  bundlerUrl: string;
} | null => {
  if (!row.userOpHash || !row.chainId) return null;

  let bundlerUrl = row.bundlerUrl;
  if (!bundlerUrl) {
    try {
      bundlerUrl = getBundlerUrl(row.chainId as SupportedChainId);
    } catch {
      return null;
    }
  }

  return {
    userOpHash: row.userOpHash,
    chainId: row.chainId as SupportedChainId,
    bundlerUrl,
  };
};

export class TransactionReceiptTracker {
  static async trackUserOperation(params: {
    transactionId: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
  }): Promise<WalletTransaction> {
    const timeoutMs = params.timeoutMs ?? 60_000;
    const pollIntervalMs = params.pollIntervalMs ?? 2_000;

    const initial = await TransactionHistoryService.getById(params.transactionId);
    if (!initial) {
      throw new Error(`Transaction ${params.transactionId} not found`);
    }

    let row = initial;
    if (row.status === "submitted") {
      row = await TransactionHistoryService.markPending(row.id);
    }

    if (row.status !== "pending") {
      return row;
    }

    const trackContext = loadRequiredTrackFields(row);
    if (!trackContext) {
      return row;
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      try {
        const receipt = await getUserOperationReceipt(
          trackContext.userOpHash,
          trackContext.chainId,
          trackContext.bundlerUrl,
        );

        if (!receipt) {
          await sleep(pollIntervalMs);
          continue;
        }

        const success = isReceiptSuccess(receipt);
        if (success) {
          return TransactionHistoryService.markConfirmed({
            id: row.id,
            transactionHash: receipt.receipt.transactionHash as Hex | undefined,
            blockNumber: receipt.receipt.blockNumber,
            debugContext: {
              receiptObservedAt: new Date().toISOString(),
              receiptSuccess: true,
            },
          });
        }

        return TransactionHistoryService.markFailed({
          id: row.id,
          errorMessage: "UserOperation receipt indicates failure",
          debugContext: {
            receiptObservedAt: new Date().toISOString(),
            receiptSuccess: false,
          },
        });
      } catch (error) {
        if (isTerminalBundlerFailure(error)) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return TransactionHistoryService.markFailed({
            id: row.id,
            errorMessage,
            debugContext: {
              trackerFailure: "terminal_bundler_failure",
            },
          });
        }
      }

      await sleep(pollIntervalMs);
    }

    const latest = await TransactionHistoryService.getById(row.id);
    if (!latest) {
      throw new Error(`Transaction ${row.id} disappeared while tracking`);
    }
    return latest;
  }

  static async refreshTransactionStatus(params: {
    transactionId: string;
  }): Promise<WalletTransaction> {
    return this.trackUserOperation({
      transactionId: params.transactionId,
      timeoutMs: 2_000,
      pollIntervalMs: 500,
    });
  }

  static async reconcilePendingForWallet(params: {
    userId?: string;
    walletAddress: Address;
    chainId?: number;
    timeoutMs?: number;
    pollIntervalMs?: number;
  }): Promise<{ confirmed: number; failed: number; pending: number; dropped: number }> {
    const rows = await TransactionHistoryService.listPendingForWallet({
      userId: params.userId,
      walletAddress: params.walletAddress,
      chainId: params.chainId,
    });

    let confirmed = 0;
    let failed = 0;
    let pending = 0;
    let dropped = 0;

    for (const row of rows) {
      const next = await this.trackUserOperation({
        transactionId: row.id,
        timeoutMs: params.timeoutMs,
        pollIntervalMs: params.pollIntervalMs,
      });

      if (next.status === "confirmed") confirmed += 1;
      else if (next.status === "failed") failed += 1;
      else if (next.status === "dropped") dropped += 1;
      else pending += 1;
    }

    return {
      confirmed,
      failed,
      pending,
      dropped,
    };
  }
}
