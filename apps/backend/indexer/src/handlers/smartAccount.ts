import { ponder } from "ponder:registry";
import { accountSecurityEvent } from "ponder:schema";

ponder.on("SmartAccount:AccountInitialized", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  await context.db
    .insert(accountSecurityEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      walletAddress: event.log.address,
      eventType: "account_initialized",
      eventData: {
        entryPoint: event.args.entryPoint,
        passKeyId: event.args.passKeyId,
      },
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});

ponder.on("SmartAccount:ModuleInstalled", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  await context.db
    .insert(accountSecurityEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      walletAddress: event.log.address,
      eventType: "module_installed",
      eventData: {
        moduleTypeId: event.args.moduleTypeId.toString(),
        module: event.args.module,
      },
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});

ponder.on("SmartAccount:ModuleUninstalled", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  await context.db
    .insert(accountSecurityEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      walletAddress: event.log.address,
      eventType: "module_uninstalled",
      eventData: {
        moduleTypeId: event.args.moduleTypeId.toString(),
        module: event.args.module,
      },
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});

ponder.on("SmartAccount:RecoveryModuleUpdated", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  await context.db
    .insert(accountSecurityEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      walletAddress: event.log.address,
      eventType: "recovery_module_updated",
      eventData: {
        module: event.args.module,
        enabled: event.args.enabled,
      },
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});

ponder.on("SmartAccount:PasskeyAddedViaRecovery", async ({ event, context }) => {
  const chainId = BigInt(context.network.chainId);
  await context.db
    .insert(accountSecurityEvent)
    .values({
      chainId,
      txHash: event.transaction.hash,
      logIndex: event.log.logIndex,
      walletAddress: event.log.address,
      eventType: "passkey_added_via_recovery",
      eventData: {
        passkeyId: event.args.passkeyId,
      },
      blockNumber: event.block.number,
      blockTimestamp: event.block.timestamp,
      syncedToSupabase: false,
    })
    .onConflictDoNothing();
});
