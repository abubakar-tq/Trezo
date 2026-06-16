/**
 * Pure liveness predicates for recovery requests and recovery attempts.
 *
 * Liveness was being inferred purely from a Supabase status enum (which can lag
 * the real deadline), and the `deadline` column was dropped from
 * email_recovery_groups in migration 20260529000000 — leaving created_at as the
 * only time anchor for the documented "pre-vote TTL". These predicates restore a
 * client-side liveness check so expired requests/attempts stop surfacing as
 * resumable.
 *
 * Kept dependency-free so they are unit-testable with the plain `tsx` test
 * convention used across apps/mobile. `nowMs` is injected for determinism.
 */

/** Documented pre-vote TTL for a recovery attempt group (created_at + 24h). */
export const RECOVERY_ATTEMPT_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * True when a recovery request's deadline has not yet passed. A missing or
 * unparseable deadline returns true so a request is never hidden purely on bad
 * time data — the (separate) terminal-status filter still applies.
 */
export function isDeadlineLive(deadline: string | null | undefined, nowMs: number): boolean {
  if (deadline == null) return true;
  const ms = new Date(deadline).getTime();
  if (!Number.isFinite(ms)) return true;
  return ms > nowMs;
}

/**
 * True when a recovery attempt is still within its pre-vote TTL window. A missing
 * or unparseable created_at returns true (conservative: never hide a
 * potentially-real in-progress attempt on bad data).
 */
export function isAttemptLive(
  createdAt: string | null | undefined,
  nowMs: number,
  ttlMs: number = RECOVERY_ATTEMPT_TTL_MS,
): boolean {
  if (!createdAt) return true;
  const ms = new Date(createdAt).getTime();
  if (!Number.isFinite(ms)) return true;
  return nowMs - ms < ttlMs;
}
