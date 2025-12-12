import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Guardian = {
	id: string;
	address: string;
};

type RecoveryStatusStore = {
	guardianConfigured: boolean;
	guardians: Guardian[];
	requiredSignatures: number; // M value
	totalGuardians: number; // N value
	setGuardianConfigured: (configured: boolean) => void;
	setGuardians: (guardians: Guardian[], m: number, n: number) => void;
	clearGuardians: () => void;
};

const initialState = {
	guardianConfigured: false,
	guardians: [],
	requiredSignatures: 2,
	totalGuardians: 3,
} satisfies Partial<RecoveryStatusStore>;

export const useRecoveryStatusStore = create<RecoveryStatusStore>()(
	persist(
		(set) => ({
			...initialState,
			setGuardianConfigured: (configured) =>
				set({ guardianConfigured: configured }),
			setGuardians: (guardians, m, n) =>
				set({
					guardians,
					requiredSignatures: m,
					totalGuardians: n,
					guardianConfigured: guardians.length > 0,
				}),
			clearGuardians: () =>
				set({
					...initialState,
				}),
		}),
		{
			name: "recovery-status-storage",
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
);
