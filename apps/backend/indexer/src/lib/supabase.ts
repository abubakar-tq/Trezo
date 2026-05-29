import { createClient } from "@supabase/supabase-js";
import ws from "ws";

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  throw new Error("[indexer] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

// Service role bypasses RLS — the indexer writes rows on behalf of users without an auth
// session. The indexer only uses PostgREST (insert/upsert/select), never Realtime — but
// supabase-js eagerly constructs a Realtime WebSocket at createClient time, which needs an
// explicit WS impl on Node < 22 (we pin Node 20 because Ponder's fetch breaks on Node 24).
export const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws as unknown as typeof WebSocket },
});
