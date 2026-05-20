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
  type Chain,
  type Hex,
} from 'viem';
import { anvil, baseSepolia, sepolia, arbitrumSepolia, base } from 'viem/chains';
import { Shield, CheckCircle, AlertCircle, Wallet, ArrowRight, ExternalLink, Clock, Users, RefreshCw, Send, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { buildRecoveryTypedData, type RecoveryIntent } from './lib/recovery';

// Chain table — keyed by chainId returned by the recovery_request's chain_scopes_json.
// The portal is chain-agnostic: when a request loads we look up the chain it
// targets and wire all viem clients accordingly. Defaults to Base Sepolia (84532)
// to match Trezo's primary testnet, but no chain is "hardcoded" in flow logic.
const CHAIN_BY_ID: Record<number, Chain> = {
  31337: anvil,
  84532: baseSepolia,
  8453: base,
  11155111: sepolia,
  421614: arbitrumSepolia,
};

// Optional RPC override at build time — useful if the user wants to point a chain
// at a private RPC (e.g. Alchemy/Infura) instead of the public viem default.
// Each env var is OPTIONAL; if missing, viem's built-in chain RPC is used.
const ENV_RPC_OVERRIDES: Record<number, string | undefined> = {
  31337: (import.meta as any).env?.VITE_ANVIL_RPC_URL,
  84532: (import.meta as any).env?.VITE_BASE_SEPOLIA_RPC_URL,
  8453: (import.meta as any).env?.VITE_BASE_RPC_URL,
  11155111: (import.meta as any).env?.VITE_SEPOLIA_RPC_URL,
  421614: (import.meta as any).env?.VITE_ARBITRUM_SEPOLIA_RPC_URL,
};

const FALLBACK_PUBLIC_RPCS: Record<number, string> = {
  84532: "https://sepolia.base.org",
  8453: "https://mainnet.base.org",
  11155111: "https://rpc.sepolia.org",
  421614: "https://sepolia-rollup.arbitrum.io/rpc",
};

function getChainForId(chainId: number): Chain {
  const base = CHAIN_BY_ID[chainId];
  if (!base) {
    throw new Error(`Unsupported chainId ${chainId}. Add it to CHAIN_BY_ID in App.tsx.`);
  }
  const override = ENV_RPC_OVERRIDES[chainId] || FALLBACK_PUBLIC_RPCS[chainId];
  if (!override) return base;
  return {
    ...base,
    rpcUrls: {
      default: { http: [override] },
      public: { http: [override] },
    },
  };
}

function getRpcUrlForId(chainId: number): string {
  const chain = getChainForId(chainId);
  return chain.rpcUrls.default.http[0];
}

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

// MetaMask injects a SES (Secure EcmaScript) lockdown shim into every page
// before our code runs. That shim sometimes routes outgoing fetch headers
// through a tracing wrapper that adds non-Latin-1 code points (Symbol tags),
// and the native `Headers.set` rejects those with
// "TypeError: Failed to execute 'set' on 'Headers': String contains non
// ISO-8859-1 code point.".
//
// Strip anything outside Latin-1 from header VALUES before fetch runs. Our
// real headers (apikey, Authorization, Content-Type) are pure ASCII, so this
// is a no-op for legitimate traffic — only the SES-injected junk gets removed.
const sanitizeHeaders = (
  source: HeadersInit | undefined,
): Record<string, string> | undefined => {
  if (!source) return undefined;
  const entries: Array<[string, string]> =
    source instanceof Headers
      ? Array.from(source.entries())
      : Array.isArray(source)
        ? (source as Array<[string, string]>)
        : Object.entries(source as Record<string, string>);
  const cleaned: Record<string, string> = {};
  for (const [name, value] of entries) {
    cleaned[name] = String(value).replace(/[^\x00-\xFF]/g, "");
  }
  return cleaned;
};

const sesSafeFetch: typeof fetch = async (input, init) => {
  if (init?.headers) {
    init = { ...init, headers: sanitizeHeaders(init.headers) };
  }
  return fetch(input, init);
};

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { fetch: sesSafeFetch },
      })
    : null;

const isFunctionsHttpError = (error: unknown): error is {
  context?: {
    status?: number;
    json?: () => Promise<Record<string, unknown>>;
    text?: () => Promise<string>;
  };
} => {
  return Boolean(error && typeof error === 'object' && 'context' in error);
};

const parseFunctionInvokeErrorMessage = async (error: unknown): Promise<string | null> => {
  if (!isFunctionsHttpError(error) || !error.context) {
    return null;
  }

  const context = error.context;
  try {
    if (typeof context.json === 'function') {
      const payload = await context.json();
      const payloadMessage = payload?.error ?? payload?.message;
      if (typeof payloadMessage === 'string' && payloadMessage.trim().length > 0) {
        return payloadMessage;
      }
    }
  } catch {
    // Ignore JSON parsing failures and fall back to text/status.
  }

  try {
    if (typeof context.text === 'function') {
      const text = await context.text();
      if (text.trim().length > 0) {
        return text;
      }
    }
  } catch {
    // Ignore text parsing failures.
  }

  if (typeof context.status === 'number') {
    return `Guardian approval failed with HTTP ${context.status}.`;
  }

  return null;
};

const requestIdFromPath = (): string => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts.at(-1) ?? '';
};

const isEmailRecoveryPath = (): boolean => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return parts[0] === 'email-recovery' && parts.length >= 3;
};

const emailRecoveryPathParams = (): { groupId: string; approvalId: string } | null => {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] !== 'email-recovery' || parts.length < 3) return null;
  return { groupId: parts[1]!, approvalId: parts[2]! };
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

// ─── Email Recovery Approval Component ──────────────────────────────────────

type EmailRecoveryGroupData = {
  smart_account_address: string;
  chain_ids: number[];
  multichain_recovery_data_hash: string;
  deadline: string;
  status: string;
};

type EmailRecoveryConfigData = {
  threshold: number;
};

const EmailRecoveryApproval: React.FC = () => {
  const [group, setGroup] = useState<EmailRecoveryGroupData | null>(null);
  const [config, setConfig] = useState<EmailRecoveryConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const params = useMemo(() => emailRecoveryPathParams(), []);

  useEffect(() => {
    if (!supabase || !params) {
      setLoading(false);
      setError('Missing Supabase config or path parameters.');
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data: groupData, error: groupErr } = await supabase
          .from('email_recovery_groups')
          .select('smart_account_address, chain_ids, multichain_recovery_data_hash, deadline, status, config_id')
          .eq('id', params.groupId)
          .maybeSingle();

        if (groupErr) { setError(groupErr.message); return; }
        if (!groupData) { setError('Recovery group not found.'); return; }

        setGroup(groupData as EmailRecoveryGroupData & { config_id: string });

        const { data: configData, error: configErr } = await supabase
          .from('email_recovery_configs')
          .select('threshold')
          .eq('id', (groupData as any).config_id)
          .maybeSingle();

        if (configErr) { setError(configErr.message); return; }
        if (configData) setConfig(configData as EmailRecoveryConfigData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recovery data');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params]);

  const deadlineLabel = useMemo(() => {
    if (!group) return '';
    const dl = new Date(group.deadline);
    const diff = dl.getTime() - Date.now();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return days > 0 ? `${days}d ${hours}h remaining` : `${hours}h ${mins}m remaining`;
  }, [group]);

  const expired = useMemo(() => {
    if (!group) return false;
    return new Date(group.deadline).getTime() < Date.now();
  }, [group]);

  const maskedWallet = group ? `${group.smart_account_address.slice(0, 8)}...${group.smart_account_address.slice(-6)}` : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-white p-6 flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-lg glass rounded-3xl p-8 text-center">
          <RefreshCw className="w-6 h-6 text-secondary animate-spin mx-auto mb-3" />
          <p className="text-secondary text-sm">Loading recovery request...</p>
        </motion.div>
      </div>
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
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold">Recovery Details</h1>
            <p className="text-secondary text-sm">Informational Only</p>
          </div>
        </div>

        {error ? (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex gap-3 mb-6">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : group ? (
          <>
            <div className="p-4 rounded-2xl bg-surface border border-white/5 space-y-3 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary">Wallet</span>
                <span className="font-mono text-xs">{maskedWallet}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-secondary flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Deadline</span>
                <span className={expired ? 'text-yellow-400 font-semibold' : ''}>{deadlineLabel}</span>
              </div>
              {config && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-secondary flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Approvals needed</span>
                  <span className="font-semibold">{config.threshold}</span>
                </div>
              )}
              {group.chain_ids.length > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-secondary">Chains</span>
                  <span className="font-mono text-xs">{group.chain_ids.length} chain{group.chain_ids.length > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {expired ? (
              <div className="p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex gap-3 mb-6">
                <AlertCircle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">This recovery request has expired and can no longer be approved.</p>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 mb-6">
                <p className="text-sm text-blue-400 leading-relaxed">
                  This page is for informational purposes only. Approval happens by replying to the ZK Email relayer email you received.
                </p>
                <div className="mt-3 p-3 rounded-xl bg-surface border border-white/10">
                  <p className="text-xs text-secondary mb-1">Reply command for the recovery email:</p>
                  <code className="text-xs text-green-400 break-all">
                    Recover account {group.smart_account_address} using recovery hash {group.multichain_recovery_data_hash}
                  </code>
                </div>
                <p className="text-xs text-secondary mt-2">
                  Your email reply is verified by the ZK Email relayer using DKIM signatures and zero-knowledge proofs.
                  This web page cannot approve or confirm recovery. Only a verified email reply counts as approval.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="p-4 rounded-2xl bg-surface border border-white/5 mb-6">
            <p className="text-sm text-secondary text-center">No recovery data found.</p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-white/5 flex justify-center">
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
  const [isScheduling, setIsScheduling] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
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
        if (!targetChain || !targetRpcUrl) {
          setApprovalMode('EOA_ECDSA');
          return;
        }
        const publicClient = createPublicClient({ chain: targetChain, transport: http(targetRpcUrl) });
        const code = await publicClient.getBytecode({ address });
        setApprovalMode(code && code !== '0x' ? 'APPROVE_HASH' : 'EOA_ECDSA');
      } catch {
        setApprovalMode('EOA_ECDSA');
      }
    };
    void resolve();
  }, [address, request, targetChain, targetRpcUrl]);

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
  const targetChainId = primaryScope?.chainId ?? null;
  const targetChain: Chain | null = useMemo(
    () => (targetChainId != null ? getChainForId(targetChainId) : null),
    [targetChainId],
  );
  const targetRpcUrl: string | null = useMemo(
    () => (targetChainId != null ? getRpcUrlForId(targetChainId) : null),
    [targetChainId],
  );

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
      // Use the recovery request's target chain as the connection context.
      // If no request loaded yet, fall back to Base Sepolia.
      const chain = targetChain ?? baseSepolia;
      const wc = createWalletClient({ chain, transport: custom((window as any).ethereum) });
      const [account] = await wc.requestAddresses();
      setAddress(account);
      toast.success('Wallet connected!');
    } catch {
      toast.error('Failed to connect wallet');
    }
  };

  // Prompt MetaMask to switch to the recovery's target chain. Required before
  // approval signing (so EIP-712 chainId matches) and before submitting any
  // on-chain tx (so the user pays gas on the right network).
  const ensureChain = async (): Promise<boolean> => {
    if (!targetChain) return false;
    const eth = (window as any).ethereum;
    if (!eth) return false;
    try {
      const current = await eth.request({ method: 'eth_chainId' });
      const currentId = typeof current === 'string' ? parseInt(current, 16) : Number(current);
      if (currentId === targetChain.id) return true;
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x' + targetChain.id.toString(16) }],
        });
        return true;
      } catch (err: any) {
        // Chain not added to wallet — try adding it.
        if (err?.code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x' + targetChain.id.toString(16),
              chainName: targetChain.name,
              nativeCurrency: targetChain.nativeCurrency,
              rpcUrls: targetChain.rpcUrls.default.http,
              blockExplorerUrls: targetChain.blockExplorers?.default?.url
                ? [targetChain.blockExplorers.default.url]
                : undefined,
            }],
          });
          return true;
        }
        throw err;
      }
    } catch (err) {
      console.warn('ensureChain failed:', err);
      toast.error(`Please switch to ${targetChain.name} in MetaMask`);
      return false;
    }
  };

  const disconnectWallet = () => {
    setAddress(null);
    setApprovalMode(null);
  };

  // ── Submit approval ──────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!supabase || !request || !address || !typedIntent || !primaryScope || !approvalMode || !targetChain) return;

    setIsSubmitting(true);
    setMessage('Submitting approval...');

    try {
      // Make sure MetaMask is on the right chain before signing — EIP-712
      // signatures bind to chainId, and an on-chain approveHash needs to send
      // a tx on the wallet's recovery chain.
      const switched = await ensureChain();
      if (!switched) {
        throw new Error(`Please switch MetaMask to ${targetChain.name} and try again.`);
      }

      let signature = '0x';
      let approvalTxHash: string | undefined;

      if (approvalMode === 'EOA_ECDSA') {
        // Sign typed data with the guardian's EOA
        const typedData = buildRecoveryTypedData(typedIntent, primaryScope.socialRecovery as Address);
        const wc = createWalletClient({ account: address, chain: targetChain, transport: custom((window as any).ethereum) });
        signature = await wc.signTypedData({
          account: address,
          domain: typedData.domain,
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: typedData.message as any,
        });
      } else {
        // Contract wallet: send approveHash on-chain
        const wc = createWalletClient({ account: address, chain: targetChain, transport: custom((window as any).ethereum) });
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
        const functionMessage = await parseFunctionInvokeErrorMessage(fnError);
        const msg =
          (fnData as any)?.error ??
          functionMessage ??
          fnError.message ??
          'Failed to submit approval.';
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

  // ── Refresh request from DB (used after schedule/execute submits) ────────
  const refreshRequest = async () => {
    if (!supabase || !requestId) return;
    try {
      const { data } = await supabase.rpc('get_recovery_request_for_guardian', {
        p_request_id: requestId,
        p_guardian_address: address ?? ZERO_ADDRESS,
      });
      const row = Array.isArray(data) ? (data[0] as GuardianRequest | undefined) : undefined;
      if (row) setRequest(row);
    } catch (err) {
      console.warn('refreshRequest failed:', err);
    }
  };

  // ── Submit Schedule on-chain (MetaMask sends the tx, guardian pays gas) ──
  // Permissionless on the contract — anyone can call scheduleRecovery as long
  // as they pass valid guardian signatures. We fetch the prepared calldata
  // (with all guardian sigs baked in) from the backend, then MetaMask submits.
  const handleSchedule = async () => {
    if (!supabase || !request || !address || !targetChain || !primaryScope) return;
    setIsScheduling(true);
    setMessage('Preparing schedule transaction…');
    try {
      const switched = await ensureChain();
      if (!switched) {
        throw new Error(`Please switch MetaMask to ${targetChain.name} and try again.`);
      }

      // 1. Ask backend to build the scheduleRecovery calldata (it reads all
      //    guardian signatures from Supabase; we can't see them due to RLS).
      const { data: prep, error: prepErr } = await supabase.functions.invoke('submit-recovery-operation', {
        body: { requestId: request.id, chainId: primaryScope.chainId, action: 'prepare-schedule' },
      });
      if (prepErr || !prep?.success) {
        const reason = (prep as any)?.error ?? prepErr?.message ?? 'prepare-schedule failed';
        throw new Error(reason);
      }

      // 2. MetaMask submits the call directly to the SocialRecovery contract.
      //    Guardian pays gas (testnet faucet is fine; mainnet ~$0.01).
      setMessage('Submitting schedule transaction via MetaMask…');
      const wc = createWalletClient({
        account: address,
        chain: targetChain,
        transport: custom((window as any).ethereum),
      });
      const txHash = await wc.sendTransaction({
        to: prep.socialRecoveryAddress as Address,
        data: prep.calldata as Hex,
      });
      setMessage(`Schedule tx broadcast: ${txHash.slice(0, 10)}… waiting for confirmation`);

      // 3. Tell backend to confirm + record. Backend reads receipt + on-chain
      //    state + updates recovery_chain_statuses.
      const { data: rec, error: recErr } = await supabase.functions.invoke('submit-recovery-operation', {
        body: {
          requestId: request.id,
          chainId: primaryScope.chainId,
          action: 'record-tx',
          recordAction: 'schedule',
          txHash,
        },
      });
      if (recErr || !rec?.success) {
        const reason = (rec as any)?.error ?? recErr?.message ?? 'record-tx failed';
        throw new Error(reason);
      }

      toast.success('Recovery scheduled on-chain. Timelock has started.');
      setMessage('Schedule confirmed. Wait for the timelock, then return to execute.');
      await refreshRequest();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to schedule recovery.';
      setMessage(msg);
      toast.error(msg);
    } finally {
      setIsScheduling(false);
    }
  };

  // ── Execute the scheduled recovery once timelock expires ─────────────────
  const handleExecute = async () => {
    if (!supabase || !request || !address || !targetChain || !primaryScope) return;
    setIsExecuting(true);
    setMessage('Preparing execute transaction…');
    try {
      const switched = await ensureChain();
      if (!switched) {
        throw new Error(`Please switch MetaMask to ${targetChain.name} and try again.`);
      }

      const { data: prep, error: prepErr } = await supabase.functions.invoke('submit-recovery-operation', {
        body: { requestId: request.id, chainId: primaryScope.chainId, action: 'prepare-execute' },
      });
      if (prepErr || !prep?.success) {
        const reason = (prep as any)?.error ?? prepErr?.message ?? 'prepare-execute failed';
        throw new Error(reason);
      }

      setMessage('Submitting execute transaction via MetaMask…');
      const wc = createWalletClient({
        account: address,
        chain: targetChain,
        transport: custom((window as any).ethereum),
      });
      const txHash = await wc.sendTransaction({
        to: prep.socialRecoveryAddress as Address,
        data: prep.calldata as Hex,
      });
      setMessage(`Execute tx broadcast: ${txHash.slice(0, 10)}… waiting for confirmation`);

      const { data: rec, error: recErr } = await supabase.functions.invoke('submit-recovery-operation', {
        body: {
          requestId: request.id,
          chainId: primaryScope.chainId,
          action: 'record-tx',
          recordAction: 'execute',
          txHash,
        },
      });
      if (recErr || !rec?.success) {
        const reason = (rec as any)?.error ?? recErr?.message ?? 'record-tx failed';
        throw new Error(reason);
      }

      toast.success('Recovery executed — passkey rotated on-chain.');
      setMessage('Recovery complete. The recovering user can now sign with their new passkey.');
      await refreshRequest();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to execute recovery.';
      setMessage(msg);
      toast.error(msg);
    } finally {
      setIsExecuting(false);
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
    if (isEmailRecoveryPath()) {
      return <EmailRecoveryApproval />;
    }
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
                  className="space-y-4"
                >
                  <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-green-500">Authorized</h3>
                    <p className="text-sm text-secondary mt-1">
                      Your approval has been recorded. {request && `${request.approval_count}/${request.threshold} approvals collected.`}
                    </p>
                  </div>

                  {/* On-chain submission step — only relevant when the threshold is reached. */}
                  {request && (request.status === 'threshold_reached' || request.status === 'scheduling') && (
                    <div className="p-4 rounded-2xl bg-surface border border-white/5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Send className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold">Threshold reached</h4>
                      </div>
                      <p className="text-xs text-secondary leading-relaxed">
                        Submit the schedule transaction on-chain. Your MetaMask pays the gas (cheap on testnet, faucet ETH is fine). This starts the recovery timelock.
                      </p>
                      <button
                        onClick={() => void handleSchedule()}
                        disabled={isScheduling || !targetChain}
                        className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 transition-all font-semibold flex items-center justify-center gap-2 group text-sm"
                      >
                        {isScheduling ? 'Submitting…' : `Submit Schedule on ${targetChain?.name ?? '…'}`}
                        {!isScheduling && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                      </button>
                    </div>
                  )}

                  {request && (request.status === 'scheduled' || request.status === 'ready_to_execute' || request.status === 'executing') && (
                    <div className="p-4 rounded-2xl bg-surface border border-white/5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Play className="w-4 h-4 text-primary" />
                        <h4 className="text-sm font-semibold">
                          {request.status === 'ready_to_execute' || request.status === 'executing'
                            ? 'Ready to execute'
                            : 'Recovery scheduled — wait for timelock'}
                        </h4>
                      </div>
                      <p className="text-xs text-secondary leading-relaxed">
                        {request.status === 'ready_to_execute' || request.status === 'executing'
                          ? 'Timelock has elapsed. Submit the execute transaction to install the new passkey on the wallet. Your MetaMask pays gas.'
                          : 'The recovery is scheduled on-chain. Wait for the timelock to expire, then refresh and execute.'}
                      </p>
                      <button
                        onClick={() => void handleExecute()}
                        disabled={isExecuting || !targetChain || (request.status !== 'ready_to_execute' && request.status !== 'executing')}
                        className="w-full py-3 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 transition-all font-semibold flex items-center justify-center gap-2 group text-sm"
                      >
                        {isExecuting ? 'Executing…' : `Execute Recovery on ${targetChain?.name ?? '…'}`}
                        {!isExecuting && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                      </button>
                      <button
                        onClick={() => void refreshRequest()}
                        className="w-full py-2 rounded-xl border border-white/10 hover:bg-surface transition-colors text-xs text-secondary flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Refresh status
                      </button>
                    </div>
                  )}

                  {request && request.status === 'executed' && (
                    <div className="p-4 rounded-2xl bg-green-500/20 border border-green-500/40 text-center">
                      <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                      <h4 className="text-base font-bold text-green-400">Recovery complete</h4>
                      <p className="text-xs text-secondary mt-1">
                        The recovering user's new passkey is now registered on-chain.
                      </p>
                    </div>
                  )}

                  {message && (
                    <p className="text-xs text-secondary text-center">{message}</p>
                  )}
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
