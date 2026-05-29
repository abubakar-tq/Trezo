import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ops from "./sessionOps";

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
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const { sessions, session } = ops.upsertSession(get().sessions, s, id, now);
        set({ sessions });
        return session;
      },
      removeSession: (origin) => set({ sessions: ops.removeSession(get().sessions, origin) }),
      touchSession: (origin) =>
        set({ sessions: ops.touchSession(get().sessions, origin, new Date().toISOString()) }),
      updateSessionChain: (origin, chainId) =>
        set({ sessions: ops.updateSessionChain(get().sessions, origin, chainId, new Date().toISOString()) }),
      findSession: (origin) => ops.findSession(get().sessions, origin),
    }),
    {
      name: "trezo_dapp_sessions_v1",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
