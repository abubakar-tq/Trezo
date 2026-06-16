function req(name: string, v: string | undefined): string {
  if (!v) throw new Error(`Missing required env ${name}. Set it in apps/extension/.env.local`);
  return v;
}
export const SHARED_CONFIG = {
  rpId: import.meta.env.VITE_PASSKEY_RP_ID || "abubakar-tq.github.io",
  supabaseUrl: req("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: req("VITE_SUPABASE_ANON_KEY", import.meta.env.VITE_SUPABASE_ANON_KEY),
};
