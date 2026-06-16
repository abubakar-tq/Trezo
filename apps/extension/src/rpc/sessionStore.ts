export type DAppSession = { origin: string; address: `0x${string}`; chainId: number; approvedAt: number };

const KEY = "trezo_sessions_v1";

async function readAll(): Promise<Record<string, DAppSession>> {
  const out = await chrome.storage.local.get(KEY);
  return (out[KEY] as Record<string, DAppSession>) ?? {};
}
async function writeAll(sessions: Record<string, DAppSession>): Promise<void> {
  await chrome.storage.local.set({ [KEY]: sessions });
}

export const sessionStore = {
  async get(origin: string): Promise<DAppSession | null> {
    const session = (await readAll())[origin] ?? null;
    if (!session) return null;
    // Expire sessions older than 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - session.approvedAt > THIRTY_DAYS_MS) {
      await this.remove(origin);
      return null;
    }
    return session;
  },
  async set(session: DAppSession): Promise<void> {
    const all = await readAll();
    all[session.origin] = session;
    await writeAll(all);
  },
  async remove(origin: string): Promise<void> {
    const all = await readAll();
    delete all[origin];
    await writeAll(all);
  },
  async getAll(): Promise<Record<string, DAppSession>> {
    return readAll();
  },
  async clear(): Promise<void> {
    await writeAll({});
  },
};
