import { useEffect, useMemo, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useAccount, useConnect, useDisconnect, usePublicClient, useSignTypedData, useWalletClient } from "wagmi";
import { encodeFunctionData, parseAbi, type Address, type Hex } from "viem";

import { buildRecoveryTypedData, type RecoveryIntent } from "./lib/recovery";

type GuardianRequest = {
  id: string;
  wallet_address: string;
  guardian_addresses: string[];
  threshold: number;
  approval_count: number;
  deadline: string;
  status: string;
  digest: string;
  requester_note: string | null;
  target_chain_ids: number[];
  recovery_intent_json: Record<string, unknown>;
  chain_scopes_json: Array<{
    chainId: number;
    wallet: string;
    socialRecovery: string;
    nonce: number;
    guardianSetHash: string;
    policyHash: string;
  }>;
  created_at: string;
};

type FetchState = "loading" | "ready" | "not-found" | "expired" | "error";
type ApprovalMode = "EOA_ECDSA" | "APPROVE_HASH" | null;

const APPROVE_HASH_ABI = parseAbi([
  "function approveHash(bytes32 hash)",
]);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
      })
    : null;

const requestIdFromPath = (): string => {
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.at(-1) ?? "";
};

const zeroAddress = "0x0000000000000000000000000000000000000000";

const App = () => {
  const [request, setRequest] = useState<GuardianRequest | null>(null);
  const [status, setStatus] = useState<FetchState>("loading");
  const [message, setMessage] = useState<string>("");
  const [requestId] = useState(() => requestIdFromPath());
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproved, setIsApproved] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { signTypedDataAsync } = useSignTypedData();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setStatus("error");
        setMessage("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
        return;
      }

      if (!requestId) {
        setStatus("not-found");
        setMessage("Missing request id in the URL.");
        return;
      }

      setStatus("loading");
      const { data, error } = await supabase.rpc("get_recovery_request_for_guardian", {
        p_request_id: requestId,
        p_guardian_address: address ?? zeroAddress,
      });

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      const requestRow = Array.isArray(data) ? (data[0] as GuardianRequest | undefined) : undefined;
      console.log("Fetched request:", requestRow);
      if (!requestRow) {
        setStatus("not-found");
        setMessage("Recovery request not found or no longer open for approvals.");
        setRequest(null);
        return;
      }

      const expired = new Date(requestRow.deadline).getTime() < Date.now();
      setRequest(requestRow);
      setStatus(expired ? "expired" : "ready");
      setMessage(expired ? "This request has expired." : "Review the request before approving.");
    };

    void load();
  }, [address, requestId]);

  const guardianIndex = useMemo(() => {
    if (!request || !address) return -1;
    return request.guardian_addresses.findIndex((guardian) => guardian.toLowerCase() === address.toLowerCase());
  }, [address, request]);

  const primaryScope = request?.chain_scopes_json?.[0] ?? null;
  const typedIntent = useMemo<RecoveryIntent | null>(() => {
    if (!request) return null;
    const raw = request.recovery_intent_json;
    return {
      requestId: raw.requestId as Hex,
      newPasskeyHash: raw.newPasskeyHash as Hex,
      chainScopeHash: raw.chainScopeHash as Hex,
      validAfter: Number(raw.validAfter ?? 0),
      deadline: Number(raw.deadline ?? 0),
      metadataHash: raw.metadataHash as Hex,
    };
  }, [request]);

  useEffect(() => {
    const resolveMode = async () => {
      if (!request || !address || !publicClient) {
        setApprovalMode(null);
        return;
      }

      try {
        const code = await publicClient.getBytecode({ address: address as Address });
        setApprovalMode(code && code !== "0x" ? "APPROVE_HASH" : "EOA_ECDSA");
      } catch {
        setApprovalMode("EOA_ECDSA");
      }
    };

    void resolveMode();
  }, [address, publicClient, request]);

  const canApprove = Boolean(
    request &&
      isConnected &&
      guardianIndex >= 0 &&
      status === "ready" &&
      primaryScope &&
      typedIntent &&
      approvalMode,
  );

  const handleApprove = async () => {
    if (!supabase || !request || !address || !typedIntent || !primaryScope || !approvalMode) {
      return;
    }

    setIsSubmitting(true);
    setMessage("Submitting approval...");

    try {
      let signature = "0x";
      let approvalTxHash: string | undefined;

      if (approvalMode === "EOA_ECDSA") {
        const typedData = buildRecoveryTypedData(typedIntent, primaryScope.socialRecovery as Address);
        signature = await signTypedDataAsync(typedData as never);
      } else {
        if (!walletClient) {
          throw new Error("Connected wallet client is unavailable for on-chain approval.");
        }

        approvalTxHash = await walletClient.sendTransaction({
          to: primaryScope.socialRecovery as Address,
          data: encodeFunctionData({
            abi: APPROVE_HASH_ABI,
            functionName: "approveHash",
            args: [request.digest as Hex],
          }),
        });
      }

      const { data, error } = await supabase.functions.invoke("submit-guardian-approval", {
        body: {
          requestId: request.id,
          guardianAddress: address,
          guardianIndex,
          sigKind: approvalMode,
          signature,
          approvalTxHash,
          chainId: primaryScope.chainId,
        },
      });

      if (error) {
        const message = (data as any)?.error || error.message || "Failed to submit approval.";
        throw new Error(message);
      }

      setIsApproved(true);
      setMessage("Approval submitted successfully.");
      setRequest((current) =>
        current
          ? {
              ...current,
              approval_count: current.approval_count + 1,
            }
          : current,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to approve request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <main className="shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Trezo Guardian Approval</p>
            <h1>Approve the recovery request</h1>
            <p className="lede">Connect your wallet, verify the request details, and approve the exact recovery intent the contract will validate.</p>
          </div>
          <div className="badge">{status}</div>
        </header>

        <section className="panel">
          {request ? (
            <>
              <div className="row">
                <span>Wallet</span>
                <strong>{request.wallet_address}</strong>
              </div>
              <div className="row">
                <span>Chains</span>
                <strong>{request.target_chain_ids.join(", ")}</strong>
              </div>
              <div className="row">
                <span>Approvals</span>
                <strong>
                  {request.approval_count} / {request.threshold}
                </strong>
              </div>
              <div className="row">
                <span>Deadline</span>
                <strong>{new Date(request.deadline).toLocaleString()}</strong>
              </div>
              <div className="row">
                <span>Passkey Hash</span>
                <strong>{String(request.recovery_intent_json.newPasskeyHash ?? "").slice(0, 18)}...</strong>
              </div>
              {request.requester_note ? (
                <div className="row">
                  <span>Note</span>
                  <strong>{request.requester_note}</strong>
                </div>
              ) : null}
            </>
          ) : (
            <p>{message}</p>
          )}
        </section>

        <section className="panel actions">
          {isApproved ? (
            <div className="receipt">
              <div className="status-success">✓ Approved Successfully</div>
              <p>Your signature has been recorded. Once the threshold of {request?.threshold} guardians is reached, the recovery can be scheduled on-chain.</p>
              <div className="row">
                <span>Guardian</span>
                <small>{address}</small>
              </div>
              <div className="row">
                <span>Mode</span>
                <small>{approvalMode}</small>
              </div>
              <button className="ghost" onClick={() => setIsApproved(false)}>
                Back to Request
              </button>
            </div>
          ) : !isConnected ? (
            <div className="connectors">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => connect({ connector })}
                  disabled={isPending}
                >
                  Connect {connector.name}
                </button>
              ))}
            </div>
          ) : request && guardianIndex < 0 ? (
            <>
              <p>Connected wallet: {address}</p>
              <p>Your connected address is not configured as a guardian for this request.</p>
              <button className="ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          ) : request ? (
            <>
              <p>Connected wallet: {address}</p>
              <p>Approval mode: {approvalMode ?? "Detecting..."}</p>
              <button onClick={() => void handleApprove()} disabled={!canApprove || isSubmitting}>
                {isSubmitting ? "Submitting..." : approvalMode === "APPROVE_HASH" ? "Approve On-Chain" : "Sign Approval"}
              </button>
              <button className="ghost" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          ) : null}
        </section>

        <p className="footer">{message}</p>
      </main>
    </div>
  );
};

export default App;
