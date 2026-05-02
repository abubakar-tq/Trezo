import { getSupabaseClient } from "@lib/supabase";
import { type SupportedChainId } from "@/src/integration/chains";
import { getDeployment, getPublicClient } from "@/src/integration/viem";
import { getPasskeyOnchainState } from "@/src/integration/viem/account";
import {
  keccak256,
  stringToHex,
  type Address,
  type Hex,
} from "viem";
import {
  encodeEmailRecoveryData,
  hashChainScopes,
  hashEmailRecoveryData,
  hashPasskeyInit,
  hashRecoveryIntent,
  normalizeChainScopes,
  type ChainRecoveryScope,
  type EmailRecoveryData,
  type PasskeyInit,
  type RecoveryIntent,
} from "@/src/integration/viem/recoveryHash";
import {
  EmailRecoveryService,
} from "./EmailRecoveryService";
import type {
  EmailAuthMsgData,
  RelayerRequestStatus,
  ZkEmailRelayerAdapter,
  ZkEmailRelayerConfig,
} from "./ZkEmailRelayerAdapter";
import { MockZkEmailRelayer } from "./MockZkEmailRelayer";
import { ZkEmailGenericRelayer } from "./ZkEmailGenericRelayer";

export type EmailRecoveryGroupStatus =
  | "draft"
  | "sending_approvals"
  | "collecting_approvals"
  | "threshold_reached"
  | "proofs_submitting"
  | "ready_to_execute"
  | "executing"
  | "partially_executed"
  | "executed"
  | "expired"
  | "cancelled"
  | "failed";

export type ChainRequestStatus =
  | "pending"
  | "proofs_pending"
  | "proofs_submitted"
  | "threshold_reached"
  | "timelock_pending"
  | "ready_to_execute"
  | "executing"
  | "executed"
  | "failed"
  | "cancelled";

export type ApprovalStatus =
  | "pending"
  | "email_sent"
  | "guardian_replied"
  | "proof_generated"
  | "submitted_to_chains"
  | "confirmed"
  | "failed"
  | "rejected";

export type ChainSubmissionStatus =
  | "pending"
  | "request_sent"
  | "proof_ready"
  | "submitting"
  | "submitted"
  | "confirmed"
  | "failed";

export type EmailRecoveryGroupView = {
  id: string;
  userId: string;
  configId: string;
  smartAccountAddress: string;
  chainIds: number[];
  chainScopeHash: string;
  recoveryIntentHash: string;
  multichainRecoveryDataHash: string;
  newPasskeyHash: string;
  newPasskeyIdRawHash: string;
  deadline: string;
  status: EmailRecoveryGroupStatus;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
};

export type ChainRequestView = {
  id: string;
  groupId: string;
  chainId: number;
  smartAccountAddress: string;
  emailRecoveryModule: string;
  nonceAtCreation: number;
  guardianSetHash: string;
  policyHash: string;
  status: ChainRequestStatus;
  timelockEndsAt: string | null;
  executeTxHash: string | null;
  lastError: string | null;
};

export type ApprovalView = {
  id: string;
  groupId: string;
  guardianId: string | null;
  guardianEmailHash: string;
  maskedEmail: string | null;
  relayerRequestId: string | null;
  emailNullifier: string | null;
  status: ApprovalStatus;
  lastError: string | null;
};

export type ChainSubmissionView = {
  id: string;
  approvalId: string;
  chainRequestId: string;
  chainId: number;
  relayerRequestId: string | null;
  txHash: string | null;
  status: ChainSubmissionStatus;
  lastError: string | null;
};

export type CreateGroupParams = {
  userId: string;
  smartAccountAddress: Address;
  newPasskey: PasskeyInit;
  targetChainIds?: SupportedChainId[];
  deadlineSeconds?: number;
  relayerConfig?: Partial<ZkEmailRelayerConfig>;
};

export type CreateGroupResult = {
  groupId: string;
  multichainRecoveryDataHash: Hex;
  recoveryData: Hex;
  group: EmailRecoveryGroupView;
  chainRequests: ChainRequestView[];
  approvals: ApprovalView[];
};

const DEFAULT_DEADLINE_SECONDS = 7 * 24 * 60 * 60;
const RECOVERY_COMMAND_TEMPLATE = "Recover account {ethAddr} using recovery hash {recoveryHash}";
const DEFAULT_RECOVERY_TEMPLATE_IDX = 1;
const DEFAULT_ACCEPTANCE_TEMPLATE_IDX = 0;
const MOCK_RELAYER_URL = "mock://local";

const env = (name: string): string | undefined => {
  const vars = process.env as Record<string, string | undefined>;
  return vars[`EXPO_PUBLIC_${name}`] ?? vars[name];
};

const parseTemplateIdx = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseProofMode = (value: string | undefined): ZkEmailRelayerConfig["proofMode"] => {
  if (value === "reusable") return "reusable";
  if (value === "per_chain_hosted" || value === "per_chain") return "per_chain";
  return "per_chain";
};

const isTerminalSubmissionStatus = (status: string): boolean => (
  status === "proof_ready" || status === "submitted" || status === "confirmed" || status === "failed"
);

const isProofReadySubmissionStatus = (status: string): boolean => (
  status === "proof_ready" || status === "submitted" || status === "confirmed"
);

export class EmailRecoveryGroupService {
  private static supabase = getSupabaseClient();

  static createRelayer(config?: Partial<ZkEmailRelayerConfig>): ZkEmailRelayerAdapter {
    const resolved = this.resolveRelayerConfig(config);
    if (resolved.baseUrl.startsWith("mock://")) {
      return new MockZkEmailRelayer(resolved);
    }
    return new ZkEmailGenericRelayer(resolved);
  }

  static async createGroup(params: CreateGroupParams): Promise<CreateGroupResult> {
    const { userId, smartAccountAddress, newPasskey, deadlineSeconds } = params;
    const lowerAddress = smartAccountAddress.toLowerCase();

    const metadata = await EmailRecoveryService.loadMetadata({
      smartAccountAddress,
    });
    if (!metadata) {
      throw new Error("No email recovery config found. Install the email recovery module first.");
    }

    const installedChainIds = metadata.installations
      .filter((i) => i.installStatus === "installed")
      .map((i) => i.chainId as SupportedChainId);

    const targetChainIds = params.targetChainIds?.length
      ? params.targetChainIds!.filter((id) => installedChainIds.includes(id))
      : installedChainIds;

    if (targetChainIds.length === 0) {
      throw new Error("No chains with email recovery installed.");
    }

    const deadline = Math.floor(Date.now() / 1000) + (deadlineSeconds ?? DEFAULT_DEADLINE_SECONDS);

    const scopes: ChainRecoveryScope[] = [];
    for (const chainId of targetChainIds) {
      const deployment = getDeployment(chainId);
      if (!deployment?.emailRecovery) continue;

      const scope = await this.buildChainScope(
        smartAccountAddress,
        chainId,
        deployment.emailRecovery as Address,
      );
      scopes.push(scope);
    }

    if (scopes.length === 0) {
      throw new Error("Could not build chain scopes for any target chain.");
    }

    const sortedScopes = normalizeChainScopes(scopes);
    const newPasskeyHash = hashPasskeyInit(newPasskey);
    const chainScopeHash = hashChainScopes(sortedScopes);

    const requestId = `0x${"0".repeat(64)}` as Hex;
    const metadataHash = `0x${"0".repeat(64)}` as Hex;

    const intent: RecoveryIntent = {
      requestId,
      newPasskeyHash,
      chainScopeHash,
      validAfter: 0,
      deadline,
      metadataHash,
    };

    const intentHash = hashRecoveryIntent(intent);

    const emailRecoveryData: EmailRecoveryData = {
      version: 1,
      newPasskey,
      intent,
      scopes: sortedScopes,
    };

    const recoveryData = encodeEmailRecoveryData(emailRecoveryData);
    const multichainRecoveryDataHash = hashEmailRecoveryData(emailRecoveryData);

    const { data: group, error: groupError } = await this.supabase
      .from("email_recovery_groups")
      .insert({
        user_id: userId,
        config_id: metadata.config.id,
        smart_account_address: lowerAddress,
        chain_ids: sortedScopes.map((s) => Number(s.chainId)),
        chain_scope_hash: chainScopeHash,
        recovery_intent_hash: intentHash,
        multichain_recovery_data_hash: multichainRecoveryDataHash,
        new_passkey_hash: newPasskeyHash,
        new_passkey_id_raw_hash: newPasskey.idRaw,
        new_passkey_pubkey_x: newPasskey.px.toString(),
        new_passkey_pubkey_y: newPasskey.py.toString(),
        new_passkey_json: {
          idRaw: newPasskey.idRaw,
          px: newPasskey.px.toString(),
          py: newPasskey.py.toString(),
        },
        recovery_data: recoveryData,
        valid_after: null,
        deadline: new Date(deadline * 1000).toISOString(),
        status: "draft",
      })
      .select()
      .single();

    if (groupError) throw groupError;

    const chainRequestRows = sortedScopes.map((scope) => ({
      group_id: group.id,
      chain_id: Number(scope.chainId),
      smart_account_address: lowerAddress,
      email_recovery_module: scope.recoveryModule.toLowerCase(),
      nonce_at_creation: Number(scope.nonce),
      guardian_set_hash: scope.guardianSetHash,
      policy_hash: scope.policyHash,
      status: "pending" as const,
    }));

    const { data: insertedChainRequests, error: chainReqError } = await this.supabase
      .from("email_recovery_chain_requests")
      .insert(chainRequestRows)
      .select();

    if (chainReqError) throw chainReqError;

    const approvalRows = metadata.guardians.map((guardian) => ({
      group_id: group.id,
      guardian_id: null,
      guardian_email_hash: guardian.emailHash,
      masked_email: guardian.maskedEmail ?? null,
      status: "pending" as const,
    }));

    const { data: insertedApprovals, error: approvalError } = await this.supabase
      .from("email_recovery_approvals")
      .insert(approvalRows)
      .select();

    if (approvalError) throw approvalError;

    await this.supabase
      .from("email_recovery_groups")
      .update({ status: "collecting_approvals" })
      .eq("id", group.id);

    return {
      groupId: group.id,
      multichainRecoveryDataHash,
      recoveryData,
      group: this.mapGroupView(group),
      chainRequests: (insertedChainRequests ?? []).map(this.mapChainRequestView),
      approvals: (insertedApprovals ?? []).map(this.mapApprovalView),
    };
  }

  static async sendApprovals(
    groupId: string,
    relayer?: ZkEmailRelayerAdapter,
    relayerConfig?: Partial<ZkEmailRelayerConfig>,
  ): Promise<void> {
    const resolvedRelayerConfig = this.resolveRelayerConfig(relayerConfig);
    const adapter = relayer ?? this.createRelayer(resolvedRelayerConfig);

    const { data: group, error: groupError } = await this.supabase
      .from("email_recovery_groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupError) throw groupError;

    await this.supabase
      .from("email_recovery_groups")
      .update({ status: "sending_approvals" })
      .eq("id", groupId);

    const { data: approvals, error: approvalsError } = await this.supabase
      .from("email_recovery_approvals")
      .select("*")
      .eq("group_id", groupId);

    if (approvalsError) throw approvalsError;

    const { data: chainRequests, error: chainReqError } = await this.supabase
      .from("email_recovery_chain_requests")
      .select("*")
      .eq("group_id", groupId);

    if (chainReqError) throw chainReqError;

    const metadata = await EmailRecoveryService.loadMetadata({
      smartAccountAddress: group.smart_account_address as Address,
    });

    const command = RECOVERY_COMMAND_TEMPLATE
      .replace("{ethAddr}", group.smart_account_address)
      .replace("{recoveryHash}", group.multichain_recovery_data_hash);

    for (const approval of approvals ?? []) {
      if (approval.status !== "pending" && approval.status !== "failed") continue;

      const guardian = metadata?.guardians.find(
        (g) => g.emailHash === approval.guardian_email_hash,
      );
      const guardianEmail = resolvedRelayerConfig.baseUrl.startsWith("mock://")
        ? guardian?.resolvedEmail ?? guardian?.maskedEmail ?? ""
        : guardian?.resolvedEmail ?? "";
      if (!guardianEmail) {
        await this.supabase
          .from("email_recovery_approvals")
          .update({
            status: "failed",
            last_error: "Guardian email is locked. Export or unlock the recovery kit before using the real relayer.",
          })
          .eq("id", approval.id);
        continue;
      }

      try {
        const refs = await this.sendRelayerRequestsForApproval({
          adapter,
          proofMode: resolvedRelayerConfig.proofMode,
          recoveryTemplateIdx: resolvedRelayerConfig.recoveryTemplateIdx ?? DEFAULT_RECOVERY_TEMPLATE_IDX,
          group,
          approvalId: approval.id,
          chainRequests: chainRequests ?? [],
          guardianEmail,
          command,
        });

        await this.supabase
          .from("email_recovery_approvals")
          .update({
            relayer_request_id: refs[0]?.requestId ?? null,
            status: "email_sent",
            last_error: null,
          })
          .eq("id", approval.id);
      } catch (err) {
        await this.supabase
          .from("email_recovery_approvals")
          .update({
            status: "failed",
            last_error: err instanceof Error ? err.message : "Unknown error",
          })
          .eq("id", approval.id);
      }
    }

    await this.supabase
      .from("email_recovery_groups")
      .update({ status: "collecting_approvals" })
      .eq("id", groupId);
  }

  static async resendRecoveryRequest(
    groupId: string,
    approvalId: string,
    relayerConfig?: Partial<ZkEmailRelayerConfig>,
  ): Promise<void> {
    const resolvedRelayerConfig = this.resolveRelayerConfig(relayerConfig);
    const adapter = this.createRelayer(resolvedRelayerConfig);

    const { data: group, error: groupError } = await this.supabase
      .from("email_recovery_groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupError) throw groupError;

    const { data: approval, error: approvalError } = await this.supabase
      .from("email_recovery_approvals")
      .select("*")
      .eq("id", approvalId)
      .maybeSingle();

    if (approvalError) throw approvalError;
    if (!approval) throw new Error("Approval not found");

    const { data: chainRequests, error: chainReqError } = await this.supabase
      .from("email_recovery_chain_requests")
      .select("*")
      .eq("group_id", groupId);

    if (chainReqError) throw chainReqError;

    const metadata = await EmailRecoveryService.loadMetadata({
      smartAccountAddress: group.smart_account_address as Address,
    });

    const guardian = metadata?.guardians.find(
      (g) => g.emailHash === approval.guardian_email_hash,
    );
    const guardianEmail = resolvedRelayerConfig.baseUrl.startsWith("mock://")
      ? guardian?.resolvedEmail ?? guardian?.maskedEmail ?? ""
      : guardian?.resolvedEmail ?? "";

    if (!guardianEmail) {
      throw new Error("Guardian email is locked. Cannot resend.");
    }

    const command = RECOVERY_COMMAND_TEMPLATE
      .replace("{ethAddr}", group.smart_account_address)
      .replace("{recoveryHash}", group.multichain_recovery_data_hash);

    await this.sendRelayerRequestsForApproval({
      adapter,
      proofMode: resolvedRelayerConfig.proofMode,
      recoveryTemplateIdx: resolvedRelayerConfig.recoveryTemplateIdx ?? DEFAULT_RECOVERY_TEMPLATE_IDX,
      group,
      approvalId,
      chainRequests: chainRequests ?? [],
      guardianEmail,
      command,
    });

    await this.supabase
      .from("email_recovery_approvals")
      .update({ status: "email_sent", last_error: null })
      .eq("id", approvalId);
  }

  static async executeReadyChains(
    groupId: string,
    relayer?: ZkEmailRelayerAdapter,
    relayerConfig?: Partial<ZkEmailRelayerConfig>,
  ): Promise<void> {
    const adapter = relayer ?? this.createRelayer(relayerConfig);

    const { data: group, error: groupError } = await this.supabase
      .from("email_recovery_groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupError) throw groupError;

    const { data: chainRequests, error: chainReqError } = await this.supabase
      .from("email_recovery_chain_requests")
      .select("*")
      .eq("group_id", groupId)
      .eq("status", "ready_to_execute");

    if (chainReqError) throw chainReqError;
    if (!chainRequests?.length) return;

    const resolvedConfig = this.resolveRelayerConfig(relayerConfig);
    const isMock = resolvedConfig.baseUrl.startsWith("mock://");

    if (isMock) {
      for (const chainReq of chainRequests) {
        await this.supabase
          .from("email_recovery_chain_requests")
          .update({
            last_error: "On Anvil, run `make mock-vote-recovery-local` then `make mock-complete-email-recovery-local` to execute recovery. The mock relayer does not submit on-chain.",
            last_checked_at: new Date().toISOString(),
          })
          .eq("id", chainReq.id);
      }
      return;
    }

    await this.supabase
      .from("email_recovery_groups")
      .update({ status: "executing", last_error: null })
      .eq("id", groupId);

    for (const chainReq of chainRequests) {
      await this.supabase
        .from("email_recovery_chain_requests")
        .update({ status: "executing", last_error: null })
        .eq("id", chainReq.id);

      try {
        const result = await adapter.completeRecovery({
          chainId: Number(chainReq.chain_id),
          smartAccountAddress: group.smart_account_address as Address,
          recoveryData: group.recovery_data as Hex,
          emailRecoveryModuleAddress: chainReq.email_recovery_module as Address,
        });

        if (!result.success) {
          throw new Error(result.error ?? "Relayer did not complete recovery.");
        }

        const passkeyState = await getPasskeyOnchainState({
          chainId: Number(chainReq.chain_id) as SupportedChainId,
          smartAccountAddress: group.smart_account_address as Address,
          passkeyId: group.new_passkey_id_raw_hash as Hex,
        });

        if (!passkeyState.exists) {
          throw new Error("Recovery transaction submitted, but the new passkey is not visible on-chain yet.");
        }

        await this.supabase
          .from("email_recovery_chain_requests")
          .update({
            status: "executed",
            execute_tx_hash: result.txHash,
            last_checked_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", chainReq.id);
      } catch (err) {
        await this.supabase
          .from("email_recovery_chain_requests")
          .update({
            status: "failed",
            last_checked_at: new Date().toISOString(),
            last_error: err instanceof Error ? err.message : "Unknown recovery execution error",
          })
          .eq("id", chainReq.id);
      }
    }

    await this.updateGroupExecutionStatus(groupId);
  }

  static async refreshGroupStatus(groupId: string): Promise<{
    group: EmailRecoveryGroupView;
    chainRequests: ChainRequestView[];
    approvals: ApprovalView[];
    submissions: ChainSubmissionView[];
  }> {
    const { data: group, error: groupError } = await this.supabase
      .from("email_recovery_groups")
      .select("*")
      .eq("id", groupId)
      .single();

    if (groupError) throw groupError;

    const { data: chainRequests, error: crError } = await this.supabase
      .from("email_recovery_chain_requests")
      .select("*")
      .eq("group_id", groupId);

    if (crError) throw crError;

    const { data: approvals, error: appError } = await this.supabase
      .from("email_recovery_approvals")
      .select("*")
      .eq("group_id", groupId);

    if (appError) throw appError;

    const approvalIds = (approvals ?? []).map((a: { id: string }) => a.id);
    let submissions: any[] = [];
    if (approvalIds.length > 0) {
      const { data: subData } = await this.supabase
        .from("email_recovery_chain_approval_submissions")
        .select("*")
        .in("approval_id", approvalIds);
      submissions = subData ?? [];
    }

    const synced = await this.syncRelayerStatuses(approvals ?? [], submissions);
    const readinessChanged = await this.applyReadyChainStatuses(group, chainRequests ?? [], approvals ?? [], submissions);

    if (synced || readinessChanged) {
      return this.refreshGroupStatus(groupId);
    }

    return {
      group: this.mapGroupView(group),
      chainRequests: (chainRequests ?? []).map(this.mapChainRequestView),
      approvals: (approvals ?? []).map(this.mapApprovalView),
      submissions: submissions.map(this.mapChainSubmissionView),
    };
  }

  static async cancelGroup(groupId: string): Promise<void> {
    const { error } = await this.supabase
      .from("email_recovery_groups")
      .update({ status: "cancelled" })
      .eq("id", groupId)
      .in("status", ["draft", "collecting_approvals", "sending_approvals"]);

    if (error) throw error;
  }

  private static resolveRelayerConfig(config?: Partial<ZkEmailRelayerConfig>): ZkEmailRelayerConfig {
    return {
      baseUrl: config?.baseUrl ?? env("ZK_EMAIL_RELAYER_URL") ?? MOCK_RELAYER_URL,
      apiKey: config?.apiKey ?? env("ZK_EMAIL_RELAYER_API_KEY"),
      acceptanceTemplateIdx: config?.acceptanceTemplateIdx
        ?? parseTemplateIdx(env("ZK_EMAIL_ACCEPTANCE_TEMPLATE_IDX"), DEFAULT_ACCEPTANCE_TEMPLATE_IDX),
      recoveryTemplateIdx: config?.recoveryTemplateIdx
        ?? parseTemplateIdx(env("ZK_EMAIL_RECOVERY_TEMPLATE_IDX"), DEFAULT_RECOVERY_TEMPLATE_IDX),
      proofMode: config?.proofMode ?? parseProofMode(env("ZK_EMAIL_PROOF_MODE")),
    };
  }

  private static async sendRelayerRequestsForApproval(params: {
    adapter: ZkEmailRelayerAdapter;
    proofMode: ZkEmailRelayerConfig["proofMode"];
    recoveryTemplateIdx: number;
    group: Record<string, any>;
    approvalId: string;
    chainRequests: Record<string, any>[];
    guardianEmail: string;
    command: string;
  }) {
    if (params.proofMode === "reusable") {
      const ref = await params.adapter.sendRecoveryRequest({
        controllerEthAddr: params.group.smart_account_address as Address,
        guardianEmailAddr: params.guardianEmail,
        templateIdx: params.recoveryTemplateIdx,
        command: params.command,
      });

      for (const chainReq of params.chainRequests) {
        await this.upsertChainSubmission({
          approvalId: params.approvalId,
          chainReq,
          requestId: ref.requestId,
        });
      }

      return [ref];
    }

    const refs = [];
    for (const chainReq of params.chainRequests) {
      const ref = await params.adapter.sendRecoveryRequest({
        controllerEthAddr: params.group.smart_account_address as Address,
        guardianEmailAddr: params.guardianEmail,
        templateIdx: params.recoveryTemplateIdx,
        command: params.command,
        chainId: Number(chainReq.chain_id),
      });
      refs.push(ref);
      await this.upsertChainSubmission({
        approvalId: params.approvalId,
        chainReq,
        requestId: ref.requestId,
      });
    }
    return refs;
  }

  private static async upsertChainSubmission(params: {
    approvalId: string;
    chainReq: Record<string, any>;
    requestId: string;
  }): Promise<void> {
    await this.supabase
      .from("email_recovery_chain_approval_submissions")
      .upsert(
        {
          approval_id: params.approvalId,
          chain_request_id: params.chainReq.id,
          chain_id: params.chainReq.chain_id,
          relayer_request_id: params.requestId,
          status: "request_sent",
          last_error: null,
        },
        { onConflict: "approval_id,chain_request_id" },
      );
  }

  private static async syncRelayerStatuses(
    approvals: Record<string, any>[],
    submissions: Record<string, any>[],
  ): Promise<boolean> {
    const activeSubmissions = submissions.filter(
      (submission) => submission.relayer_request_id && !isTerminalSubmissionStatus(submission.status),
    );
    if (activeSubmissions.length === 0) return false;

    const adapter = this.createRelayer();
    const statuses = new Map<string, RelayerRequestStatus>();
    let changed = false;

    for (const submission of activeSubmissions) {
      const requestId = String(submission.relayer_request_id);
      if (!statuses.has(requestId)) {
        try {
          statuses.set(requestId, await adapter.getRequestStatus(requestId));
        } catch (err) {
          await this.supabase
            .from("email_recovery_chain_approval_submissions")
            .update({
              last_error: err instanceof Error ? err.message : "Failed to poll relayer status",
            })
            .eq("id", submission.id);
          changed = true;
          continue;
        }
      }
      const status = statuses.get(requestId)!;
      changed = await this.applyRelayerStatus({
        approvals,
        submission,
        status,
      }) || changed;
    }

    return changed;
  }

  private static async applyRelayerStatus(params: {
    approvals: Record<string, any>[];
    submission: Record<string, any>;
    status: RelayerRequestStatus;
  }): Promise<boolean> {
    const { approvals, submission, status } = params;
    const nextSubmissionStatus = this.submissionStatusFromRelayer(status);
    const serializedEmailAuthMsg = status.emailAuthMsg
      ? this.serializeEmailAuthMsg(status.emailAuthMsg)
      : null;
    const proofHash = serializedEmailAuthMsg
      ? keccak256(stringToHex(JSON.stringify(serializedEmailAuthMsg)))
      : null;

    let changed = false;
    if (nextSubmissionStatus && submission.status !== nextSubmissionStatus) {
      await this.supabase
        .from("email_recovery_chain_approval_submissions")
        .update({
          status: nextSubmissionStatus,
          email_auth_msg_json: serializedEmailAuthMsg,
          proof_hash: proofHash,
          last_error: status.error,
        })
        .eq("id", submission.id);
      changed = true;
    }

    const approval = approvals.find((item) => item.id === submission.approval_id);
    if (approval) {
      const nextApprovalStatus = this.approvalStatusFromRelayer(status);
      if (nextApprovalStatus && approval.status !== nextApprovalStatus) {
        await this.supabase
          .from("email_recovery_approvals")
          .update({
            status: nextApprovalStatus,
            email_nullifier: status.emailAuthMsg?.proof.emailNullifier ?? approval.email_nullifier,
            last_error: status.error,
          })
          .eq("id", approval.id);
        changed = true;
      }
    }

    return changed;
  }

  private static submissionStatusFromRelayer(status: RelayerRequestStatus): ChainSubmissionStatus | null {
    switch (status.status) {
      case "proof_generated":
        return "proof_ready";
      case "failed":
        return "failed";
      case "email_sent":
      case "email_received":
      case "pending":
        return "request_sent";
      default:
        return null;
    }
  }

  private static approvalStatusFromRelayer(status: RelayerRequestStatus): ApprovalStatus | null {
    switch (status.status) {
      case "proof_generated":
        return "proof_generated";
      case "email_received":
        return "guardian_replied";
      case "email_sent":
        return "email_sent";
      case "failed":
        return "failed";
      default:
        return null;
    }
  }

  private static async applyReadyChainStatuses(
    group: Record<string, any>,
    chainRequests: Record<string, any>[],
    approvals: Record<string, any>[],
    submissions: Record<string, any>[],
  ): Promise<boolean> {
    const metadata = await EmailRecoveryService.loadMetadata({
      smartAccountAddress: group.smart_account_address as Address,
    });
    const threshold = metadata?.config.threshold ?? approvals.length;
    if (threshold <= 0) return false;

    let changed = false;
    for (const chainReq of chainRequests) {
      if (!["pending", "proofs_pending", "proofs_submitted", "threshold_reached"].includes(chainReq.status)) {
        continue;
      }
      const readyCount = submissions.filter(
        (submission) => submission.chain_request_id === chainReq.id
          && isProofReadySubmissionStatus(submission.status),
      ).length;
      if (readyCount >= threshold) {
        await this.supabase
          .from("email_recovery_chain_requests")
          .update({ status: "ready_to_execute", last_error: null })
          .eq("id", chainReq.id);
        changed = true;
      }
    }

    if (changed && group.status !== "ready_to_execute") {
      await this.supabase
        .from("email_recovery_groups")
        .update({ status: "ready_to_execute", last_error: null })
        .eq("id", group.id);
    }

    return changed;
  }

  private static async updateGroupExecutionStatus(groupId: string): Promise<void> {
    const { data: chainRequests, error } = await this.supabase
      .from("email_recovery_chain_requests")
      .select("status")
      .eq("group_id", groupId);

    if (error) throw error;

    const requests = chainRequests ?? [];
    if (requests.length === 0) return;

    const executedCount = requests.filter((row) => row.status === "executed").length;
    const nextStatus = executedCount === requests.length
      ? "executed"
      : executedCount > 0
        ? "partially_executed"
        : requests.some((row) => row.status === "failed")
          ? "failed"
          : "ready_to_execute";

    await this.supabase
      .from("email_recovery_groups")
      .update({
        status: nextStatus,
        completed_at: nextStatus === "executed" ? new Date().toISOString() : null,
      })
      .eq("id", groupId);
  }

  private static serializeEmailAuthMsg(msg: EmailAuthMsgData): Record<string, unknown> {
    return {
      templateId: msg.templateId.toString(),
      commandParams: msg.commandParams,
      skippedCommandPrefix: msg.skippedCommandPrefix.toString(),
      proof: {
        domainName: msg.proof.domainName,
        publicKeyHash: msg.proof.publicKeyHash,
        timestamp: msg.proof.timestamp.toString(),
        maskedCommand: msg.proof.maskedCommand,
        emailNullifier: msg.proof.emailNullifier,
        accountSalt: msg.proof.accountSalt,
        isCodeExist: msg.proof.isCodeExist,
        proof: msg.proof.proof,
      },
    };
  }

  private static async buildChainScope(
    smartAccountAddress: Address,
    chainId: SupportedChainId,
    emailRecoveryModule: Address,
  ): Promise<ChainRecoveryScope> {
    const publicClient = getPublicClient(chainId);
    const deployment = getDeployment(chainId);
    if (!deployment) throw new Error(`No deployment for chain ${chainId}`);

    let nonce = 0n;
    let guardianSetHash = `0x${"0".repeat(64)}` as Hex;
    let policyHash = `0x${"0".repeat(64)}` as Hex;

    try {
      nonce = (await publicClient.readContract({
        address: emailRecoveryModule,
        abi: [
          {
            name: "getRecoveryNonce",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "uint256" }],
          },
        ],
        functionName: "getRecoveryNonce",
        args: [smartAccountAddress],
      })) as bigint;
    } catch {
      nonce = 0n;
    }

    try {
      guardianSetHash = (await publicClient.readContract({
        address: emailRecoveryModule,
        abi: [
          {
            name: "getGuardianSetHash",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "bytes32" }],
          },
        ],
        functionName: "getGuardianSetHash",
        args: [smartAccountAddress],
      })) as Hex;
    } catch {
      guardianSetHash = `0x${"0".repeat(64)}` as Hex;
    }

    try {
      policyHash = (await publicClient.readContract({
        address: emailRecoveryModule,
        abi: [
          {
            name: "getPolicyHash",
            type: "function",
            stateMutability: "view",
            inputs: [{ name: "account", type: "address" }],
            outputs: [{ name: "", type: "bytes32" }],
          },
        ],
        functionName: "getPolicyHash",
        args: [smartAccountAddress],
      })) as Hex;
    } catch {
      policyHash = `0x${"0".repeat(64)}` as Hex;
    }

    return {
      chainId,
      wallet: smartAccountAddress,
      recoveryModule: emailRecoveryModule,
      nonce,
      guardianSetHash,
      policyHash,
    };
  }

  private static mapGroupView(row: Record<string, any>): EmailRecoveryGroupView {
    return {
      id: row.id,
      userId: row.user_id,
      configId: row.config_id,
      smartAccountAddress: row.smart_account_address,
      chainIds: row.chain_ids ?? [],
      chainScopeHash: row.chain_scope_hash,
      recoveryIntentHash: row.recovery_intent_hash,
      multichainRecoveryDataHash: row.multichain_recovery_data_hash,
      newPasskeyHash: row.new_passkey_hash,
      newPasskeyIdRawHash: row.new_passkey_id_raw_hash,
      deadline: row.deadline,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastError: row.last_error,
    };
  }

  private static mapChainRequestView(row: Record<string, any>): ChainRequestView {
    return {
      id: row.id,
      groupId: row.group_id,
      chainId: row.chain_id,
      smartAccountAddress: row.smart_account_address,
      emailRecoveryModule: row.email_recovery_module,
      nonceAtCreation: row.nonce_at_creation,
      guardianSetHash: row.guardian_set_hash,
      policyHash: row.policy_hash,
      status: row.status,
      timelockEndsAt: row.timelock_ends_at,
      executeTxHash: row.execute_tx_hash,
      lastError: row.last_error,
    };
  }

  private static mapApprovalView(row: Record<string, any>): ApprovalView {
    return {
      id: row.id,
      groupId: row.group_id,
      guardianId: row.guardian_id,
      guardianEmailHash: row.guardian_email_hash,
      maskedEmail: row.masked_email,
      relayerRequestId: row.relayer_request_id,
      emailNullifier: row.email_nullifier,
      status: row.status,
      lastError: row.last_error,
    };
  }

  private static mapChainSubmissionView(row: Record<string, any>): ChainSubmissionView {
    return {
      id: row.id,
      approvalId: row.approval_id,
      chainRequestId: row.chain_request_id,
      chainId: row.chain_id,
      relayerRequestId: row.relayer_request_id,
      txHash: row.tx_hash,
      status: row.status,
      lastError: row.last_error,
    };
  }
}
