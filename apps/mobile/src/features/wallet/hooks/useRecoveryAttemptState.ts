import { useCallback, useEffect, useRef, useState } from "react";
import { type Address, type Hex, parseAbi } from "viem";

import { getSupabaseClient } from "@lib/supabase";
import { type SupportedChainId } from "@/src/integration/chains";
import { getDeployment } from "@/src/integration/viem/deployments";
import { getPublicClient } from "@/src/integration/viem/clients";
import { ABIS } from "@/src/integration/viem/abis";
import { EmailRecoveryGroupService } from "@/src/features/wallet/services/EmailRecoveryGroupService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProveEmailStatus = {
  guardianEmailHash: string;
  maskedEmail: string | null;
  relayerRequestId: string | null;
  // Mirrors RelayerProofStatus from ZkEmailRelayerAdapter
  proofStatus: "pending" | "email_sent" | "email_received" | "proof_generated" | "failed";
  error: string | null;
};

// See CONTEXT.md "Recovery Attempt — source of truth split" and ADR-0009.
export type RecoveryAttemptState =
  | { phase: "idle"; lastSeenPasskeyCount: bigint }
  | { phase: "awaiting-vote"; chainId: SupportedChainId; relayerStatuses: ProveEmailStatus[] }
  | { phase: "vote-landed-pre-execute"; chainId: SupportedChainId; executeAfter: number; executeBefore: number }
  | { phase: "executable"; chainId: SupportedChainId; executeAfter: number; executeBefore: number; recoveryDataHash: Hex }
  | { phase: "executing"; chainId: SupportedChainId; txHash?: Hex }
  | { phase: "executed"; chainId: SupportedChainId; newPasskeyId: Hex; passkeyCount: bigint }
  | { phase: "expired"; chainId: SupportedChainId; executeBefore: number }
  | { phase: "error"; reason: string };

// ─── Polling intervals (ADR-0009 "RPC budget") ───────────────────────────────

const INTERVAL_AWAITING_VOTE_CHAIN_MS = 60_000;
const INTERVAL_AWAITING_VOTE_RELAYER_MS = 8_000;
const INTERVAL_VOTE_LANDED_MS = 5_000;
const INTERVAL_EXECUTING_MS = 3_000;
const INTERVAL_IDLE_MS = 60_000;
const IDLE_BACKOFF_AFTER_MS = 5 * 60_000;  // slow down after 5 min idle
const PAUSE_AFTER_MS = 15 * 60_000;         // pause entirely after 15 min

const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

// ─── ABI fragments ────────────────────────────────────────────────────────────

const PASSKEY_VALIDATOR_ABI = parseAbi([
  "function passkeyCount(address account) view returns (uint256)",
]);

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useRecoveryAttemptState(params: {
  smartAccountAddress: Address;
  chainId: SupportedChainId;
  attemptId?: string;
}): {
  state: RecoveryAttemptState;
  triggerExecute: () => Promise<void>;
  triggerCancelExpired: () => Promise<void>;
  refetch: () => Promise<void>;
} {
  const { smartAccountAddress, chainId, attemptId } = params;
  const [state, setState] = useState<RecoveryAttemptState>({ phase: "idle", lastSeenPasskeyCount: 0n });

  // Pre-execution passkey count baseline — captured once on mount.
  // See ADR-0009: used to detect completion during the completeRecovery race window.
  const baselinePasskeyCountRef = useRef<bigint | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const deployment = getDeployment(chainId);
  const emailRecoveryAddress = deployment?.emailRecovery as Address | undefined;
  const passkeyValidatorAddress = deployment?.passkeyValidator as Address | undefined;

  // ─── Chain read (one Multicall3 round-trip) ──────────────────────────────

  const readChainState = useCallback(async () => {
    if (!emailRecoveryAddress || !passkeyValidatorAddress) {
      return null;
    }
    const publicClient = getPublicClient(chainId);
    const results = await publicClient.multicall({
      contracts: [
        {
          address: emailRecoveryAddress,
          abi: ABIS.emailRecovery,
          functionName: "getRecoveryRequest",
          args: [smartAccountAddress],
        },
        {
          address: emailRecoveryAddress,
          abi: ABIS.emailRecovery,
          functionName: "getGuardianConfig",
          args: [smartAccountAddress],
        },
        {
          address: passkeyValidatorAddress,
          abi: PASSKEY_VALIDATOR_ABI,
          functionName: "passkeyCount",
          args: [smartAccountAddress],
        },
      ],
      multicallAddress: MULTICALL3_ADDRESS,
    });

    if (results[0].status === "failure" || results[2].status === "failure") {
      return null;
    }

    const [executeAfter, executeBefore, , recoveryDataHash] =
      results[0].result as [bigint, bigint, bigint, Hex];
    const passkeyCount = results[2].result as bigint;

    return { executeAfter, executeBefore, recoveryDataHash, passkeyCount };
  }, [chainId, smartAccountAddress, emailRecoveryAddress, passkeyValidatorAddress]);

  // ─── Relayer status read (prove.email polling, only while awaiting vote) ──

  const readRelayerStatuses = useCallback(async (): Promise<ProveEmailStatus[]> => {
    if (!attemptId) return [];
    const supabase = getSupabaseClient();
    const { data: approvals } = await supabase
      .from("email_recovery_approvals")
      .select("id, guardian_email_hash, masked_email, relayer_request_id")
      .eq("group_id", attemptId);

    if (!approvals?.length) return [];

    const adapter = EmailRecoveryGroupService.createRelayer();
    return Promise.all(
      approvals.map(async (a) => {
        if (!a.relayer_request_id) {
          return {
            guardianEmailHash: a.guardian_email_hash,
            maskedEmail: a.masked_email ?? null,
            relayerRequestId: null,
            proofStatus: "pending" as const,
            error: null,
          };
        }
        try {
          const status = await adapter.getRequestStatus(a.relayer_request_id);
          return {
            guardianEmailHash: a.guardian_email_hash,
            maskedEmail: a.masked_email ?? null,
            relayerRequestId: a.relayer_request_id,
            proofStatus: status.status,
            error: status.error,
          };
        } catch (err) {
          return {
            guardianEmailHash: a.guardian_email_hash,
            maskedEmail: a.masked_email ?? null,
            relayerRequestId: a.relayer_request_id,
            proofStatus: "failed" as const,
            error: err instanceof Error ? err.message : "Failed to fetch status",
          };
        }
      }),
    );
  }, [attemptId]);

  // ─── Derive phase from chain state ───────────────────────────────────────

  const derivePhase = useCallback(
    (
      chain: Awaited<ReturnType<typeof readChainState>>,
      relayerStatuses: ProveEmailStatus[],
    ): RecoveryAttemptState => {
      if (!chain) return { phase: "error", reason: "Chain read failed" };

      const { executeAfter, executeBefore, recoveryDataHash, passkeyCount } = chain;
      const nowSec = Math.floor(Date.now() / 1000);
      const baseline = baselinePasskeyCountRef.current;

      // Completed: slot cleared AND passkeyCount increased from baseline.
      // See ADR-0009 reconciliation rule.
      if (executeBefore === 0n && baseline !== null && passkeyCount > baseline) {
        const supabase = getSupabaseClient();
        if (attemptId) {
          void supabase
            .from("email_recovery_groups")
            .update({ executed_at: new Date().toISOString() })
            .eq("id", attemptId)
            .is("executed_at", null);
        }
        return {
          phase: "executed",
          chainId,
          newPasskeyId: "0x" as Hex, // caller reads from Supabase new_passkey_id_raw_hash
          passkeyCount,
        };
      }

      // No active request on-chain
      if (executeBefore === 0n) {
        return { phase: "idle", lastSeenPasskeyCount: passkeyCount };
      }

      // Expired
      if (executeBefore <= BigInt(nowSec)) {
        return { phase: "expired", chainId, executeBefore: Number(executeBefore) };
      }

      // Executable: delay elapsed, window still open
      if (executeAfter <= BigInt(nowSec)) {
        return {
          phase: "executable",
          chainId,
          executeAfter: Number(executeAfter),
          executeBefore: Number(executeBefore),
          recoveryDataHash,
        };
      }

      // Vote landed but delay not yet elapsed
      if (executeAfter > 0n) {
        return {
          phase: "vote-landed-pre-execute",
          chainId,
          executeAfter: Number(executeAfter),
          executeBefore: Number(executeBefore),
        };
      }

      // Active request but no vote yet → awaiting guardian replies
      return { phase: "awaiting-vote", chainId, relayerStatuses };
    },
    [chainId, attemptId],
  );

  // ─── Polling interval for current phase ──────────────────────────────────

  const intervalForPhase = useCallback(
    (s: RecoveryAttemptState, anyProofGenerated: boolean): number => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs > PAUSE_AFTER_MS) return -1; // pause
      if (idleMs > IDLE_BACKOFF_AFTER_MS) return INTERVAL_IDLE_MS;

      switch (s.phase) {
        case "awaiting-vote":
          // Tighten chain poll once a proof is generated (vote about to land)
          return anyProofGenerated ? INTERVAL_VOTE_LANDED_MS : INTERVAL_AWAITING_VOTE_CHAIN_MS;
        case "vote-landed-pre-execute":
          return INTERVAL_VOTE_LANDED_MS;
        case "executable":
          return INTERVAL_VOTE_LANDED_MS;
        case "executing":
          return INTERVAL_EXECUTING_MS;
        default:
          return INTERVAL_IDLE_MS;
      }
    },
    [],
  );

  // ─── Main tick ───────────────────────────────────────────────────────────

  const tick = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      const [chain, relayerStatuses] = await Promise.all([
        readChainState(),
        state.phase === "awaiting-vote" || state.phase === "idle"
          ? readRelayerStatuses()
          : Promise.resolve([] as ProveEmailStatus[]),
      ]);

      if (!mountedRef.current) return;

      const nextState = derivePhase(chain, relayerStatuses);
      setState(nextState);

      const anyProofGenerated = relayerStatuses.some((r) => r.proofStatus === "proof_generated");
      const intervalMs = intervalForPhase(nextState, anyProofGenerated);
      if (intervalMs < 0) return; // paused

      timerRef.current = setTimeout(() => void tick(), intervalMs);
    } catch (err) {
      if (!mountedRef.current) return;
      setState({ phase: "error", reason: err instanceof Error ? err.message : "Unknown error" });
      timerRef.current = setTimeout(() => void tick(), INTERVAL_IDLE_MS);
    }
  }, [readChainState, readRelayerStatuses, derivePhase, intervalForPhase, state.phase]);

  // ─── Mount / cleanup ─────────────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    lastActivityRef.current = Date.now();

    // Capture passkey count baseline before any Attempt activity.
    // See ADR-0009: needed to disambiguate the post-completeRecovery race window.
    const init = async () => {
      if (!passkeyValidatorAddress) return;
      const publicClient = getPublicClient(chainId);
      try {
        const count = await publicClient.readContract({
          address: passkeyValidatorAddress,
          abi: PASSKEY_VALIDATOR_ABI,
          functionName: "passkeyCount",
          args: [smartAccountAddress],
        }) as bigint;
        baselinePasskeyCountRef.current = count;
      } catch {
        baselinePasskeyCountRef.current = 0n;
      }
      void tick();
    };

    void init();

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, smartAccountAddress, attemptId]);

  // ─── Actions ─────────────────────────────────────────────────────────────

  const triggerExecute = useCallback(async () => {
    if (!attemptId) throw new Error("No attemptId — cannot execute");
    const supabase = getSupabaseClient();
    const { data: group } = await supabase
      .from("email_recovery_groups")
      .select("recovery_data, email_recovery_chain_requests(email_recovery_module)")
      .eq("id", attemptId)
      .single();
    if (!group) throw new Error("Recovery Attempt not found in Supabase");

    const chainReq = (group.email_recovery_chain_requests as any[])?.find(
      (r: any) => r.chain_id === chainId || !r.chain_id,
    );
    const emailRecoveryModuleAddress = (chainReq?.email_recovery_module ??
      emailRecoveryAddress) as Address;

    setState((prev) => ({ ...prev, phase: "executing" } as RecoveryAttemptState));

    const adapter = EmailRecoveryGroupService.createRelayer();
    const result = await adapter.completeRecovery({
      chainId,
      smartAccountAddress,
      recoveryData: group.recovery_data as Hex,
      emailRecoveryModuleAddress,
    });

    if (!result.success) throw new Error(result.error ?? "completeRecovery failed");
    if (result.txHash) setState((prev) => ({ ...prev, phase: "executing", txHash: result.txHash! } as RecoveryAttemptState));

    lastActivityRef.current = Date.now();
    void tick();
  }, [attemptId, chainId, smartAccountAddress, emailRecoveryAddress, tick]);

  const triggerCancelExpired = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke("submit-recovery-operation", {
      body: {
        action: "cancel-expired-email-recovery",
        smartAccountAddress,
        chainId,
      },
    });
    if (error) throw error;
    if (attemptId) {
      await supabase
        .from("email_recovery_groups")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", attemptId);
    }
    lastActivityRef.current = Date.now();
    void tick();
  }, [smartAccountAddress, chainId, attemptId, tick]);

  const refetch = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    lastActivityRef.current = Date.now();
    await tick();
  }, [tick]);

  return { state, triggerExecute, triggerCancelExpired, refetch };
}
