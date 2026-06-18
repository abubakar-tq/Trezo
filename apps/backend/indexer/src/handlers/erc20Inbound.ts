import { ponder } from "ponder:registry";
import { incomingErc20Transfer } from "ponder:schema";
import { isKnownAccount } from "../lib/knownAccounts.js";
import { resolveTokenMeta } from "../lib/tokenMeta.js";
import { projectIncomingTransfer } from "../lib/projectTransfer.js";

ponder.on("Erc20Inbound:Transfer", async ({ event, context }) => {
  const { from, to, value } = event.args;
  const chainId = BigInt(context.chain!.id);

  // Insert into Ponder's local table only for wallets in the fast in-memory registry.
  // Pre-existing wallets (deployed before startBlock) won't be here yet until the
  // setup hook seeds the registry — but we still project to Supabase below for them.
  if (isKnownAccount(chainId, to)) {
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
        syncedToSupabase: true,
      })
      .onConflictDoNothing();
  }

  // Always try to project to Supabase — resolveReceivingWallet handles unknown addresses
  // gracefully (returns null), so this is safe even for non-Trezo recipient addresses.
  const meta = await resolveTokenMeta(Number(chainId), event.log.address, context.client);
  await projectIncomingTransfer({
    chainId: Number(chainId),
    txHash: event.transaction.hash,
    logIndex: event.log.logIndex,
    from,
    to,
    tokenType: "erc20",
    tokenAddress: event.log.address,
    tokenSymbol: meta.symbol,
    tokenDecimals: meta.decimals,
    valueRaw: value,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});
