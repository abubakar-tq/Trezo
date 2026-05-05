import { onchainTable, primaryKey, index } from "ponder";

export const smartAccount = onchainTable(
  "smart_account",
  (t) => ({
    chainId: t.bigint().notNull(),
    accountAddress: t.hex().notNull(),
    walletId: t.hex().notNull(),
    walletIndex: t.bigint().notNull(),
    mode: t.hex().notNull(),
    salt: t.hex().notNull(),
    deployedAtBlock: t.bigint().notNull(),
    deployedTxHash: t.hex().notNull(),
    syncedToSupabase: t.boolean().notNull().default(false),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.accountAddress] }),
    syncIdx: index().on(table.syncedToSupabase),
  })
);

export const incomingErc20Transfer = onchainTable(
  "incoming_erc20_transfer",
  (t) => ({
    chainId: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    fromAddress: t.hex().notNull(),
    toAddress: t.hex().notNull(),
    tokenAddress: t.hex().notNull(),
    value: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    syncedToSupabase: t.boolean().notNull().default(false),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.txHash, table.logIndex] }),
    toIdx: index().on(table.toAddress),
    syncIdx: index().on(table.syncedToSupabase),
  })
);

export const incomingNativeTransfer = onchainTable(
  "incoming_native_transfer",
  (t) => ({
    chainId: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    fromAddress: t.hex().notNull(),
    toAddress: t.hex().notNull(),
    value: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    syncedToSupabase: t.boolean().notNull().default(false),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.txHash] }),
    toIdx: index().on(table.toAddress),
    syncIdx: index().on(table.syncedToSupabase),
  })
);

export const accountSecurityEvent = onchainTable(
  "account_security_event",
  (t) => ({
    chainId: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    walletAddress: t.hex().notNull(),
    eventType: t.text().notNull(),
    eventData: t.json(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    syncedToSupabase: t.boolean().notNull().default(false),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.txHash, table.logIndex] }),
    walletIdx: index().on(table.walletAddress),
    syncIdx: index().on(table.syncedToSupabase),
  })
);

export const userOpEvent = onchainTable(
  "user_op_event",
  (t) => ({
    chainId: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    logIndex: t.integer().notNull(),
    userOpHash: t.hex().notNull(),
    sender: t.hex().notNull(),
    paymaster: t.hex().notNull(),
    nonce: t.bigint().notNull(),
    success: t.boolean().notNull(),
    actualGasCost: t.bigint().notNull(),
    actualGasUsed: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    blockTimestamp: t.bigint().notNull(),
    syncedToSupabase: t.boolean().notNull().default(false),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.chainId, table.txHash, table.logIndex] }),
    senderIdx: index().on(table.sender),
    userOpHashIdx: index().on(table.userOpHash),
    syncIdx: index().on(table.syncedToSupabase),
  })
);

export const indexerHealth = onchainTable(
  "indexer_health",
  (t) => ({
    chainId: t.bigint().primaryKey(),
    lastProcessedBlock: t.bigint().notNull(),
    lastProcessedTimestamp: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  })
);
