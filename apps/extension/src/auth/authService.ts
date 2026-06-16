import { supabase } from "./supabaseClient";

export const AuthService = {
  async signInWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data.user;
  },
  async signInWithGoogle(): Promise<void> {
    const redirectTo = chrome.identity.getRedirectURL();
    console.info("[Trezo] OAuth redirect URL (add to Supabase Auth → Redirect URLs):", redirectTo);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true, queryParams: { prompt: "select_account" } },
    });
    if (error) throw new Error(error.message);
    if (!data?.url) throw new Error("Could not start Google sign-in");
    const redirectUrl = await chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true });
    if (!redirectUrl) throw new Error("Google sign-in was cancelled");
    // Supabase default flow is implicit → tokens arrive in the URL hash; PKCE → ?code=
    const u = new URL(redirectUrl);
    const params = new URLSearchParams(u.hash ? u.hash.slice(1) : u.search);
    const code = params.get("code");
    if (code) {
      const { error: ex } = await supabase.auth.exchangeCodeForSession(code);
      if (ex) throw new Error(ex.message);
      return;
    }
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    if (access_token && refresh_token) {
      const { error: se } = await supabase.auth.setSession({ access_token, refresh_token });
      if (se) throw new Error(se.message);
      return;
    }
    const errDesc = params.get("error_description") || params.get("error");
    throw new Error(errDesc || "Google sign-in did not return a session");
  },
  async getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
  },
  async signOut() {
    await supabase.auth.signOut();
  },
};
