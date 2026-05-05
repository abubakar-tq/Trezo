import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { logger } from "./lib/logger.js";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    logger.fatal({ name }, "missing required environment variable");
    process.exit(1);
  }
  return val;
}

export const PONDER_SCHEMA = process.env.PONDER_DATABASE_SCHEMA ?? "indexer_v1";
export const POLL_INTERVAL_MS = Number(process.env.SYNC_WORKER_POLL_INTERVAL_MS ?? "2000");

export const supabase = createClient(
  requireEnv("SUPABASE_URL"),
  requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export const ponderDb = new pg.Pool({
  connectionString: requireEnv("DATABASE_URL"),
  max: 5,
  idleTimeoutMillis: 30_000,
});

// chain_id → network_key mapping. Read existing wallet_transactions rows
// to confirm conventions ('anvil-local', 'base-mainnet-fork').
export const CHAIN_ID_TO_NETWORK_KEY: Record<number, string> = {
  31337: "anvil-local",
  8453: "base-mainnet-fork",
};
