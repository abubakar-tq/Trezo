import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

export class SupabaseConfigurationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "SupabaseConfigurationError";
	}
}

const getConfigValue = (key: string): string | undefined => {
	const extraValue = Constants.expoConfig?.extra?.[key];
	if (typeof extraValue === "string" && extraValue.length > 0) {
		return extraValue;
	}
	const envValue = process.env[`EXPO_PUBLIC_${key.toUpperCase()}`];
	if (typeof envValue === "string" && envValue.length > 0) {
		return envValue;
	}
	return undefined;
};

const supabaseUrl = getConfigValue("supabaseUrl");
const supabaseAnonKey = getConfigValue("supabaseAnonKey");

const missingKeys: string[] = [];
if (!supabaseUrl) missingKeys.push("EXPO_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) missingKeys.push("EXPO_PUBLIC_SUPABASE_ANON_KEY");

const missingCredentialsMessage =
	missingKeys.length === 0
		? null
		: `Supabase credentials are missing. Define ${missingKeys.join(
			" and ",
		)} in your .env file or expo.extra configuration and restart the app.`;

const supabaseInstance: SupabaseClient | null =
	missingCredentialsMessage === null
		? createClient(supabaseUrl!, supabaseAnonKey!, {
				auth: {
					storage: AsyncStorage,
					autoRefreshToken: true,
					persistSession: true,
					detectSessionInUrl: false,
				},
			})
		: null;

const configurationError =
	missingCredentialsMessage === null
		? null
		: new SupabaseConfigurationError(missingCredentialsMessage);

export const isSupabaseConfigured = supabaseInstance !== null;
export const supabaseConfigIssue = configurationError?.message ?? null;

export const getSupabaseClient = (): SupabaseClient => {
	if (supabaseInstance) {
		return supabaseInstance;
	}
	throw configurationError ?? new SupabaseConfigurationError("Supabase client is not initialised.");
};

export type SupabaseClientType = SupabaseClient;
