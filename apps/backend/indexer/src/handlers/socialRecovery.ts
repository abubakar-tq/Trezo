import { ponder } from "ponder:registry";
import { accountSecurityEvent } from "ponder:schema";
import { projectSecurityEvent } from "../lib/projectSecurityEvent.js";

function baseRow(
  chainId: bigint,
  event: { transaction: { hash: `0x${string}` }; log: { logIndex: number }; block: { number: bigint; timestamp: bigint } },
  walletAddress: `0x${string}`,
  eventType: string,
  eventData: Record<string, unknown>
) {
  return {
    chainId,
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    walletAddress,
    eventType,
    eventData,
    blockNumber: event.block.number,
    blockTimestamp: event.block.timestamp,
    syncedToSupabase: false,
  };
}

ponder.on("SocialRecovery:RecoveryScheduled", async ({ event, context }) => {
  const chainId = BigInt(context.chain!.id);
  await context.db
    .insert(accountSecurityEvent)
    .values(baseRow(chainId, event, event.args.wallet, "recovery_scheduled", {
      recoveryId: event.args.recoveryId,
      executeAfter: event.args.executeAfter.toString(),
    }))
    .onConflictDoNothing();
  await projectSecurityEvent({
    chainId: context.chain!.id,
    walletAddress: event.args.wallet,
    eventType: "recovery_scheduled",
    eventData: { recoveryId: event.args.recoveryId, executeAfter: event.args.executeAfter.toString() },
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});

ponder.on("SocialRecovery:RecoveryExecuted", async ({ event, context }) => {
  const chainId = BigInt(context.chain!.id);
  await context.db
    .insert(accountSecurityEvent)
    .values(baseRow(chainId, event, event.args.wallet, "recovery_executed", {
      recoveryId: event.args.recoveryId,
    }))
    .onConflictDoNothing();
  await projectSecurityEvent({
    chainId: context.chain!.id,
    walletAddress: event.args.wallet,
    eventType: "recovery_executed",
    eventData: { recoveryId: event.args.recoveryId },
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});

ponder.on("SocialRecovery:RecoveryCancelled", async ({ event, context }) => {
  const chainId = BigInt(context.chain!.id);
  await context.db
    .insert(accountSecurityEvent)
    .values(baseRow(chainId, event, event.args.wallet, "recovery_cancelled", {
      recoveryId: event.args.recoveryId,
    }))
    .onConflictDoNothing();
  await projectSecurityEvent({
    chainId: context.chain!.id,
    walletAddress: event.args.wallet,
    eventType: "recovery_cancelled",
    eventData: { recoveryId: event.args.recoveryId },
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});

ponder.on("SocialRecovery:GuardiansUpdated", async ({ event, context }) => {
  const chainId = BigInt(context.chain!.id);
  await context.db
    .insert(accountSecurityEvent)
    .values(baseRow(chainId, event, event.args.wallet, "guardians_updated", {
      threshold: event.args.threshold.toString(),
    }))
    .onConflictDoNothing();
  await projectSecurityEvent({
    chainId: context.chain!.id,
    walletAddress: event.args.wallet,
    eventType: "guardians_updated",
    eventData: { threshold: event.args.threshold.toString() },
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});

ponder.on("SocialRecovery:HashedApproval", async ({ event, context }) => {
  const chainId = BigInt(context.chain!.id);
  // HashedApproval has no wallet address — set walletAddress = guardian.
  // Sync worker resolves actual wallet via Supabase recovery_requests table.
  await context.db
    .insert(accountSecurityEvent)
    .values(baseRow(chainId, event, event.args.guardian, "guardian_approved", {
      hash: event.args.hash,
    }))
    .onConflictDoNothing();
  await projectSecurityEvent({
    chainId: context.chain!.id,
    walletAddress: event.args.guardian,
    eventType: "guardian_approved",
    eventData: { hash: event.args.hash },
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});

ponder.on("SocialRecovery:RejectHash", async ({ event, context }) => {
  const chainId = BigInt(context.chain!.id);
  // RejectHash also has no wallet address — same guardian-as-wallet sentinel.
  await context.db
    .insert(accountSecurityEvent)
    .values(baseRow(chainId, event, event.args.guardian, "guardian_rejected", {
      hash: event.args.hash,
    }))
    .onConflictDoNothing();
  await projectSecurityEvent({
    chainId: context.chain!.id,
    walletAddress: event.args.guardian,
    eventType: "guardian_rejected",
    eventData: { hash: event.args.hash },
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});
