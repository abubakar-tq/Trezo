import { ponder } from "ponder:registry";
import { smartAccount } from "ponder:schema";
import { rememberAccount } from "../lib/knownAccounts.js";

ponder.on("AccountFactory:AccountCreated", async ({ event, context }) => {
  const { account, walletId, walletIndex, mode, salt } = event.args;
  const chainId = BigInt(context.network.chainId);

  rememberAccount(chainId, account);

  await context.db
    .insert(smartAccount)
    .values({
      chainId,
      accountAddress: account,
      walletId,
      walletIndex,
      mode,
      salt,
      deployedAtBlock: event.block.number,
      deployedTxHash: event.transaction.hash,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});
