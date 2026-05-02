import { getSupabaseClient } from "@lib/supabase";

export type RecoveryRequestStatus =
  | "draft"
  | "collecting_approvals"
  | "threshold_reached"
  | "scheduling"
  | "scheduled"
  | "ready_to_execute"
  | "executing"
  | "executed"
  | "partially_executed"
  | "expired"
  | "cancelled"
  | "failed";

export type RecoveryApprovalStatus = "pending" | "valid" | "invalid";

export type RecoveryRequestRecord = {
  id: string;
  user_id: string;
  aa_wallet_id: string;
  wallet_address: string;
  recovery_type: "guardian" | "email";
  request_hash: string;
  digest: string;
  new_passkey_hash: string;
  new_passkey_id_raw: string;
  new_passkey_json: {
    idRaw: string;
    px: string;
    py: string;
  };
  chain_scope_hash: string;
  guardian_addresses: string[];
  threshold: number;
  nonce: string | number;
  valid_after: string | null;
  deadline: string;
  timelock_seconds: string | number;
  target_chain_ids: number[];
  status: RecoveryRequestStatus;
  requester_note: string | null;
  recovery_intent_json: Record<string, unknown>;
  chain_scopes_json: unknown[];
  created_at: string;
  updated_at: string;
};

export type RecoveryApprovalRecord = {
  id: string;
  request_id: string;
  guardian_address: string;
  guardian_index: number;
  sig_kind: "EOA_ECDSA" | "ERC1271" | "APPROVE_HASH";
  signature: string;
  chain_id: number | null;
  approval_tx_hash: string | null;
  verification_status: RecoveryApprovalStatus;
  verification_error: string | null;
  created_at: string;
};

export type RecoveryChainStatusRecord = {
  id: string;
  request_id: string;
  chain_id: number;
  status:
    | "pending"
    | "wallet_undeployed"
    | "module_not_installed"
    | "guardians_not_configured"
    | "scope_mismatch"
    | "scheduling"
    | "scheduled"
    | "timelock_pending"
    | "ready_to_execute"
    | "executing"
    | "executed"
    | "failed"
    | "cancelled";
  schedule_tx_hash: string | null;
  execute_tx_hash: string | null;
  recovery_id_onchain: string | null;
  execute_after: string | null;
  nonce_at_creation: string | number | null;
  guardian_set_hash: string | null;
  policy_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type RecoveryRequest = RecoveryRequestRecord;
export type RecoveryApproval = RecoveryApprovalRecord;
export type RecoveryChainStatus = RecoveryChainStatusRecord;

const TERMINAL_RECOVERY_REQUEST_STATUSES: ReadonlySet<RecoveryRequestStatus> = new Set([
  "executed",
  "cancelled",
  "expired",
  "failed",
]);

export type CreateRecoveryRequestInput = {
  userId: string;
  aaWalletId: string;
  walletAddress: string;
  recoveryType?: "guardian" | "email";
  requestHash: string;
  digest: string;
  newPasskeyHash: string;
  newPasskeyIdRaw: string;
  newPasskeyJson: {
    idRaw: string;
    px: string;
    py: string;
  };
  chainScopeHash: string;
  guardianAddresses: readonly string[];
  threshold: number;
  nonce: number | string;
  validAfter?: string | null;
  deadline: string;
  timelockSeconds?: number | string;
  targetChainIds: readonly number[];
  requesterNote?: string | null;
  recoveryIntentJson: Record<string, unknown>;
  chainScopesJson: readonly unknown[];
  status?: RecoveryRequestStatus;
};

export type UpdateRecoveryRequestStatusInput = {
  requestId: string;
  status: RecoveryRequestStatus;
};

export type SubmitRecoveryOperationInput = {
  requestId: string;
  chainId: number;
  action: "schedule" | "execute";
  rpcUrl: string;
};

export type UpdateChainStatusInput = {
  requestId: string;
  chainId: number;
  status: RecoveryChainStatusRecord["status"];
  scheduleTxHash?: string | null;
  executeTxHash?: string | null;
  recoveryIdOnchain?: string | null;
  executeAfter?: string | null;
  nonceAtCreation?: string | number | null;
  guardianSetHash?: string | null;
  policyHash?: string | null;
};

const supabase = getSupabaseClient();

const normalizeAddress = (value: string) => value.trim().toLowerCase();

const isFunctionsHttpError = (error: unknown): error is {
  context?: {
    status?: number;
    json?: () => Promise<Record<string, unknown>>;
    text?: () => Promise<string>;
  };
} => {
  return Boolean(error && typeof error === "object" && "context" in error);
};

const parseFunctionInvokeErrorMessage = async (error: unknown): Promise<string | null> => {
  if (!isFunctionsHttpError(error) || !error.context) {
    return null;
  }

  const context = error.context;
  try {
    if (typeof context.json === "function") {
      const payload = await context.json();
      const payloadMessage = payload?.error ?? payload?.message;
      if (typeof payloadMessage === "string" && payloadMessage.trim().length > 0) {
        return payloadMessage;
      }
    }
  } catch {
    // ignore JSON parsing failures
  }

  try {
    if (typeof context.text === "function") {
      const text = await context.text();
      if (text.trim().length > 0) {
        return text;
      }
    }
  } catch {
    // ignore text parsing failures
  }

  if (typeof context.status === "number") {
    return `Recovery operation failed with HTTP ${context.status}.`;
  }

  return null;
};

export class RecoveryRequestService {
  async createRecoveryRequest(input: CreateRecoveryRequestInput): Promise<RecoveryRequestRecord> {
    const payload = {
      user_id: input.userId,
      aa_wallet_id: input.aaWalletId,
      wallet_address: normalizeAddress(input.walletAddress),
      recovery_type: input.recoveryType ?? "guardian",
      request_hash: input.requestHash,
      digest: input.digest,
      new_passkey_hash: input.newPasskeyHash,
      new_passkey_id_raw: input.newPasskeyIdRaw,
      new_passkey_json: input.newPasskeyJson,
      chain_scope_hash: input.chainScopeHash,
      guardian_addresses: input.guardianAddresses.map(normalizeAddress),
      threshold: input.threshold,
      nonce: input.nonce,
      valid_after: input.validAfter ?? null,
      deadline: input.deadline,
      timelock_seconds: input.timelockSeconds ?? 86400,
      target_chain_ids: [...input.targetChainIds],
      status: input.status ?? "draft",
      requester_note: input.requesterNote ?? null,
      recovery_intent_json: input.recoveryIntentJson,
      chain_scopes_json: [...input.chainScopesJson],
    };

    const { data, error } = await supabase
      .from("recovery_requests")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create recovery request: ${error.message}`);
    }

    return data as RecoveryRequestRecord;
  }

  async getRecoveryRequest(requestId: string): Promise<RecoveryRequestRecord | null> {
    const { data, error } = await supabase
      .from("recovery_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch recovery request: ${error.message}`);
    }

    return (data as RecoveryRequestRecord | null) ?? null;
  }

  async listRecoveryRequestsForWallet(aaWalletId: string): Promise<RecoveryRequestRecord[]> {
    const { data, error } = await supabase
      .from("recovery_requests")
      .select("*")
      .eq("aa_wallet_id", aaWalletId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list recovery requests: ${error.message}`);
    }

    return (data ?? []) as RecoveryRequestRecord[];
  }

  async listRecoveryRequestsForUser(
    userId: string,
    walletAddress?: string | null,
  ): Promise<RecoveryRequestRecord[]> {
    let query = supabase
      .from("recovery_requests")
      .select("*")
      .eq("user_id", userId);

    if (walletAddress) {
      query = query.eq("wallet_address", normalizeAddress(walletAddress));
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list recovery requests for user: ${error.message}`);
    }

    return (data ?? []) as RecoveryRequestRecord[];
  }

  async getLatestActiveRecoveryRequestForUser(
    userId: string,
    walletAddress?: string | null,
  ): Promise<RecoveryRequestRecord | null> {
    const requests = await this.listRecoveryRequestsForUser(userId, walletAddress);
    const active = requests.find((request) => !TERMINAL_RECOVERY_REQUEST_STATUSES.has(request.status));
    return active ?? null;
  }

  async updateRecoveryRequestStatus(
    input: UpdateRecoveryRequestStatusInput,
  ): Promise<RecoveryRequestRecord> {
    const { data, error } = await supabase
      .from("recovery_requests")
      .update({ status: input.status, updated_at: new Date().toISOString() })
      .eq("id", input.requestId)
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update recovery request status: ${error.message}`);
    }

    return data as RecoveryRequestRecord;
  }

  async upsertGuardianApproval(approval: {
    requestId: string;
    guardianAddress: string;
    guardianIndex: number;
    sigKind: RecoveryApprovalRecord["sig_kind"];
    signature: string;
    chainId?: number | null;
    approvalTxHash?: string | null;
    verificationStatus?: RecoveryApprovalStatus;
    verificationError?: string | null;
  }): Promise<RecoveryApprovalRecord> {
    const { data, error } = await supabase
      .from("recovery_approvals")
      .upsert(
        {
          request_id: approval.requestId,
          guardian_address: normalizeAddress(approval.guardianAddress),
          guardian_index: approval.guardianIndex,
          sig_kind: approval.sigKind,
          signature: approval.signature,
          chain_id: approval.chainId ?? null,
          approval_tx_hash: approval.approvalTxHash ?? null,
          verification_status: approval.verificationStatus ?? "pending",
          verification_error: approval.verificationError ?? null,
        },
        { onConflict: "request_id,guardian_address" },
      )
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to save guardian approval: ${error.message}`);
    }

    return data as RecoveryApprovalRecord;
  }

  async listGuardianApprovals(requestId: string): Promise<RecoveryApprovalRecord[]> {
    const { data, error } = await supabase
      .from("recovery_approvals")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to list guardian approvals: ${error.message}`);
    }

    return (data ?? []) as RecoveryApprovalRecord[];
  }

  async listApprovals(requestId: string): Promise<RecoveryApprovalRecord[]> {
    return this.listGuardianApprovals(requestId);
  }

  async listChainStatuses(requestId: string): Promise<RecoveryChainStatusRecord[]> {
    const { data, error } = await supabase
      .from("recovery_chain_statuses")
      .select("*")
      .eq("request_id", requestId)
      .order("chain_id", { ascending: true });

    if (error) {
      throw new Error(`Failed to list recovery chain statuses: ${error.message}`);
    }

    return (data ?? []) as RecoveryChainStatusRecord[];
  }

  async updateChainStatus(input: UpdateChainStatusInput): Promise<RecoveryChainStatusRecord> {
    const payload = {
      request_id: input.requestId,
      chain_id: input.chainId,
      status: input.status,
      schedule_tx_hash: input.scheduleTxHash ?? null,
      execute_tx_hash: input.executeTxHash ?? null,
      recovery_id_onchain: input.recoveryIdOnchain ?? null,
      execute_after: input.executeAfter ?? null,
      nonce_at_creation: input.nonceAtCreation ?? null,
      guardian_set_hash: input.guardianSetHash ?? null,
      policy_hash: input.policyHash ?? null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("recovery_chain_statuses")
      .upsert(payload, { onConflict: "request_id,chain_id" })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to update recovery chain status: ${error.message}`);
    }

    return data as RecoveryChainStatusRecord;
  }

  subscribeToApprovals(
    requestId: string,
    callback: (approvals: RecoveryApprovalRecord[]) => void,
  ): () => void {
    const channelName = `recovery-approvals:${requestId}:${Date.now()}:${Math.random()
      .toString(36)
      .slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recovery_approvals",
          filter: `request_id=eq.${requestId}`,
        },
        () => {
          void this.listGuardianApprovals(requestId)
            .then(callback)
            .catch(() => {
              // Ignore transient refresh errors; manual refresh remains available.
            });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }

  async submitRecoveryOperation(input: SubmitRecoveryOperationInput): Promise<{
    success: boolean;
    txHash: string;
    chainStatus: RecoveryChainStatusRecord;
    requestStatus: RecoveryRequestStatus;
  }> {
    const { data, error } = await supabase.functions.invoke("submit-recovery-operation", {
      body: input,
    });

    if (error) {
      // supabase-js may return a generic FunctionsHttpError without surfacing JSON message.
      const functionMessage = await parseFunctionInvokeErrorMessage(error);
      const message =
        (data as { error?: string } | null)?.error ??
        functionMessage ??
        error.message ??
        "Failed to submit recovery operation.";
      throw new Error(message);
    }

    return data as {
      success: boolean;
      txHash: string;
      chainStatus: RecoveryChainStatusRecord;
      requestStatus: RecoveryRequestStatus;
    };
  }
}

let recoveryRequestServiceInstance: RecoveryRequestService | null = null;

export const getRecoveryRequestService = (): RecoveryRequestService => {
  if (!recoveryRequestServiceInstance) {
    recoveryRequestServiceInstance = new RecoveryRequestService();
  }

  return recoveryRequestServiceInstance;
};

export const isRecoveryRequestTerminal = (status: RecoveryRequestStatus): boolean =>
  TERMINAL_RECOVERY_REQUEST_STATUSES.has(status);

export default RecoveryRequestService;
