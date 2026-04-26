import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AuthVerificationFlow } from "@/src/types/navigation";

type SuccessType = "account-created" | "password-updated";

type AuthFlowState = {
  pendingEmail: string | null;
  pendingFlow: AuthVerificationFlow | null;
  guardNavigation: boolean;
  lastSuccess: { type: SuccessType; email: string } | null;
  resendAvailableAt: Record<string, number>;
  setPending: (email: string, flow: AuthVerificationFlow) => void;
  clearPending: () => void;
  setGuardNavigation: (value: boolean) => void;
  setLastSuccess: (payload: { type: SuccessType; email: string } | null) => void;
  setResendCooldown: (email: string, flow: AuthVerificationFlow, seconds: number) => void;
  clearResendCooldown: (email: string, flow: AuthVerificationFlow) => void;
};

const initialState = {
  pendingEmail: null,
  pendingFlow: null,
  guardNavigation: false,
  lastSuccess: null,
  resendAvailableAt: {},
} satisfies Omit<
  AuthFlowState,
  "setPending" | "clearPending" | "setGuardNavigation" | "setLastSuccess" | "setResendCooldown" | "clearResendCooldown"
>;

const cooldownKey = (email: string, flow: AuthVerificationFlow) =>
  `${flow}:${email.trim().toLowerCase()}`;

export const useAuthFlowStore = create<AuthFlowState>()(
  persist(
    (set) => ({
      ...initialState,
      setPending: (email, flow) =>
        set({
          pendingEmail: email,
          pendingFlow: flow,
          guardNavigation: true,
        }),
      clearPending: () =>
        set((state) => ({
          pendingEmail: null,
          pendingFlow: null,
          guardNavigation: state.guardNavigation,
        })),
      setGuardNavigation: (value) => set({ guardNavigation: value }),
      setLastSuccess: (payload) => set({ lastSuccess: payload }),
      setResendCooldown: (email, flow, seconds) =>
        set((state) => {
          const key = cooldownKey(email, flow);
          return {
            resendAvailableAt: {
              ...state.resendAvailableAt,
              [key]: Date.now() + seconds * 1000,
            },
          };
        }),
      clearResendCooldown: (email, flow) =>
        set((state) => {
          const key = cooldownKey(email, flow);
          if (!(key in state.resendAvailableAt)) {
            return state;
          }
          const next = { ...state.resendAvailableAt };
          delete next[key];
          return { resendAvailableAt: next };
        }),
    }),
    {
      name: "Trezo_Wallet-auth-flow-store",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
