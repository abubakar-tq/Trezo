import type { Pool } from "pg";
import { logger } from "./logger.js";

const PONDER_SCHEMA = process.env.PONDER_DATABASE_SCHEMA ?? "indexer_v1";

export async function markSynced(
  db: Pool,
  table: string,
  where: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(where);
  const values = Object.values(where);
  const conditions = keys.map((k, i) => `"${k}" = $${i + 1}`).join(" AND ");
  await db.query(
    `UPDATE "${PONDER_SCHEMA}"."${table}" SET "synced_to_supabase" = true WHERE ${conditions}`,
    values
  );
}

export function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === "23505";
}

export function logSkipped(table: string, reason: string, id: unknown): void {
  logger.debug({ table, reason, id }, "skipped sync row");
}
