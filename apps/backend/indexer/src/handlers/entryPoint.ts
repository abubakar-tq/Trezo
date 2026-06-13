import { ponder } from "ponder:registry";
import { userOpEvent } from "ponder:schema";
import { isKnownAccount } from "../lib/knownAccounts.js";
import { projectUserOpConfirmation } from "../lib/projectUserOpConfirmation.js";

ponder.on("EntryPoint:UserOperationEvent", async ({ event, context }) => {
  const { userOpHash, sender, paymaster, nonce, success, actualGasCost, actualGasUsed } = event.args;
  const chainId = BigInt(context.chain!.id);

  if (!isKnownAccount(chainId, sender)) return;

  await context.db
    .insert(userOpEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      userOpHash,
      sender,
      paymaster,
      nonce,
      success,
      actualGasCost,
      actualGasUsed,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
  await projectUserOpConfirmation({
    userOpHash,
    success,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});
