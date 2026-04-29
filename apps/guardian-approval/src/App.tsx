import React, { useEffect, useMemo, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createPublicClient,
  createWalletClient,
  custom,
  encodeFunctionData,
  http,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import { anvil } from 'viem/chains';
import { Shield, CheckCircle, AlertCircle, Wallet, ArrowRight, ExternalLink, Clock, Users, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { buildRecoveryTypedData, type RecoveryIntent } from './lib/recovery';

// ─── Types ────────────────────────────────────────────────────────────────────

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

type FetchState = 'loading' | 'ready' | 'not-found' | 'expired' | 'error';
type ApprovalMode = 'EOA_ECDSA' | 'APPROVE_HASH' | null;

// ─── Config ───────────────────────────────────────────────────────────────────

const APPROVE_HASH_ABI = parseAbi(['function approveHash(bytes32 hash)']);
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_OVERRIDE_URL
  || (import.meta as any).env?.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_OVERRIDE_ANON_KEY
  || (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
    : null;

const requestIdFromPath = (): string => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts.at(-1) ?? '';
};

// ─── Landing page (no request ID in URL) ─────────────────────────────────────

const LandingPage: React.FC = () => {
  const [input, setInput] = React.useState('');
  const [error, setError] = React.useState('');

  const handleGo = () => {
    const trimmed = input.trim();
    if (!trimmed) { setError('Paste a request ID or full approval link.'); return; }
    // Accept either a full URL or a bare UUID
    let id = trimmed;
    try {
      const url = new URL(trimmed);
      const parts = url.pathname.split('/').filter(Boolean);
      id = parts.at(-1) ?? trimmed;
    } catch {
      // Not a URL — treat as bare ID
    }
    if (!id) { setError('Could not extract a request ID from the input.'); return; }
    window.location.href = `/${id}`;
  };

  return (
    <div className="min-h-screen bg-background text-white p-6 flex flex-col items-center justify-center">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-lg glass rounded-3xl p-8 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-5">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Trezo Guardian Portal</h1>
          <p className="text-secondary text-sm leading-relaxed">
            Authorize wallet recovery requests for wallets you guard.
          </p>
        </div>

        {/* Request ID / link entry */}
        <div className="space-y-3 mb-6">
          <p className="text-sm font-semibold">Open an approval request</p>
          <div className="flex gap-2">
            <input
              className="flex-1 bg-surface border border-white/10 rounded-xl px-4 py-3 text-sm placeholder:text-secondary focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="Paste request ID or approval link…"
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleGo()}
            />
            <button
              onClick={handleGo}
              className="px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover transition-colors font-semibold flex items-center gap-1.5 shrink-0"
            >
              <ArrowRight className="w-4 h-4" />
              Go
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        {/* How it works */}
        <div className="p-4 rounded-2xl bg-surface border border-white/5 text-left space-y-2 mb-6">
          <p className="text-xs text-secondary font-semibold uppercase tracking-wider">How it works</p>
          <p className="text-sm text-secondary">1. The wallet owner schedules a recovery in the Trezo app</p>
          <p className="text-sm text-secondary">2. They share a unique approval link with their guardians</p>
          <p className="text-sm text-secondary">3. Each guardian opens the link and signs the approval</p>
          <p className="text-sm text-secondary">4. Once threshold is met, recovery can be executed</p>
        </div>

        <div className="pt-4 border-t border-white/5 flex justify-center">
          <p className="text-xs text-secondary flex items-center gap-1.5">
            Powered by Trezo Protocol <ExternalLink className="w-3 h-3" />
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────

const GuardianApproval: React.FC = () => {
  const [request, setRequest] = useState<GuardianRequest | null>(null);
  const [fetchState, setFetchState] = useState<FetchState>('loading');
  const [message, setMessage] = useState('');
  const [requestId] = useState(() => requestIdFromPath());
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [address, setAddress] = useState<Address | null>(null);

  // ── Fetch request from Supabase ──────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      if (!supabase) {
        setFetchState('error');
        setMessage('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.');
        return;
      }
      if (!requestId) {
        setFetchState('not-found');
        setMessage('Missing request ID in the URL.');
        return;
      }

      setFetchState('loading');
      const { data, error } = await supabase.rpc('get_recovery_request_for_guardian', {
        p_request_id: requestId,
        p_guardian_address: address ?? ZERO_ADDRESS,
      });

      if (error) {
        setFetchState('error');
        setMessage(error.message);
        return;
      }

      const row = Array.isArray(data) ? (data[0] as GuardianRequest | undefined) : undefined;
      if (!row) {
        setFetchState('not-found');
        setMessage('Recovery request not found or no longer open.');
        setRequest(null);
        return;
      }

      const expired = new Date(row.deadline).getTime() < Date.now();
      setRequest(row);
      setFetchState(expired ? 'expired' : 'ready');
      setMessage(expired ? 'This request has expired.' : 'Review the request before approving.');
    };

    void load();
  }, [address, requestId]);

  // ── Determine approval mode (EOA vs contract wallet) ────────────────────
  useEffect(() => {
    if (!address || !request) { setApprovalMode(null); return; }

    const resolve = async () => {
      try {
        const publicClient = createPublicClient({ chain: anvil, transport: http() });
        const code = await publicClient.getBytecode({ address });
        setApprovalMode(code && code !== '0x' ? 'APPROVE_HASH' : 'EOA_ECDSA');
      } catch {
        setApprovalMode('EOA_ECDSA');
      }
    };
    void resolve();
  }, [address, request]);

  // ── Check if this guardian has already approved ──────────────────────────
  useEffect(() => {
    if (!supabase || !address || !request || isApproved) return;

    const checkExisting = async () => {
      const { data } = await supabase
        .from('recovery_approvals')
        .select('id, verification_status')
        .eq('request_id', request.id)
        .eq('guardian_address', address.toLowerCase())
        .maybeSingle();

      if (data?.verification_status === 'valid') {
        setIsApproved(true);
        setMessage('You have already approved this recovery request.');
      }
    };

    void checkExisting();
  }, [address, request, isApproved]);

  // ── Derived state ────────────────────────────────────────────────────────
  const guardianIndex = useMemo(() => {
    if (!request || !address) return -1;
    return request.guardian_addresses.findIndex(
      (g) => g.toLowerCase() === address.toLowerCase(),
    );
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

  const canApprove =
    request &&
    address &&
    guardianIndex >= 0 &&
    fetchState === 'ready' &&
    primaryScope &&
    typedIntent &&
    approvalMode;

  const deadlineLabel = useMemo(() => {
    if (!request) return '';
    const ms = new Date(request.deadline).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const mins = Math.floor(ms / 60000);
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    return d > 0 ? `${d}d ${h}h remaining` : `${h}h ${m}m remaining`;
  }, [request]);

  // ── Wallet connection ────────────────────────────────────────────────────
  const connectWallet = async () => {
    if (typeof (window as any).ethereum === 'undefined') {
      toast.error('Please install a wallet like MetaMask');
      return;
    }
    try {
      const wc = createWalletClient({ chain: anvil, transport: custom((window as any).ethereum) });
      const [account] = await wc.requestAddresses();
      setAddress(account);
      toast.success('Wallet connected!');
    } catch {
      toast.error('Failed to connect wallet');
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setApprovalMode(null);
  };

  // ── Submit approval ──────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!supabase || !request || !address || !typedIntent || !primaryScope || !approvalMode) return;

    setIsSubmitting(true);
    setMessage('Submitting approval...');

    try {
      let signature = '0x';
      let approvalTxHash: string | undefined;

      if (approvalMode === 'EOA_ECDSA') {
        // Sign typed data with the guardian's EOA
        const typedData = buildRecoveryTypedData(typedIntent, primaryScope.socialRecovery as Address);
        const wc = createWalletClient({ account: address, chain: anvil, transport: custom((window as any).ethereum) });
        signature = await wc.signTypedData({
          account: address,
          domain: typedData.domain,
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: typedData.message as any,
        });
      } else {
        // Contract wallet: send approveHash on-chain
        const wc = createWalletClient({ account: address, chain: anvil, transport: custom((window as any).ethereum) });
        approvalTxHash = await wc.sendTransaction({
          to: primaryScope.socialRecovery as Address,
          data: encodeFunctionData({
            abi: APPROVE_HASH_ABI,
            functionName: 'approveHash',
            args: [request.digest as Hex],
          }),
        });
      }

      // Record approval in Supabase via edge function
      const { data: fnData, error: fnError } = await supabase.functions.invoke('submit-guardian-approval', {
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

      if (fnError) {
        const msg = (fnData as any)?.error ?? fnError.message ?? 'Failed to submit approval.';
        throw new Error(msg);
      }

      setIsApproved(true);
      setMessage('Approval submitted successfully.');
      setRequest((cur) => cur ? { ...cur, approval_count: cur.approval_count + 1 } : cur);
      toast.success('Guardian approval recorded!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to approve request.';
      setMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Status badge color ───────────────────────────────────────────────────
  const statusColor: Record<FetchState, string> = {
    loading: 'text-secondary',
    ready: 'text-green-400',
    'not-found': 'text-red-400',
    expired: 'text-yellow-400',
    error: 'text-red-400',
  };

  // ─────────────────────────────────────────────────────────────────────────

  // ── No request ID — show landing page ───────────────────────────────────
  if (!requestId) {
    return (
      <LandingPage />
    );
  }

  return (
    <div className="min-h-screen bg-background text-white p-6 flex flex-col items-center justify-center">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e1e2e', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' } }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-lg glass rounded-3xl p-8 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">Guardian Approval</h1>
            <p className="text-secondary text-sm">Secure Recovery Authorization</p>
          </div>
          <span className={`text-xs font-semibold uppercase tracking-wider ${statusColor[fetchState]}`}>
            {fetchState}
          </span>
        </div>

        {/* Request Details Card */}
        <AnimatePresence mode="wait">
          {fetchState === 'loading' && (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 rounded-2xl bg-surface border border-white/5 flex items-center gap-3 mb-6">
              <RefreshCw className="w-5 h-5 text-secondary animate-spin" />
              <p className="text-sm text-secondary">Loading recovery request...</p>
            </motion.div>
          )}

          {fetchState === 'error' && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 mb-6">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{message}</p>
            </motion.div>
          )}

          {fetchState === 'not-found' && (
            <motion.div key="not-found" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 rounded-2xl bg-surface border border-white/5 mb-6">
              <p className="text-sm text-secondary text-center">{message}</p>
            </motion.div>
          )}

          {(fetchState === 'ready' || fetchState === 'expired') && request && (
            <motion.div key="request" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="p-4 rounded-2xl bg-surface border border-white/5 space-y-3 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary">Wallet</span>
                <span className="font-mono text-xs">{request.wallet_address.slice(0, 8)}...{request.wallet_address.slice(-6)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Approvals</span>
                <span className="font-semibold">{request.approval_count} / {request.threshold}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Deadline</span>
                <span className={fetchState === 'expired' ? 'text-yellow-400 font-semibold' : ''}>{deadlineLabel}</span>
              </div>
              {request.requester_note && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-secondary text-xs mb-1">Note from requester</p>
                  <p className="text-sm italic">"{request.requester_note}"</p>
                </div>
              )}
              {fetchState === 'expired' && (
                <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                  <p className="text-xs text-yellow-400">This request has expired and can no longer be approved.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Wallet / Approval Section */}
        {!address ? (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-surface border border-white/5">
              <p className="text-sm text-secondary mb-4">
                Connect your guardian wallet to verify and sign the approval.
              </p>
              <button
                onClick={() => void connectWallet()}
                className="w-full py-4 rounded-xl bg-primary hover:bg-primary-hover transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <Wallet className="w-5 h-5" />
                Connect Wallet
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Connected wallet info */}
            <div className="p-4 rounded-2xl bg-surface border border-white/5 space-y-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary">Your Address</span>
                <span className="font-mono text-primary text-xs">{address.slice(0, 8)}...{address.slice(-6)}</span>
              </div>
              {request && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-secondary">Guardian status</span>
                  {guardianIndex >= 0
                    ? <span className="text-green-400 font-semibold text-xs">✓ Confirmed guardian</span>
                    : <span className="text-red-400 font-semibold text-xs">✗ Not a guardian</span>}
                </div>
              )}
              {approvalMode && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-secondary">Approval mode</span>
                  <span className="text-xs font-mono">{approvalMode === 'EOA_ECDSA' ? 'Sign (EOA)' : 'On-chain tx'}</span>
                </div>
              )}
              <button onClick={disconnectWallet} className="text-xs text-secondary hover:text-white transition-colors underline underline-offset-2 mt-1">
                Disconnect
              </button>
            </div>

            {/* Not a guardian warning */}
            {request && guardianIndex < 0 && (
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-xs text-red-400">
                  Your connected wallet is not listed as a guardian for this request. Please connect the correct wallet.
                </p>
              </div>
            )}

            {/* Approval action */}
            <AnimatePresence mode="wait">
              {isApproved ? (
                <motion.div
                  key="approved"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 text-center"
                >
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-green-500">Authorized</h3>
                  <p className="text-sm text-secondary mt-1">
                    Your approval has been recorded. {request && `${request.approval_count}/${request.threshold} approvals collected.`}
                  </p>
                </motion.div>
              ) : fetchState === 'ready' && guardianIndex >= 0 ? (
                <motion.div key="action" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-500/90 leading-relaxed">
                      By approving, you authorize the wallet owner to rotate access to a new passkey. Only do this if you have verified the identity of the requester.
                    </p>
                  </div>
                  <button
                    onClick={() => void handleApprove()}
                    disabled={!canApprove || isSubmitting}
                    className="w-full py-4 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 transition-all font-semibold flex items-center justify-center gap-2 group"
                  >
                    {isSubmitting
                      ? 'Submitting...'
                      : approvalMode === 'APPROVE_HASH'
                        ? 'Approve On-Chain'
                        : 'Sign Approval'}
                    {!isSubmitting && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                  </button>
                  {message && !isApproved && (
                    <p className="text-xs text-secondary text-center">{message}</p>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
          <p className="text-xs text-secondary flex items-center gap-1.5">
            Powered by Trezo Protocol <ExternalLink className="w-3 h-3" />
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default GuardianApproval;
