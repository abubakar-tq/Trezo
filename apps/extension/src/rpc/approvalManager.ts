// Background-side approval broker.
// Enqueues approval requests in chrome.storage.session (in-memory, never persisted to disk),
// opens a DEDICATED approval WINDOW (not the action popup), and awaits the result sent back
// by the popup via approvalBridge.ts.
//
// Why a dedicated window and not chrome.action.openPopup(): the action popup is destroyed the
// instant it loses focus. The WebAuthn / passkey OS dialog steals focus, which would kill the
// popup mid-ceremony (and can crash Chrome). A chrome.windows.create popup window survives focus
// loss, so the passkey ceremony can complete — same pattern wallets like MetaMask use.

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void };
const pending = new Map<string, Pending>();

export type ApprovalRequest =
  | { kind: "connect"; id: string; origin: string; chainId: number }
  | { kind: "sign"; id: string; origin: string; chainId: number; message: string }
  | { kind: "signTyped"; id: string; origin: string; chainId: number; typedData: unknown }
  | { kind: "tx"; id: string; origin: string; chainId: number; tx: { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` } };

const QUEUE_KEY = "trezo_approval_queue_v1";

// The single approval window reused across queued approvals.
// Persisted to chrome.storage.session so SW restarts don't open duplicate windows.
let approvalWindowId: number | null = null;
void chrome.storage.session.get("trezo_appr_win").then((s) => {
  const id = s["trezo_appr_win"] as number | undefined;
  if (id != null) approvalWindowId = id;
});

async function getQueue(): Promise<ApprovalRequest[]> {
  const stored = await chrome.storage.session.get(QUEUE_KEY);
  return (stored[QUEUE_KEY] as ApprovalRequest[]) ?? [];
}

async function setQueue(queue: ApprovalRequest[]): Promise<void> {
  await chrome.storage.session.set({ [QUEUE_KEY]: queue });
}

async function ensureApprovalWindow(): Promise<void> {
  // Reuse the existing window if it's still open — just focus it; the popup App
  // polls the queue and renders the next approval.
  if (approvalWindowId !== null) {
    try {
      await chrome.windows.update(approvalWindowId, { focused: true });
      return;
    } catch {
      approvalWindowId = null;
      void chrome.storage.session.remove("trezo_appr_win");
    }
  }
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL("index.html") + "?ctx=window",
    type: "popup",
    width: 420,
    height: 640,
    focused: true,
  });
  approvalWindowId = win?.id ?? null;
  void chrome.storage.session.set({ trezo_appr_win: approvalWindowId });
}

export async function requestApproval(req: ApprovalRequest): Promise<unknown> {
  const queue = await getQueue();
  queue.push(req);
  await setQueue(queue);

  await ensureApprovalWindow();

  return new Promise<unknown>((resolve, reject) => {
    pending.set(req.id, { resolve, reject });
  });
}

// Register the result listener once (side-effect on import).
// The approval window is NOT closed here — each sheet closes the window itself
// after showing the result to the user.
chrome.runtime.onMessage.addListener(
  (msg: { type?: string; id?: string; result?: unknown; error?: string }, sender) => {
    if (msg?.type !== "trezo-approval-result" || !msg.id) return;
    // Reject approval results from content scripts (tab senders); only extension pages may resolve
    if (sender.tab) return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error));
    else p.resolve(msg.result);
  },
);

// If the user manually closes the approval window, reject every pending approval
// so the dApp's request settles instead of hanging forever.
chrome.windows.onRemoved.addListener((closedId) => {
  if (closedId !== approvalWindowId) return;
  approvalWindowId = null;
  void chrome.storage.session.remove("trezo_appr_win");
  for (const [, p] of pending) p.reject(new Error("User closed the Trezo approval window"));
  pending.clear();
  void setQueue([]);
});
