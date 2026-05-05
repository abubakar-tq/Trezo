import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
};

type GroupRow = {
  id: string;
  user_id: string;
  config_id: string;
  smart_account_address: string;
  chain_ids: number[];
  multichain_recovery_data_hash: string;
  deadline: string;
  status: string;
  recovery_data: string;
};

type ApprovalRow = {
  id: string;
  group_id: string;
  guardian_email_hash: string;
  masked_email: string | null;
  relayer_request_id: string | null;
  status: string;
  last_error: string | null;
};

type ChainRequestRow = {
  id: string;
  group_id: string;
  chain_id: number;
  status: string;
};

type SubmissionRow = {
  id: string;
  approval_id: string;
  chain_request_id: string;
  chain_id: number;
  relayer_request_id: string | null;
  email_auth_msg_json: unknown;
  proof_hash: string | null;
  tx_hash: string | null;
  status: string;
  last_error: string | null;
};

type GuardianRow = {
  email_hash: string;
  normalized_email_encrypted: string;
  masked_email: string;
  weight: number;
};

type ConfigRow = {
  id: string;
  threshold: number;
  security_mode: string;
};

const PLAINTEXT_PREFIX = "plain-v1:";

export class RecoveryStore {
  private client: SupabaseClient;

  constructor(config: SupabaseConfig) {
    this.client = createClient(config.url, config.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async getGroup(groupId: string): Promise<GroupRow | null> {
    const { data, error } = await this.client
      .from("email_recovery_groups")
      .select("id, user_id, config_id, smart_account_address, chain_ids, multichain_recovery_data_hash, deadline, status, recovery_data")
      .eq("id", groupId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch group: ${error.message}`);
    return data as GroupRow | null;
  }

  async getConfig(configId: string): Promise<ConfigRow | null> {
    const { data, error } = await this.client
      .from("email_recovery_configs")
      .select("id, threshold, security_mode")
      .eq("id", configId)
      .maybeSingle();

    if (error) throw new Error(`Failed to fetch config: ${error.message}`);
    return data as ConfigRow | null;
  }

  async getGuardians(configId: string): Promise<GuardianRow[]> {
    const { data, error } = await this.client
      .from("email_recovery_guardians")
      .select("email_hash, normalized_email_encrypted, masked_email, weight")
      .eq("config_id", configId);

    if (error) throw new Error(`Failed to fetch guardians: ${error.message}`);
    return (data ?? []) as GuardianRow[];
  }

  async getApprovals(groupId: string): Promise<ApprovalRow[]> {
    const { data, error } = await this.client
      .from("email_recovery_approvals")
      .select("id, group_id, guardian_email_hash, masked_email, relayer_request_id, status, last_error")
      .eq("group_id", groupId);

    if (error) throw new Error(`Failed to fetch approvals: ${error.message}`);
    return (data ?? []) as ApprovalRow[];
  }

  async getChainRequests(groupId: string): Promise<ChainRequestRow[]> {
    const { data, error } = await this.client
      .from("email_recovery_chain_requests")
      .select("id, group_id, chain_id, status")
      .eq("group_id", groupId);

    if (error) throw new Error(`Failed to fetch chain requests: ${error.message}`);
    return (data ?? []) as ChainRequestRow[];
  }

  async getSubmissions(groupId: string): Promise<SubmissionRow[]> {
    const { data, error } = await this.client
      .from("email_recovery_chain_approval_submissions")
      .select("id, approval_id, chain_request_id, chain_id, relayer_request_id, email_auth_msg_json, proof_hash, tx_hash, status, last_error")
      .eq("approval_id", `(${(await this.getApprovals(groupId)).map((a) => a.id).join(",")})`);

    if (error) {
      const { data: allSubs, error: subError } = await this.client
        .from("email_recovery_chain_approval_submissions")
        .select("id, approval_id, chain_request_id, chain_id, relayer_request_id, email_auth_msg_json, proof_hash, tx_hash, status, last_error");

      if (subError) throw new Error(`Failed to fetch submissions: ${subError.message}`);
      return (allSubs ?? []) as SubmissionRow[];
    }

    return (data ?? []) as SubmissionRow[];
  }

  async getSubmissionsByApprovalIds(approvalIds: string[]): Promise<SubmissionRow[]> {
    if (approvalIds.length === 0) return [];
    const { data, error } = await this.client
      .from("email_recovery_chain_approval_submissions")
      .select("id, approval_id, chain_request_id, chain_id, relayer_request_id, email_auth_msg_json, proof_hash, tx_hash, status, last_error")
      .in("approval_id", approvalIds);

    if (error) throw new Error(`Failed to fetch submissions: ${error.message}`);
    return (data ?? []) as SubmissionRow[];
  }

  resolveGuardianEmail(
    guardian: GuardianRow,
  ): string | null {
    const encrypted = guardian.normalized_email_encrypted;
    if (encrypted.startsWith(PLAINTEXT_PREFIX)) {
      return encrypted.slice(PLAINTEXT_PREFIX.length);
    }
    return null;
  }

  async updateApprovalStatus(
    approvalId: string,
    status: string,
    updates: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await this.client
      .from("email_recovery_approvals")
      .update({ status, ...updates })
      .eq("id", approvalId);

    if (error) throw new Error(`Failed to update approval: ${error.message}`);
  }

  async updateGroupStatus(groupId: string, status: string): Promise<void> {
    const { error } = await this.client
      .from("email_recovery_groups")
      .update({ status })
      .eq("id", groupId);

    if (error) throw new Error(`Failed to update group: ${error.message}`);
  }

  async upsertSubmission(params: {
    approvalId: string;
    chainRequestId: string;
    chainId: number;
    relayerRequestId: string;
  }): Promise<void> {
    const { error } = await this.client
      .from("email_recovery_chain_approval_submissions")
      .upsert(
        {
          approval_id: params.approvalId,
          chain_request_id: params.chainRequestId,
          chain_id: params.chainId,
          relayer_request_id: params.relayerRequestId,
          status: "request_sent",
          last_error: null,
        },
        { onConflict: "approval_id,chain_request_id" },
      );

    if (error) throw new Error(`Failed to upsert submission: ${error.message}`);
  }

  async updateSubmissionStatus(
    submissionId: string,
    status: string,
    updates: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await this.client
      .from("email_recovery_chain_approval_submissions")
      .update({ status, ...updates })
      .eq("id", submissionId);

    if (error) throw new Error(`Failed to update submission: ${error.message}`);
  }

  async updateChainRequestStatus(
    chainRequestId: string,
    status: string,
    updates: Record<string, unknown> = {},
  ): Promise<void> {
    const { error } = await this.client
      .from("email_recovery_chain_requests")
      .update({ status, ...updates })
      .eq("id", chainRequestId);

    if (error) throw new Error(`Failed to update chain request: ${error.message}`);
  }
}
