// Popup-side approval bridge.
// Reads the in-memory session queue written by approvalManager.ts and
// sends results back to the background service worker.

import type { ApprovalRequest } from "../../rpc/approvalManager";

const QUEUE_KEY = "trezo_approval_queue_v1";

export async function nextApproval(): Promise<ApprovalRequest | null> {
  const stored = await chrome.storage.session.get(QUEUE_KEY);
  const queue = (stored[QUEUE_KEY] as ApprovalRequest[]) ?? [];
  return queue[0] ?? null;
}

export async function resolveApproval(id: string, result: unknown): Promise<void> {
  await dequeue(id);
  chrome.runtime.sendMessage({ type: "trezo-approval-result", id, result }, () => {
    if (chrome.runtime.lastError) console.warn("[trezo] approval bridge SW gone:", chrome.runtime.lastError.message);
  });
}

export async function rejectApproval(id: string, error: string): Promise<void> {
  await dequeue(id);
  chrome.runtime.sendMessage({ type: "trezo-approval-result", id, error }, () => {
    if (chrome.runtime.lastError) console.warn("[trezo] approval bridge SW gone:", chrome.runtime.lastError.message);
  });
}

async function dequeue(id: string): Promise<void> {
  const stored = await chrome.storage.session.get(QUEUE_KEY);
  const queue = (stored[QUEUE_KEY] as Array<{ id: string }>) ?? [];
  await chrome.storage.session.set({ [QUEUE_KEY]: queue.filter((r) => r.id !== id) });
}
