import { ponder } from "ponder:registry";
import { projectIncomingTransfer } from "../lib/projectTransfer.js";

// Native ETH received by a smart account = a transaction sent TO the account that carries value.
// Uses `transaction:to` (standard block/tx data — no trace API needed, works on Infura free).
// `transfer:to` would also catch internal/contract-forwarded ETH but requires trace support.
ponder.on("KnownAccounts:transaction:to", async ({ event, context }) => {
  const value = event.transaction.value;
  if (value <= 0n) return; // ignore zero-value calls (contract interactions, UserOps, etc.)

  const to = event.transaction.to;
  if (!to) return; // contract-creation has null `to`; not a receive

  // context.chain is typed as `never` for accounts-sourced events in Ponder 0.11.44
  // (the types only model chain for contracts/blocks sources). At runtime it is always
  // injected — cast to the known runtime shape.
  const chainId = (context as unknown as { chain: { id: number } }).chain.id;

  await projectIncomingTransfer({
    chainId,
    txHash: event.transaction.hash,
    logIndex: -1, // native transfers have no log index
    from: event.transaction.from,
    to,
    tokenType: "native",
    tokenAddress: null,
    tokenSymbol: "ETH",
    tokenDecimals: 18,
    valueRaw: value,
    blockNumber: event.block.number,
    blockTimestampSec: event.block.timestamp,
  });
});
