// In-memory per-chain registry of smart account addresses.
// Rebuilt chronologically on cold start by Ponder's replay before child
// contract events fire. Not safe across sharded Ponder processes — swap
// for context.db.find(smartAccount, ...) if sharding is ever needed.

const registry = new Map<bigint, Set<string>>();

export function rememberAccount(chainId: bigint, address: string): void {
  const key = chainId;
  if (!registry.has(key)) registry.set(key, new Set());
  registry.get(key)!.add(address.toLowerCase());
}

export function isKnownAccount(chainId: bigint, address: string): boolean {
  return registry.get(chainId)?.has(address.toLowerCase()) ?? false;
}
