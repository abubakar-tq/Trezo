/**
 * pendingTxs.ts — lightweight session-storage tracking for submitted UserOps.
 *
 * TxConfirmSheet writes a record after resolving the approval.
 * HomeScreen reads it to show an immediate "pending" entry in the Activity tab
 * before Supabase is indexed (which can take 30-60 s).
 *
 * Uses chrome.storage.session (in-memory, cleared on browser restart) so
 * stale pending entries never persist across sessions.
 */

const KEY = "trezo_pending_txs_v1";
const MAX_AGE_MS = 30 * 60_000; // 30 min — after that the tx is definitely settled

export interface PendingTx {
  id: string;        // local key, e.g. "pending-1748822400000"
  userOpHash: string;
  chainId: number;
  toAddress: string;
  valueHex?: string; // "0x0" for ERC-20 sends
  submittedAt: number; // ms epoch
}

export async function addPendingTx(tx: Omit<PendingTx, "id">): Promise<void> {
  const stored = await chrome.storage.session.get(KEY);
  const list: PendingTx[] = (stored[KEY] as PendingTx[]) ?? [];
  list.unshift({ ...tx, id: `pending-${tx.submittedAt}` });
  // Keep last 20, drop ancient entries
  const pruned = list.filter((t) => t.submittedAt > Date.now() - MAX_AGE_MS).slice(0, 20);
  await chrome.storage.session.set({ [KEY]: pruned });
}

export async function getPendingTxs(chainId: number): Promise<PendingTx[]> {
  const stored = await chrome.storage.session.get(KEY);
  const list: PendingTx[] = (stored[KEY] as PendingTx[]) ?? [];
  const cutoff = Date.now() - MAX_AGE_MS;
  return list.filter((tx) => tx.chainId === chainId && tx.submittedAt > cutoff);
}
