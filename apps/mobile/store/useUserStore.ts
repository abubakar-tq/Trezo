import AsyncStorage from "@react-native-async-storage/async-storage";
import { Session, User } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Profile = {
	username?: string;
	avatarUrl?: string;
};

type UserStore = {
	user: User | null;
	session: Session | null;
	profile: Profile | null;
	isLoggedIn: boolean;
	isOnboarded: boolean;
	setUser: (user: User | null) => void;
	setSession: (session: Session | null) => void;
	setProfile: (profile: Profile | null) => void;
	setIsLoggedIn: (value: boolean) => void;
	setIsOnboarded: (value: boolean) => void;
	reset: () => void;
	logout: () => Promise<void>;
};

const initialState = {
	user: null,
	session: null,
	profile: null,
	isLoggedIn: false,
	isOnboarded: false,
} satisfies Partial<UserStore>;

export const useUserStore = create<UserStore>()(
	persist(
		(set) => ({
			...initialState,
			setUser: (user) =>
				set((state) => ({
					user,
					isLoggedIn: Boolean(user && state.session),
				})),
			setSession: (session) =>
				set((state) => ({
					session,
					isLoggedIn: Boolean(session && state.user),
				})),
			setProfile: (profile) => set({ profile }),
			setIsLoggedIn: (value) => set({ isLoggedIn: value }),
			setIsOnboarded: (value) => set({ isOnboarded: value }),
			reset: () => set({ ...initialState }),
			logout: async () => {
				// Clear all AsyncStorage keys first
				await AsyncStorage.multiRemove([
					"Trezo_Wallet-user-store",
					"Trezo_Wallet-market-store",
					"Trezo_Wallet-auth-flow-store",
					"Trezo_Wallet-appearance-store",
					"trezo-browser-store",
				]);
				
				// Clear SecureStore (app lock preferences)
				try {
					await SecureStore.deleteItemAsync("trezo-lock-enabled");
				} catch (error) {
					console.warn("Failed to clear SecureStore:", error);
				}
				
				// Set state to initial (logged out) - this will persist the logout state
				set({ ...initialState });
			},
		}),
		{
			name: "Trezo_Wallet-user-store",
			storage: createJSONStorage(() => AsyncStorage),
			partialize: ({
				user,
				session,
				profile,
				isLoggedIn,
				isOnboarded,
			}) => ({ user, session, profile, isLoggedIn, isOnboarded }),
		},
	),
);
