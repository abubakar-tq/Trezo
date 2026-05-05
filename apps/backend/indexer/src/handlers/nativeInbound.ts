// Phase 9 — Native ETH inbound tracking via block scanner.
// Implemented in Phase 9; this file is intentionally empty until then.
// When ready: add a HealthBeat:block handler that iterates block.transactions,
// filters tx.to ∈ knownAccounts && tx.value > 0n && tx.input === '0x',
// and inserts into incomingNativeTransfer with onConflictDoNothing.
