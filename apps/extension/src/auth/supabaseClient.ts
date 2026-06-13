import { createClient } from "@supabase/supabase-js";
import { SHARED_CONFIG } from "../core/config";

// Chrome service workers have no localStorage, so we provide a chrome.storage.local
// adapter.  The popup also uses this same client so sessions are shared.
const chromeStorageAdapter = {
  getItem: (k: string): Promise<string | null> =>
    chrome.storage.local.get(k).then((r) => (r[k] ?? null) as string | null),
  setItem: (k: string, v: string): Promise<void> =>
    chrome.storage.local.set({ [k]: v }),
  removeItem: (k: string): Promise<void> =>
    chrome.storage.local.remove(k),
};

// IMPORTANT: autoRefreshToken is FALSE. The popup, the background service worker,
// and the approval window each create a Supabase client that share one session via
// chrome.storage. With auto-refresh on, they race to refresh — Supabase rotates the
// refresh token, the loser gets "Invalid Refresh Token: Refresh Token Not Found",
// and that fatal error WIPES the shared session (SIGNED_OUT) right after login.
// Disabling auto-refresh removes the race; sessions live on the ~1h access token and
// the user re-signs-in after that. (A single-context refresher can be added later.)
export const supabase = createClient(SHARED_CONFIG.supabaseUrl, SHARED_CONFIG.supabaseAnonKey, {
  auth: {
    storage: chromeStorageAdapter,
    persistSession: true,
    autoRefreshToken: false,
    storageKey: "trezo_ext_auth",
  },
});
