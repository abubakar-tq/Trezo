import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
  type Hex,
} from "npm:viem@2.41.2";
import { privateKeyToAccount } from "npm:viem@2.41.2/accounts";

type RecoveryAction = "schedule" | "execute";
type SigKind = "EOA_ECDSA" | "ERC1271" | "APPROVE_HASH";

type RecoveryOperationRequest = {
  requestId: string;
  chainId: number;
  action: RecoveryAction;
  rpcUrl: string;
};

type RecoveryRequestStatus =
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

type RecoveryChainStatus =
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

type RecoveryRequestRow = {
  id: string;
  wallet_address: string;
  threshold: number;
  status: RecoveryRequestStatus;
  deadline: string;
  recovery_intent_json: {
    requestId: string;
    newPasskeyHash: string;
    chainScopeHash: string;
    validAfter: string | number;
    deadline: string | number;
    metadataHash: string;
  };
  chain_scopes_json: Array<{
    chainId: number;
    wallet: string;
    socialRecovery: string;
    nonce: string | number;
    guardianSetHash: string;
    policyHash: string;
  }>;
  new_passkey_json: {
    idRaw: string;
    px: string;
    py: string;
  };
};

type RecoveryApprovalRow = {
  guardian_index: number;
  sig_kind: SigKind;
  signature: string;
};

type RecoveryChainStatusRow = {
  id: string;
  request_id: string;
  chain_id: number;
  status: RecoveryChainStatus;
  schedule_tx_hash: string | null;
  execute_tx_hash: string | null;
  recovery_id_onchain: string | null;
  execute_after: string | null;
};

const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

const SCHEDULE_ABI = parseAbi([
  "function scheduleRecovery(address wallet, (bytes32 idRaw,uint256 px,uint256 py) newPassKey, (bytes32 requestId,bytes32 newPasskeyHash,bytes32 chainScopeHash,uint48 validAfter,uint48 deadline,bytes32 metadataHash) intent, (uint256 chainId,address wallet,address socialRecovery,uint256 nonce,bytes32 guardianSetHash,bytes32 policyHash)[] scopes, (uint16 index,uint8 kind,bytes sig)[] sigs) returns (bytes32 recoveryId)",
] as const);

const EXECUTE_ABI = parseAbi([
  "function executeRecovery(address wallet)",
] as const);

const STATUS_ABI = parseAbi([
  "function getActiveRecovery(address wallet) view returns (bytes32 recoveryId, uint256 executeAfter)",
] as const);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });

const isHex = (value: string) => /^0x([0-9a-fA-F]{2})*$/.test(value);
const normalizeHex = (value: string): Hex => {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed.toLowerCase() as Hex;
};

const asHex = (value: string, field: string): Hex => {
  const normalized = normalizeHex(value);
  if (!isHex(normalized)) {
    throw new Error(`Invalid hex for ${field}.`);
  }
  return normalized;
};

const asBytes32 = (value: string, field: string): Hex => {
  const normalized = asHex(value, field);
  if (normalized.length !== 66) {
    throw new Error(`${field} must be bytes32.`);
  }
  return normalized;
};

const asAddress = (value: string, field: string): Address => {
  const normalized = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(normalized)) {
    throw new Error(`Invalid address for ${field}.`);
  }
  return normalized as Address;
};

const asBigInt = (value: string | number, field: string): bigint => {
  try {
    return BigInt(value);
  } catch {
    throw new Error(`Invalid integer for ${field}.`);
  }
};

const getSupabaseAdmin = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service credentials are missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

const getRelayerAccount = () => {
  const privateKey = Deno.env.get("RECOVERY_RELAYER_PRIVATE_KEY") as Hex | undefined;
  if (!privateKey) {
    throw new Error("RECOVERY_RELAYER_PRIVATE_KEY is missing.");
  }
  return privateKeyToAccount(privateKey);
};

const toChain = (chainId: number, rpcUrl: string) =>
  defineChain({
    id: chainId,
    name: `Recovery Chain ${chainId}`,
    nativeCurrency: {
      name: "Native",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  });

const normalizeSigKind = (sigKind: SigKind): number => {
  switch (sigKind) {
    case "EOA_ECDSA":
      return 0;
    case "ERC1271":
      return 1;
    case "APPROVE_HASH":
      return 2;
  }
};

const localHostAliases = new Set(["localhost", "127.0.0.1", "0.0.0.0", "10.0.2.2"]);

const resolveRpcUrl = (chainId: number, suppliedRpcUrl: string): string => {
  const chainSpecificEnv = Deno.env.get(`RECOVERY_RPC_URL_${chainId}`);
  const defaultEnv = Deno.env.get("RECOVERY_RPC_URL");
  const selected = (chainSpecificEnv ?? defaultEnv ?? suppliedRpcUrl ?? "").trim();

  if (!selected) {
    throw new Error(
      `RPC URL is missing for chain ${chainId}. Set RECOVERY_RPC_URL_${chainId} or provide a request rpcUrl.`,
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(selected);
  } catch {
    throw new Error(`RPC URL for chain ${chainId} is invalid: ${selected}`);
  }

  if (localHostAliases.has(parsed.hostname)) {
    const localAlias = Deno.env.get("RECOVERY_LOCALHOST_ALIAS") ?? "host.docker.internal";
    parsed.hostname = localAlias;
  }

  return parsed.toString();
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const firstLine = error.message.split("\n")[0]?.trim();
    if (firstLine) return firstLine;
  }
  return "Unknown recovery submission error";
};

const deriveRequestStatus = (
  allChainStatuses: RecoveryChainStatus[],
  fallback: RecoveryRequestStatus,
): RecoveryRequestStatus => {
  if (allChainStatuses.length === 0) return fallback;

  if (allChainStatuses.every((status) => status === "executed")) {
    return "executed";
  }

  if (allChainStatuses.some((status) => status === "executed")) {
    return "partially_executed";
  }

  if (allChainStatuses.every((status) => status === "failed" || status === "cancelled")) {
    return "failed";
  }

  if (allChainStatuses.some((status) => status === "ready_to_execute")) {
    return "ready_to_execute";
  }

  if (
    allChainStatuses.some(
      (status) =>
        status === "scheduled" || status === "timelock_pending" || status === "ready_to_execute",
    )
  ) {
    return "scheduled";
  }

  if (allChainStatuses.some((status) => status === "scheduling")) {
    return "scheduling";
  }

  if (allChainStatuses.some((status) => status === "executing")) {
    return "executing";
  }

  return fallback;
};

const activeRecoveryToStatus = (executeAfter: bigint): RecoveryChainStatus => {
  const now = BigInt(Math.floor(Date.now() / 1000));
  return executeAfter <= now ? "ready_to_execute" : "timelock_pending";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let body: RecoveryOperationRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.requestId || !body.chainId || !body.action) {
    return json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const relayer = getRelayerAccount();
    const rpcUrl = resolveRpcUrl(body.chainId, body.rpcUrl);

    const { data: request, error: requestError } = await supabase
      .from("recovery_requests")
      .select("id, wallet_address, threshold, status, deadline, recovery_intent_json, chain_scopes_json, new_passkey_json")
      .eq("id", body.requestId)
      .single();

    if (requestError) {
      return json({ error: requestError.message }, { status: 500 });
    }

    const recoveryRequest = request as RecoveryRequestRow;
    if (new Date(recoveryRequest.deadline).getTime() < Date.now()) {
      return json({ error: "Recovery request has expired." }, { status: 409 });
    }

    const scope = recoveryRequest.chain_scopes_json.find(
      (candidate) => Number(candidate.chainId) === Number(body.chainId),
    );
    if (!scope) {
      return json({ error: "Requested chain is not present in the recovery scope." }, { status: 400 });
    }

    const chain = toChain(body.chainId, rpcUrl);
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account: relayer, chain, transport: http(rpcUrl) });

    const moduleAddress = asAddress(scope.socialRecovery, "scope.socialRecovery");
    const walletAddress = asAddress(recoveryRequest.wallet_address, "wallet_address");

    const { data: existingChainStatus } = await supabase
      .from("recovery_chain_statuses")
      .select("*")
      .eq("request_id", body.requestId)
      .eq("chain_id", body.chainId)
      .maybeSingle();

    const chainStatusRow = existingChainStatus as RecoveryChainStatusRow | null;

    if (body.action === "schedule") {
      const activeBefore = (await publicClient.readContract({
        address: moduleAddress,
        abi: STATUS_ABI,
        functionName: "getActiveRecovery",
        args: [walletAddress],
      })) as [Hex, bigint];

      if (activeBefore[0] !== ZERO_BYTES32) {
        const executeAfterIso = new Date(Number(activeBefore[1]) * 1000).toISOString();
        const nextStatus = activeRecoveryToStatus(activeBefore[1]);

        const { data: alreadyScheduledRow, error: alreadyScheduledError } = await supabase
          .from("recovery_chain_statuses")
          .upsert(
            {
              request_id: body.requestId,
              chain_id: body.chainId,
              status: nextStatus,
              schedule_tx_hash: chainStatusRow?.schedule_tx_hash ?? null,
              execute_tx_hash: chainStatusRow?.execute_tx_hash ?? null,
              recovery_id_onchain: activeBefore[0],
              execute_after: executeAfterIso,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "request_id,chain_id" },
          )
          .select("*")
          .single();

        if (alreadyScheduledError) {
          return json({ error: alreadyScheduledError.message }, { status: 500 });
        }

        const { data: allStatuses } = await supabase
          .from("recovery_chain_statuses")
          .select("status")
          .eq("request_id", body.requestId);
        const nextRequestStatus = deriveRequestStatus(
          (allStatuses ?? []).map((item) => item.status as RecoveryChainStatus),
          recoveryRequest.status,
        );

        await supabase
          .from("recovery_requests")
          .update({ status: nextRequestStatus, updated_at: new Date().toISOString() })
          .eq("id", body.requestId);

        return json({
          success: true,
          txHash: chainStatusRow?.schedule_tx_hash ?? "0x",
          chainStatus: alreadyScheduledRow,
          requestStatus: nextRequestStatus,
          alreadyScheduled: true,
        });
      }
    }

    await supabase
      .from("recovery_requests")
      .update({
        status: body.action === "schedule" ? "scheduling" : "executing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.requestId);

    let txHash: Hex;
    let nextChainStatus: RecoveryChainStatus;
    let executeAfter: string | null = null;
    let recoveryIdOnchain: string | null = null;

    if (body.action === "schedule") {
      const { data: approvals, error: approvalsError } = await supabase
        .from("recovery_approvals")
        .select("guardian_index, sig_kind, signature")
        .eq("request_id", body.requestId)
        .eq("verification_status", "valid")
        .order("guardian_index", { ascending: true });

      if (approvalsError) {
        return json({ error: approvalsError.message }, { status: 500 });
      }

      const validApprovals = (approvals ?? []) as RecoveryApprovalRow[];
      if (validApprovals.length < Number(recoveryRequest.threshold)) {
        return json({ error: "Approval threshold has not been reached." }, { status: 409 });
      }

      const seenGuardianIndexes = new Set<number>();
      for (const approval of validApprovals) {
        if (seenGuardianIndexes.has(approval.guardian_index)) {
          return json(
            { error: `Duplicate guardian index ${approval.guardian_index} in approval set.` },
            { status: 409 },
          );
        }
        seenGuardianIndexes.add(approval.guardian_index);
      }

      const sortedScopes = [...recoveryRequest.chain_scopes_json]
        .sort((a, b) => Number(a.chainId) - Number(b.chainId))
        .map((candidate) => ({
          chainId: asBigInt(candidate.chainId, "chainScope.chainId"),
          wallet: asAddress(candidate.wallet, "chainScope.wallet"),
          socialRecovery: asAddress(candidate.socialRecovery, "chainScope.socialRecovery"),
          nonce: asBigInt(candidate.nonce, "chainScope.nonce"),
          guardianSetHash: asBytes32(candidate.guardianSetHash, "chainScope.guardianSetHash"),
          policyHash: asBytes32(candidate.policyHash, "chainScope.policyHash"),
        }));

      const scheduleData = encodeFunctionData({
        abi: SCHEDULE_ABI,
        functionName: "scheduleRecovery",
        args: [
          walletAddress,
          {
            idRaw: asBytes32(recoveryRequest.new_passkey_json.idRaw, "newPasskey.idRaw"),
            px: asBigInt(recoveryRequest.new_passkey_json.px, "newPasskey.px"),
            py: asBigInt(recoveryRequest.new_passkey_json.py, "newPasskey.py"),
          },
          {
            requestId: asBytes32(recoveryRequest.recovery_intent_json.requestId, "intent.requestId"),
            newPasskeyHash: asBytes32(recoveryRequest.recovery_intent_json.newPasskeyHash, "intent.newPasskeyHash"),
            chainScopeHash: asBytes32(recoveryRequest.recovery_intent_json.chainScopeHash, "intent.chainScopeHash"),
            validAfter: Number(asBigInt(recoveryRequest.recovery_intent_json.validAfter, "intent.validAfter")),
            deadline: Number(asBigInt(recoveryRequest.recovery_intent_json.deadline, "intent.deadline")),
            metadataHash: asBytes32(recoveryRequest.recovery_intent_json.metadataHash, "intent.metadataHash"),
          },
          sortedScopes,
          validApprovals.map((approval) => ({
            index: approval.guardian_index,
            kind: normalizeSigKind(approval.sig_kind),
            sig: asHex(approval.signature || "0x", "approval.signature"),
          })),
        ],
      });

      await publicClient.call({
        account: relayer.address,
        to: moduleAddress,
        data: scheduleData,
      });

      txHash = await walletClient.sendTransaction({
        to: moduleAddress,
        data: scheduleData,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const activeAfter = (await publicClient.readContract({
        address: moduleAddress,
        abi: STATUS_ABI,
        functionName: "getActiveRecovery",
        args: [walletAddress],
      })) as [Hex, bigint];

      if (activeAfter[0] === ZERO_BYTES32) {
        throw new Error("scheduleRecovery transaction succeeded, but no active recovery was found on-chain.");
      }

      recoveryIdOnchain = activeAfter[0];
      executeAfter = new Date(Number(activeAfter[1]) * 1000).toISOString();
      nextChainStatus = activeRecoveryToStatus(activeAfter[1]);
    } else {
      const executeData = encodeFunctionData({
        abi: EXECUTE_ABI,
        functionName: "executeRecovery",
        args: [walletAddress],
      });

      await publicClient.call({
        account: relayer.address,
        to: moduleAddress,
        data: executeData,
      });

      txHash = await walletClient.sendTransaction({
        to: moduleAddress,
        data: executeData,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      nextChainStatus = "executed";
      recoveryIdOnchain = chainStatusRow?.recovery_id_onchain ?? null;
      executeAfter = chainStatusRow?.execute_after ?? null;
    }

    const { data: updatedChainStatus, error: chainStatusError } = await supabase
      .from("recovery_chain_statuses")
      .upsert(
        {
          request_id: body.requestId,
          chain_id: body.chainId,
          status: nextChainStatus,
          schedule_tx_hash:
            body.action === "schedule" ? txHash : chainStatusRow?.schedule_tx_hash ?? null,
          execute_tx_hash:
            body.action === "execute" ? txHash : chainStatusRow?.execute_tx_hash ?? null,
          recovery_id_onchain: recoveryIdOnchain,
          execute_after: executeAfter,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "request_id,chain_id" },
      )
      .select("*")
      .single();

    if (chainStatusError) {
      return json({ error: chainStatusError.message }, { status: 500 });
    }

    const { data: allStatuses, error: allStatusesError } = await supabase
      .from("recovery_chain_statuses")
      .select("status")
      .eq("request_id", body.requestId);

    if (allStatusesError) {
      return json({ error: allStatusesError.message }, { status: 500 });
    }

    const nextRequestStatus = deriveRequestStatus(
      (allStatuses ?? []).map((item) => item.status as RecoveryChainStatus),
      recoveryRequest.status,
    );

    const { error: requestUpdateError } = await supabase
      .from("recovery_requests")
      .update({ status: nextRequestStatus, updated_at: new Date().toISOString() })
      .eq("id", body.requestId);

    if (requestUpdateError) {
      return json({ error: requestUpdateError.message }, { status: 500 });
    }

    return json({
      success: true,
      txHash,
      chainStatus: updatedChainStatus,
      requestStatus: nextRequestStatus,
    });
  } catch (error) {
    return json({ error: extractErrorMessage(error) }, { status: 500 });
  }
});
