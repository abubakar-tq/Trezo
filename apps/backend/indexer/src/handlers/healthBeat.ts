import { ponder } from "ponder:registry";
import { indexerHealth } from "ponder:schema";

ponder.on("HealthBeat:block", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  const now = event.block.timestamp;

  await context.db
    .insert(indexerHealth)
    .values({
      chainId,
      lastProcessedBlock: event.block.number,
      lastProcessedTimestamp: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      lastProcessedBlock: event.block.number,
      lastProcessedTimestamp: now,
      updatedAt: now,
    });
});
