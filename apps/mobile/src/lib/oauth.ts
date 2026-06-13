import * as AuthSession from "expo-auth-session";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { maybeCompleteAuthSession, openAuthSessionAsync } from "expo-web-browser";

import {
  SupabaseConfigurationError,
  getSupabaseClient,
  supabaseConfigIssue,
} from "@lib/supabase";

maybeCompleteAuthSession();

const isExpoGo = Constants.appOwnership === "expo";

// Use direct deep link return URL to avoid proxy requirement in Expo Go.
// - Expo Go: exp://<host>/--/auth-callback
// - Dev Client/Standalone: trezowallet://auth-callback
const redirectTo = isExpoGo
  ? AuthSession.makeRedirectUri({ 
      scheme: undefined, // Let Expo determine the exp:// scheme
      path: "auth-callback",
      preferLocalhost: false, // Prevent localhost:3000
    })
  : AuthSession.makeRedirectUri({ 
      scheme: "trezowallet", 
      path: "auth-callback",
    });
const webReturnUrl = redirectTo;
// Optional: quick runtime check in development to ensure redirect isn't problematic
if (__DEV__ && (redirectTo.includes("192.168.100.68:3000") || redirectTo.includes("auth.expo.io"))) {
  // eslint-disable-next-line no-console
  console.warn(
    `⚠️  Auth redirect using problematic URL (${redirectTo}). This may cause "Something went wrong" errors. Expected: exp://... or trezowallet://...`,
  );
}

export const authRedirectUri = redirectTo;
// Dev helper: see the exact redirect URI to add in Supabase Redirect URLs
if (__DEV__) {
  // eslint-disable-next-line no-console
  console.log("🔐 [OAuth] redirectTo:", redirectTo);
  // eslint-disable-next-line no-console
  console.log("📱 [OAuth] isExpoGo:", isExpoGo);
  // eslint-disable-next-line no-console
  console.log("🏗️  [OAuth] appOwnership:", Constants.appOwnership);
}

type OAuthProvider = "google" | "apple";

export class SupabaseAccountExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseAccountExistsError";
  }
}

const extractAuthError = (resultUrl: string | null | undefined) => {
  if (!resultUrl) return null;

  const [baseUrl, hashFragment = ""] = resultUrl.split("#");
  const queryParams = new URLSearchParams(baseUrl.split("?")[1] ?? "");
  const hashParams = new URLSearchParams(hashFragment);

  const errorDescription =
    hashParams.get("error_description") ??
    hashParams.get("error") ??
    queryParams.get("error_description") ??
    queryParams.get("error");

  const errorCode =
    hashParams.get("error_code") ??
    queryParams.get("error_code") ??
    (errorDescription ? errorDescription.toLowerCase() : null);

  if (!errorDescription && !errorCode) {
    return null;
  }

  return {
    errorCode: errorCode?.toLowerCase() ?? null,
    errorDescription,
  };
};

export const startSupabaseOAuth = async (
  provider: OAuthProvider,
): Promise<void> => {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: provider === "apple" ? "name email" : "profile email",
    },
  });

  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log("[OAuth] supabase auth url:", data?.url);
  }

  if (error) {
    if (/provider is not enabled/i.test(error.message)) {
      throw new SupabaseConfigurationError(
        `${provider.charAt(0).toUpperCase() + provider.slice(1)} sign-in isn’t enabled yet. In Supabase, open Authentication → Providers and configure the ${provider} provider for this project.`,
      );
    }
    throw error;
  }

  if (!data?.url) {
    throw new Error("Supabase did not return an authorization URL.");
  }

  // Ensure linking knows about our scheme at runtime (dev convenience)
  try {
    Linking.addEventListener("url", () => {});
  } catch {}

  // Open Supabase auth URL directly; WebBrowser will close when it navigates to our redirectTo
  const authResult = await openAuthSessionAsync(data.url, webReturnUrl);

  if (authResult.type === "dismiss" || authResult.type === "cancel") {
    throw new Error("Authentication was cancelled.");
  }

  if (authResult.type === "locked") {
    throw new Error("Another authentication session is already in progress.");
  }

  if (authResult.type === "success") {
    const authError = extractAuthError(authResult.url);
    if (authError) {
      const { errorCode, errorDescription } = authError;
      if (
        errorCode === "identity_already_exists" ||
        /already exists/i.test(errorDescription ?? "") ||
        /already registered/i.test(errorDescription ?? "")
      ) {
        throw new SupabaseAccountExistsError(
          "We found an existing Trezo account linked to this identity. Please sign in instead.",
        );
      }

      throw new Error(errorDescription ?? "Authentication failed.");
    }

    // Exchange the auth callback URL for a session.
    // Supabase JS v2 defaults to PKCE flow: callback has ?code=XXX (not #access_token).
    const callbackUrl = authResult.url;
    const [baseUrl, hashFragment = ""] = callbackUrl.split("#");
    const queryParams = new URLSearchParams(baseUrl.split("?")[1] ?? "");
    const hashParams = new URLSearchParams(hashFragment);

    const pkceCode = queryParams.get("code");
    if (pkceCode) {
      await client.auth.exchangeCodeForSession(pkceCode);
      return;
    }

    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");
    if (accessToken && refreshToken) {
      await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      return;
    }
  }

  // Fallback: on Android the Linking event may have already set the session
  // before openAuthSessionAsync resolved.
  await client.auth.getSession();
};

export const ensureOAuthPrerequisites = () => {
  if (supabaseConfigIssue) {
    throw new SupabaseConfigurationError(supabaseConfigIssue);
  }
};
