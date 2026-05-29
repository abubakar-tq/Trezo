import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  throw new Error("[indexer] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

// Service role bypasses RLS — required because indexer rows are written on
// behalf of users without an auth session.
export const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});
