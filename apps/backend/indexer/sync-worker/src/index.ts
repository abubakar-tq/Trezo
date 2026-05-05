import { pollIncomingErc20 } from "./pollers/incomingErc20.js";
import { pollAccountSecurityEvents } from "./pollers/accountSecurityEvents.js";
import { pollUserOpConfirmations } from "./pollers/userOpConfirmations.js";
import { auditSmartAccountRegistry } from "./pollers/smartAccountRegistry.js";
import { POLL_INTERVAL_MS } from "./config.js";
import { logger } from "./lib/logger.js";

let auditTick = 0;

async function tick(): Promise<void> {
  await Promise.allSettled([
    pollIncomingErc20(),
    pollAccountSecurityEvents(),
    pollUserOpConfirmations(),
  ]);

  // Audit runs every 30 ticks (~60s at 2s interval) to avoid excessive Supabase reads
  if (++auditTick % 30 === 0) {
    await auditSmartAccountRegistry().catch((err) =>
      logger.error({ err }, "audit failed")
    );
  }
}

async function main(): Promise<void> {
  logger.info({ pollIntervalMs: POLL_INTERVAL_MS }, "sync worker starting");

  while (true) {
    try {
      await tick();
    } catch (err) {
      logger.error({ err }, "tick error");
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  logger.fatal({ err }, "sync worker crashed");
  process.exit(1);
});
