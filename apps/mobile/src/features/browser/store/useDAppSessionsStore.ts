import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type DAppSession = {
  id: string;
  origin: string;
  accountAddress: `0x${string}`;
  chainId: number;
  approvedAt: string;
  lastUsedAt: string;
};

type DAppSessionsState = {
  sessions: DAppSession[];
  addSession: (s: Omit<DAppSession, "id" | "approvedAt" | "lastUsedAt">) => DAppSession;
  removeSession: (origin: string) => void;
  touchSession: (origin: string) => void;
  updateSessionChain: (origin: string, chainId: number) => void;
  findSession: (origin: string) => DAppSession | null;
};

export const useDAppSessionsStore = create<DAppSessionsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      addSession: (s) => {
        const now = new Date().toISOString();
        const session: DAppSession = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          approvedAt: now,
          lastUsedAt: now,
          ...s,
        };
        // Upsert: replace any existing session for this origin
        set({ sessions: [...get().sessions.filter((x) => x.origin !== s.origin), session] });
        return session;
      },
      removeSession: (origin) =>
        set({ sessions: get().sessions.filter((x) => x.origin !== origin) }),
      touchSession: (origin) =>
        set({
          sessions: get().sessions.map((x) =>
            x.origin === origin ? { ...x, lastUsedAt: new Date().toISOString() } : x
          ),
        }),
      updateSessionChain: (origin, chainId) =>
        set({
          sessions: get().sessions.map((x) =>
            x.origin === origin ? { ...x, chainId, lastUsedAt: new Date().toISOString() } : x
          ),
        }),
      findSession: (origin) => get().sessions.find((x) => x.origin === origin) ?? null,
    }),
    {
      name: "trezo_dapp_sessions_v1",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
