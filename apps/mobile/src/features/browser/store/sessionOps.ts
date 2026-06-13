import type { DAppSession } from "./useDAppSessionsStore";

export type NewSessionInput = Omit<DAppSession, "id" | "approvedAt" | "lastUsedAt">;

export function upsertSession(
  sessions: DAppSession[],
  input: NewSessionInput,
  id: string,
  now: string,
): { sessions: DAppSession[]; session: DAppSession } {
  const session: DAppSession = { id, approvedAt: now, lastUsedAt: now, ...input };
  // Upsert: replace any existing session for this origin.
  const next = [...sessions.filter((x) => x.origin !== input.origin), session];
  return { sessions: next, session };
}

export function removeSession(sessions: DAppSession[], origin: string): DAppSession[] {
  return sessions.filter((x) => x.origin !== origin);
}

export function touchSession(sessions: DAppSession[], origin: string, now: string): DAppSession[] {
  return sessions.map((x) => (x.origin === origin ? { ...x, lastUsedAt: now } : x));
}

export function updateSessionChain(
  sessions: DAppSession[],
  origin: string,
  chainId: number,
  now: string,
): DAppSession[] {
  return sessions.map((x) => (x.origin === origin ? { ...x, chainId, lastUsedAt: now } : x));
}

export function findSession(sessions: DAppSession[], origin: string): DAppSession | null {
  return sessions.find((x) => x.origin === origin) ?? null;
}
