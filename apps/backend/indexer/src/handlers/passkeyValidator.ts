import { ponder } from "ponder:registry";
import { accountSecurityEvent } from "ponder:schema";

ponder.on("PasskeyValidator:PasskeyAdded", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  await context.db
    .insert(accountSecurityEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      walletAddress: event.args.account,
      eventType: "passkey_added",
      eventData: { passkeyId: event.args.passkeyId },
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});

ponder.on("PasskeyValidator:PasskeyRemoved", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  await context.db
    .insert(accountSecurityEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      walletAddress: event.args.account,
      eventType: "passkey_removed",
      eventData: { passkeyId: event.args.passkeyId },
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});

ponder.on("PasskeyValidator:PasskeyRemovalScheduled", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  await context.db
    .insert(accountSecurityEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      walletAddress: event.args.account,
      eventType: "passkey_removal_scheduled",
      eventData: {
        passkeyId: event.args.passkeyId,
        executeAfter: event.args.executeAfter.toString(),
      },
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});

ponder.on("PasskeyValidator:PasskeyRemovalCancelled", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  await context.db
    .insert(accountSecurityEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      walletAddress: event.args.account,
      eventType: "passkey_removal_cancelled",
      eventData: { passkeyId: event.args.passkeyId },
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});
