import { useCallback, useEffect, useRef, useState } from "react";

import { AuthError, Session } from "@supabase/supabase-js";

import * as Linking from "expo-linking";

import { GuardianSyncService } from "@/src/features/profile/services/GuardianSyncService";
import { ProfileSyncService } from "@/src/features/profile/services/ProfileSyncService";
import { AuthVerificationFlow } from "@/src/types/navigation";
import { navigate } from "@app/navigation/navigationRef";
import { authRedirectUri } from "@lib/oauth";
import {
    SupabaseConfigurationError,
    getSupabaseClient,
    isSupabaseConfigured,
    supabaseConfigIssue,
} from "@lib/supabase";
import { Profile, useUserStore } from "@store/useUserStore";

const sanitizeUsername = (value: string | null | undefined) => {
	if (!value) return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const fallbackUsername = (user: Session["user"], metadata: Record<string, unknown>) => {
	const metaName =
		sanitizeUsername((metadata.full_name as string) ?? undefined) ??
		sanitizeUsername((metadata.name as string) ?? undefined) ??
		sanitizeUsername((metadata.display_name as string) ?? undefined);
	if (metaName) {
		return metaName;
	}

	const usernameMeta = sanitizeUsername((metadata.username as string) ?? undefined);
	if (usernameMeta) {
		return usernameMeta;
	}

	const emailLocal = sanitizeUsername(user.email ?? undefined)?.split("@")[0] ?? "";
	const normalizedEmail = emailLocal.replace(/[^a-zA-Z0-9]/g, "");
	if (normalizedEmail.length > 0) {
		return normalizedEmail.charAt(0).toUpperCase() + normalizedEmail.slice(1);
	}

	return `TrezoUser${user.id.slice(0, 6)}`;
};

const fallbackAvatarUrl = (user: Session["user"], metadata: Record<string, unknown>) => {
	const primary = sanitizeUsername((metadata.avatarUrl as string) ?? undefined);
	if (primary) return primary;
	const alt = sanitizeUsername((metadata.avatar_url as string) ?? undefined);
	if (alt) return alt;
	const picture = sanitizeUsername((metadata.picture as string) ?? undefined);
	if (picture) return picture;
	return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.id)}`;
};

const normalizeProfile = (
  user: Session["user"] | null | undefined,
  forceNoAvatar: boolean = false,
  avatarRemoved: boolean = false
): Profile | null => {
  if (!user) return null;
  const metadata = user.user_metadata ?? {};
  const username = fallbackUsername(user, metadata);
  
  // 🔑 CRITICAL: If user explicitly removed avatar, respect that choice completely
  if (avatarRemoved) {
    return { username, avatarUrl: null, avatarRemoved: true };
  }
  
  // Otherwise, use the normal fallback logic
  const avatarUrl = forceNoAvatar ? null : fallbackAvatarUrl(user, metadata);
  return { username, avatarUrl, avatarRemoved: false };
};

type UseSupabaseAuthResult = {
	session: Session | null;
	loading: boolean;
	error: AuthError | SupabaseConfigurationError | null;
};

export const useSupabaseAuth = (): UseSupabaseAuthResult => {
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<AuthError | SupabaseConfigurationError | null>(null);
	const { setSession, setUser, setIsLoggedIn, setProfile, setIsOnboarded } =
		useUserStore();
	const lastAuthStateRef = useRef<boolean>(Boolean(useUserStore.getState().session));
	const syncedProfileRef = useRef<string | null>(null);

	const syncProfileDefaults = useCallback(
		async (user: Session["user"], profile: Profile | null) => {
			if (!profile?.username) {
				return;
			}

			if (syncedProfileRef.current === user.id) {
				return;
			}

			try {
				const client = getSupabaseClient();
				const metadata = user.user_metadata ?? {};
				const currentUsername = sanitizeUsername((metadata.username as string) ?? undefined);
				const currentAvatar =
					sanitizeUsername((metadata.avatarUrl as string) ?? undefined) ??
					sanitizeUsername((metadata.avatar_url as string) ?? undefined);

				const needsMetadataUpdate =
					profile.username !== currentUsername ||
					(profile.avatarUrl ?? null) !== (currentAvatar ?? null);

				if (needsMetadataUpdate) {
					await client.auth.updateUser({
						data: {
							...metadata,
							username: profile.username,
							avatarUrl: profile.avatarUrl,
						},
					});
				}

				await client
					.from("profiles")
					.upsert(
						{
							id: user.id,
							username: profile.username,
							avatar_url: profile.avatarUrl ?? null,
						},
						{ onConflict: "id" },
					);

				syncedProfileRef.current = user.id;
			} catch (syncError) {
				console.warn("Failed to sync Supabase profile", syncError);
			}
		},
		[],
	);

	const applySession = useCallback(
		async (session: Session | null) => {
			setSession(session);
			setUser(session?.user ?? null);
			const isAuthenticated = Boolean(session);
			setIsLoggedIn(isAuthenticated);

			if (isAuthenticated !== lastAuthStateRef.current) {
				lastAuthStateRef.current = isAuthenticated;
				if (isAuthenticated) {
					navigate("TabNavigation");
				} else {
					navigate("AuthNavigation");
				}
			}

			// Sync profile and guardians from database on login FIRST
			if (session?.user && isAuthenticated) {
				try {
					// Fetch profile from database first (this updates the store)
					const dbProfile = await ProfileSyncService.fetchAndSyncProfile(session.user.id);
					
					// Only use session metadata as fallback if database has no profile
					if (!dbProfile || !dbProfile.username) {
						// Profile from db might exist with no username but explicit null avatar_url
						const isAvatarExplicitlyNull = dbProfile ? (dbProfile.avatar_url === null) : false;
						const isAvatarRemoved = dbProfile?.avatar_removed ?? false;
						const profile = normalizeProfile(session?.user, isAvatarExplicitlyNull, isAvatarRemoved);
						setProfile(profile);
						setIsOnboarded(Boolean(profile?.username));
						
						if (profile?.username) {
							void syncProfileDefaults(session.user, profile);
						}
					} else {
						// Database profile exists, use it
						setIsOnboarded(true);
					}

					// Check if AA wallet exists and fetch guardians
					const aaWalletId = await GuardianSyncService.getAAWalletId(session.user.id);
					if (aaWalletId) {
						await GuardianSyncService.fetchAndSyncGuardians(aaWalletId);
						console.log("✅ Guardians synced from database");
					} else {
						console.log("📝 No AA wallet found, guardians stored locally only");
					}
				} catch (syncError) {
					console.warn("⚠️  Failed to sync user data from database:", syncError);
					// Fallback to session metadata on error
				const profile = normalizeProfile(session?.user, false, false);
				setProfile(profile);
				setIsOnboarded(Boolean(profile?.username));
			}
		} else if (!session?.user) {
			// User logged out
			const profile = normalizeProfile(session?.user, false, false);
				setProfile(profile);
				setIsOnboarded(Boolean(profile?.username));
				syncedProfileRef.current = null;
			}
		},
		[setIsLoggedIn, setIsOnboarded, setProfile, setSession, setUser, syncProfileDefaults],
	);

	const handleAuthRedirect = useCallback(
		async (incomingUrl: string | null | undefined) => {
			if (!incomingUrl) return;

			const normalizedRedirect = authRedirectUri.split("?")[0] ?? authRedirectUri;
			if (!incomingUrl.includes("auth-callback") && !incomingUrl.startsWith(normalizedRedirect)) {
				return;
			}

			const [baseUrl, hashFragment = ""] = incomingUrl.split("#");
			const queryString = baseUrl.split("?")[1] ?? "";
			const queryParams = new URLSearchParams(queryString);
			const hashParams = new URLSearchParams(hashFragment);

			const accessToken = hashParams.get("access_token");
			const refreshToken = hashParams.get("refresh_token");
			const typeParam = hashParams.get("type");
			const flowParam = queryParams.get("flow") as AuthVerificationFlow | null;
			const emailParam = queryParams.get("email") ?? undefined;

			if (!accessToken || !refreshToken) {
				return;
			}

			const client = getSupabaseClient();
			await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
			setError(null);

			if (typeParam === "recovery" && flowParam === "reset" && emailParam) {
				navigate("ResetPassword", { email: emailParam, flow: "reset" });
			}
		},
		[setError],
	);

	const applySessionRef = useRef(applySession);
	applySessionRef.current = applySession;

	useEffect(() => {
		let isMounted = true;

		if (!isSupabaseConfigured) {
			const configurationError = new SupabaseConfigurationError(
				supabaseConfigIssue ??
					"Supabase credentials are missing. Update your environment configuration and restart the app.",
			);
			if (isMounted) {
				setError(configurationError);
				setSession(null);
				setUser(null);
				setProfile(null);
				setIsOnboarded(false);
				setIsLoggedIn(false);
				setLoading(false);
			}
			return () => {
				isMounted = false;
			};
		}

		const client = getSupabaseClient();

		client.auth
			.getSession()
			.then(async ({ data, error: sessionError }) => {
				if (!isMounted) return;
				if (sessionError) {
					setError(sessionError);
					await applySessionRef.current(null);
					return;
				}

				const session = data.session ?? null;
				await applySessionRef.current(session);
			})
			.finally(() => {
				if (isMounted) {
					setLoading(false);
				}
			});

		const { data: subscription } = client.auth.onAuthStateChange(
			(event, session) => {
		applySessionRef.current(session);

				if (event === "TOKEN_REFRESHED") {
					setError(null);
				}
			},
		);

		return () => {
			isMounted = false;
			subscription.subscription.unsubscribe();
		};
	}, [setError, setIsLoggedIn, setIsOnboarded, setProfile, setSession, setUser]);

	useEffect(() => {
		if (!isSupabaseConfigured) return;

		Linking.getInitialURL().then((url) => {
			handleAuthRedirect(url);
		});
		const subscription = Linking.addEventListener("url", (event) => {
			handleAuthRedirect(event.url);
		});

		return () => {
			subscription.remove();
		};
	}, [handleAuthRedirect]);

	const session = useUserStore.getState().session;

	return { session, loading, error };
};
