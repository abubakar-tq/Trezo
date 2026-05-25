// Test helpers: minimal fake RecoveryStore and a fetch mocker that intercepts
// outgoing calls to the upstream ZK Email relayer. Lives outside *.test.ts so
// multiple test files can share it without re-importing vi internals.

import { vi } from "vitest";
import type { RecoveryStore } from "./recovery-store.js";

export type FakeStoreState = {
  groups: Map<string, any>;
  configs: Map<string, any>;
  guardians: Map<string, any[]>;
  approvals: Map<string, any[]>;
  chainRequests: Map<string, any[]>;
  submissions: Map<string, any>;
};

export function makeFakeStore(state: Partial<FakeStoreState> = {}): RecoveryStore {
  const s: FakeStoreState = {
    groups: state.groups ?? new Map(),
    configs: state.configs ?? new Map(),
    guardians: state.guardians ?? new Map(),
    approvals: state.approvals ?? new Map(),
    chainRequests: state.chainRequests ?? new Map(),
    submissions: state.submissions ?? new Map(),
  };

  return {
    async getGroup(id: string) {
      return s.groups.get(id) ?? null;
    },
    async getConfig(id: string) {
      return s.configs.get(id) ?? null;
    },
    async getGuardians(configId: string) {
      return s.guardians.get(configId) ?? [];
    },
    async getApprovals(groupId: string) {
      return s.approvals.get(groupId) ?? [];
    },
    async getChainRequests(groupId: string) {
      return s.chainRequests.get(groupId) ?? [];
    },
    async getSubmissions(_groupId: string) {
      return Array.from(s.submissions.values());
    },
    async getSubmissionsByApprovalIds(approvalIds: string[]) {
      return Array.from(s.submissions.values()).filter((sub: any) =>
        approvalIds.includes(sub.approval_id),
      );
    },
    resolveGuardianEmail(g: any) {
      const e = g.normalized_email_encrypted ?? "";
      return e.startsWith("plain-v1:") ? e.slice("plain-v1:".length) : null;
    },
    async updateApprovalStatus(approvalId: string, status: string, updates = {}) {
      for (const [gid, list] of s.approvals.entries()) {
        const idx = list.findIndex((a: any) => a.id === approvalId);
        if (idx >= 0) {
          list[idx] = { ...list[idx], status, ...updates };
          s.approvals.set(gid, list);
          return;
        }
      }
    },
    async updateGroupStatus(groupId: string, status: string) {
      const g = s.groups.get(groupId);
      if (g) s.groups.set(groupId, { ...g, status });
    },
    async upsertSubmission(params: { approvalId: string; chainRequestId: string; chainId: number; relayerRequestId: string }) {
      const key = `${params.approvalId}:${params.chainRequestId}`;
      s.submissions.set(key, {
        id: key,
        approval_id: params.approvalId,
        chain_request_id: params.chainRequestId,
        chain_id: params.chainId,
        relayer_request_id: params.relayerRequestId,
        email_auth_msg_json: null,
        proof_hash: null,
        tx_hash: null,
        status: "request_sent",
        last_error: null,
      });
    },
    async updateSubmissionStatus(id: string, status: string, updates = {}) {
      const s2 = s.submissions.get(id);
      if (s2) s.submissions.set(id, { ...s2, status, ...updates });
    },
    async updateChainRequestStatus(chainRequestId: string, status: string) {
      for (const [gid, list] of s.chainRequests.entries()) {
        const idx = list.findIndex((c: any) => c.id === chainRequestId);
        if (idx >= 0) {
          list[idx] = { ...list[idx], status };
          s.chainRequests.set(gid, list);
          return;
        }
      }
    },
  } as unknown as RecoveryStore;
}

export type RelayerCall = { url: string; body: any };

export function installFakeRelayer(handler: (call: RelayerCall) => unknown): {
  calls: RelayerCall[];
  restore: () => void;
} {
  const calls: RelayerCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: any, init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    const body = init?.body ? JSON.parse(init.body) : {};
    const call = { url, body };
    calls.push(call);
    const result = handler(call);
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as any;
  return { calls, restore: () => (globalThis.fetch = original) };
}
