import { ponder } from "ponder:registry";
import { incomingErc20Transfer } from "ponder:schema";
import { isKnownAccount } from "../lib/knownAccounts.js";

ponder.on("Erc20Inbound:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  const chainId = BigInt(context.network.chainId);

  if (!isKnownAccount(chainId, to)) return;

  await context.db
    .insert(incomingErc20Transfer)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      fromAddress: from,
      toAddress: to,
      tokenAddress: event.log.address,
      value,
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});
