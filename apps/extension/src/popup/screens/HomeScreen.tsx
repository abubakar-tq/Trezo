import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  List,
  Settings,
  ArrowRight,
  AlertTriangle,
  Coins,
  Activity,
  TrendingUp,
  Copy,
  CheckCheck,
  RefreshCw,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { AuthService } from "../../auth/authService";
import { WalletResolver, type ChainWallet } from "../../pairing/walletResolver";
import { isDeviceLinkedOnChain } from "../../pairing/deviceLink";
import { WebAuthnService } from "../../passkey/webauthnService";
import { getActiveChainId, setActiveChainId } from "../../core/activeChain";
import { getNetwork, type ExtChainId } from "../../core/networks";
import { getWalletTokens, type TokenItem, type WalletBalances } from "../../data/balances";
import { listActivity, type ActivityItem } from "../../data/activity";
import { getPendingTxs, type PendingTx } from "../../data/pendingTxs";
import { getTopAssets, type MarketAsset } from "../../data/market";
import { computeTotalChange24h } from "../../data/change24h";
import {
  Logo,
  ChainPicker,
  IconButton,
  Button,
  Spinner,
  EmptyState,
  BalanceHero,
  Tabs,
  ListRow,
  TokenIcon,
  Pill,
} from "../ui/index";
import { TokenDetailView } from "./TokenDetailView";
import { TransactionDetailView } from "./TransactionDetailView";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const USD_FMT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(n: number): string {
  return USD_FMT.format(n);
}

function formatAmount(n: number, decimals = 4): string {
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '—';
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return diffMin <= 1 ? "just now" : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  return `${diffDay}d ago`;
}

function activityLabel(item: ActivityItem): string {
  const dir = item.direction?.toLowerCase() ?? "";
  const type = item.type?.toLowerCase() ?? "";
  if (item.status?.toLowerCase() === "pending") return "Pending…";
  if (type === "approve") {
    const origin = item.tokenSymbol ? `· ${item.tokenSymbol}` : "";
    return `Approve ${origin}`.trim();
  }
  if (dir === "in" || dir === "received") return "Received";
  if (dir === "out" || dir === "sent") {
    return item.tokenSymbol ? `Sent · ${item.tokenSymbol}` : "Sent";
  }
  return type.charAt(0).toUpperCase() + type.slice(1) || "Transaction";
}

function activityAmountDisplay(item: ActivityItem): { value: string; cls: string } {
  const dir = item.direction?.toLowerCase() ?? "";
  const type = item.type?.toLowerCase() ?? "";
  if (type === "approve") return { value: item.tokenSymbol ?? "—", cls: "text-[color:var(--text-3)]" };
  if (!item.amountDisplay) return { value: "—", cls: "text-[color:var(--text-3)]" };
  if (dir === "in" || dir === "received") return { value: `+${item.amountDisplay}`, cls: "text-[#34D399]" };
  if (dir === "out" || dir === "sent") return { value: `−${item.amountDisplay}`, cls: "text-[#E8654F]" };
  return { value: item.amountDisplay, cls: "text-[color:var(--text)]" };
}

function ActivityIcon({ item }: { item: ActivityItem }) {
  const dir = item.direction?.toLowerCase() ?? "";
  const type = item.type?.toLowerCase() ?? "";
  const status = item.status?.toLowerCase() ?? "";

  if (status === "pending") {
    return (
      <div
        className="grid place-items-center rounded-full"
        style={{ width: 34, height: 34, background: "rgba(124,58,237,.13)", color: "#7C3AED" }}
      >
        <Loader2 size={15} strokeWidth={1.9} className="animate-spin" />
      </div>
    );
  }

  if (status === "failed" || status === "reverted") {
    return (
      <div
        className="grid place-items-center rounded-full"
        style={{ width: 34, height: 34, background: "rgba(245,158,11,.13)", color: "#F59E0B" }}
      >
        <AlertTriangle size={15} strokeWidth={1.9} />
      </div>
    );
  }
  if (type === "approve") {
    return (
      <div
        className="grid place-items-center rounded-full"
        style={{ width: 34, height: 34, background: "rgba(124,58,237,.15)", color: "#7C3AED" }}
      >
        <ArrowRight size={15} strokeWidth={1.9} />
      </div>
    );
  }
  if (dir === "in" || dir === "received") {
    return (
      <div
        className="grid place-items-center rounded-full"
        style={{ width: 34, height: 34, background: "rgba(52,211,153,.13)", color: "#34D399" }}
      >
        <ArrowDownLeft size={15} strokeWidth={1.9} />
      </div>
    );
  }
  // sent / default
  return (
    <div
      className="grid place-items-center rounded-full"
      style={{ width: 34, height: 34, background: "rgba(20,16,27,.6)", color: "var(--text-2)" }}
    >
      <ArrowUpRight size={15} strokeWidth={1.9} />
    </div>
  );
}

/** Minimal inline sparkline for market rows (48×20). Uses real price data when
 *  available, else a simple up/down shape derived from the 24h change. */
function MiniSpark({ change24h, data }: { change24h: number; data?: number[] }) {
  const color = change24h >= 0 ? "#34D399" : "#E8654F";
  const W = 48, H = 20, PAD = 2;

  let d: string;
  if (data && data.length >= 2) {
    // Downsample to ~16 points for a clean tiny line
    const step = Math.max(1, Math.floor(data.length / 16));
    const pts = data.filter((_, i) => i % step === 0);
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const range = max - min || 1;
    d = pts
      .map((p, i) => {
        const x = PAD + (i / (pts.length - 1)) * (W - PAD * 2);
        const y = PAD + (H - PAD * 2) - ((p - min) / range) * (H - PAD * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  } else {
    const fallback = change24h >= 0
      ? [[0, 16], [12, 14], [22, 17], [34, 9], [44, 11], [48, 4]]
      : [[0, 8], [12, 11], [22, 9], [34, 15], [44, 13], [48, 18]];
    d = fallback.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]} ${p[1]}`).join(" ");
  }

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block" }}>
      <path d={d} stroke={color} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Tab sub-panels ───────────────────────────────────────────────────────────

function TokensTab({
  balances,
  loading,
  onSelectToken,
  marketIndex,
}: {
  balances: WalletBalances | null;
  loading: boolean;
  onSelectToken: (token: TokenItem) => void;
  marketIndex: Map<string, MarketAsset>;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--text-2)" }}>
        <Spinner size={16} />
        <span className="text-[12.5px]">Loading tokens…</span>
      </div>
    );
  }
  if (!balances || balances.tokens.length === 0) {
    return (
      <EmptyState
        icon={<Coins size={20} strokeWidth={1.9} />}
        title="No tokens yet"
        subtitle="Your token balances will appear here once you have funds."
      />
    );
  }
  return (
    <div>
      {balances.tokens.map((token, idx) => {
        const isLast = idx === balances.tokens.length - 1;
        const changeCls =
          token.change24h === undefined
            ? "text-[color:var(--text-3)]"
            : token.change24h > 0
            ? "text-[#34D399]"
            : token.change24h < 0
            ? "text-[#E8654F]"
            : "text-[color:var(--text-3)]";
        const changeStr =
          token.change24h === undefined
            ? "—"
            : `${token.change24h >= 0 ? "+" : ""}${token.change24h.toFixed(1)}%`;

        const iconUrl = marketIndex.get(token.symbol.toUpperCase())?.iconUrl;
        return (
          <ListRow
            key={token.address}
            last={isLast}
            icon={<TokenIcon symbol={token.symbol} src={iconUrl} />}
            name={token.name}
            sub={`${formatAmount(token.amount)} ${token.symbol}`}
            value={formatUsd(token.valueUsd)}
            valueSub={changeStr}
            valueClass={changeCls}
            onClick={() => onSelectToken(token)}
          />
        );
      })}
    </div>
  );
}

function ActivityTab({
  items,
  loading,
  chainId,
  onSelectItem,
}: {
  items: ActivityItem[];
  loading: boolean;
  chainId: ExtChainId;
  onSelectItem: (item: ActivityItem) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--text-2)" }}>
        <Spinner size={16} />
        <span className="text-[12.5px]">Loading activity…</span>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Activity size={20} strokeWidth={1.9} />}
        title="No activity yet"
        subtitle="Your transaction history will appear here."
      />
    );
  }
  return (
    <div>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const label = activityLabel(item);
        const { value: amtValue, cls: amtCls } = activityAmountDisplay(item);
        const statusLabel = item.status
          ? item.status.charAt(0).toUpperCase() + item.status.slice(1)
          : "";
        const timeSub = [relativeTime(item.createdAt), statusLabel]
          .filter(Boolean)
          .join(" · ");
        const valueSub = item.paymasterUsed ? "gas sponsored" : undefined;

        return (
          <ListRow
            key={item.id}
            last={isLast}
            icon={<ActivityIcon item={item} />}
            name={label}
            sub={timeSub}
            value={amtValue}
            valueSub={valueSub}
            valueClass={amtCls}
            onClick={() => onSelectItem(item)}
          />
        );
      })}
    </div>
  );
}

// Tighter market row: name capped, price + spark + % grouped on right.
function MarketRow({
  asset,
  last,
  onClick,
}: {
  asset: MarketAsset;
  last: boolean;
  onClick?: () => void;
}) {
  const changeCls =
    asset.change24h > 0
      ? "text-[#34D399]"
      : asset.change24h < 0
      ? "text-[#E8654F]"
      : "text-[color:var(--text-3)]";
  const changeStr = `${asset.change24h >= 0 ? "+" : ""}${asset.change24h.toFixed(1)}%`;

  return (
    <div
      className="flex items-center gap-2 py-[9px] transition-all duration-[150ms] cursor-pointer"
      style={{
        borderBottom: last ? "none" : "1px solid rgba(124,58,237,.07)",
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "rgba(124,58,237,.04)";
        el.style.margin = "0 -8px";
        el.style.paddingLeft = "8px";
        el.style.paddingRight = "8px";
        el.style.borderRadius = "10px";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background = "";
        el.style.margin = "";
        el.style.paddingLeft = "";
        el.style.paddingRight = "";
        el.style.borderRadius = "";
      }}
    >
      {/* Icon */}
      <div className="flex-none">
        <TokenIcon symbol={asset.symbol} src={asset.iconUrl} />
      </div>

      {/* Name + symbol — max-width so right group stays close */}
      <div className="min-w-0" style={{ flex: "1 1 0", maxWidth: 110 }}>
        <div
          className="text-[12.5px] font-semibold truncate"
          style={{ color: "var(--text)" }}
        >
          {asset.name}
        </div>
        <div
          className="text-[11px] font-semibold uppercase"
          style={{ color: "var(--text-3)" }}
        >
          {asset.symbol}
        </div>
      </div>

      {/* Right group: price + spark + % — tightly grouped */}
      <div className="flex items-center gap-[6px] ml-auto flex-none">
        <div className="text-right">
          <div
            className="text-[12.5px] font-semibold font-mono"
            style={{ color: "var(--text)" }}
          >
            {formatUsd(asset.priceUsd)}
          </div>
          <div className={`text-[11px] font-mono font-semibold ${changeCls}`}>
            {changeStr}
          </div>
        </div>
        <MiniSpark change24h={asset.change24h} data={asset.sparkline} />
      </div>
    </div>
  );
}

// ─── Quick-action button ──────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 flex flex-col items-center gap-[7px] py-[13px] px-[6px] rounded-[14px] cursor-pointer transition-all duration-[160ms] border-0 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: "rgba(26,21,35,.6)",
        border: "1px solid rgba(124,58,237,.07)",
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,.5)";
          (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(124,58,237,.07)";
        (e.currentTarget as HTMLButtonElement).style.transform = "";
      }}
    >
      <span
        className="grid place-items-center rounded-[11px]"
        style={{ width: 34, height: 34, background: "rgba(124,58,237,.15)", color: "#7C3AED" }}
      >
        {icon}
      </span>
      <span className="text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>
        {label}
      </span>
    </button>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

interface HomeScreenProps {
  onGoToPair: (hint?: string) => void;
  onReceive?: () => void;
  /** Pass the token symbol so SendScreen can pre-select it. */
  onSend?: (defaultSymbol?: string) => void;
  onSettings?: () => void;
}

type TabId = "tokens" | "activity" | "market";

// What's currently shown in the detail overlay
type DetailView =
  | { type: "market"; asset: MarketAsset }
  | { type: "holding"; token: TokenItem }
  | { type: "activity"; item: ActivityItem }
  | null;

export function HomeScreen({
  onGoToPair,
  onReceive,
  onSend,
  onSettings,
}: HomeScreenProps) {
  // ── Chain / wallet state ──────────────────────────────────────────────────
  const [chainId, setChainId] = useState<ExtChainId | null>(null);
  const [wallet, setWallet] = useState<ChainWallet | null | undefined>(undefined);
  const [linked, setLinked] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Generation counters — prevent stale data overwriting on rapid chain switch ──
  const balanceGenRef = useRef(0);
  const activityGenRef = useRef(0);

  // ── Address copy ──────────────────────────────────────────────────────────
  const [addrCopied, setAddrCopied] = useState(false);

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("tokens");

  // ── Detail view state (unified) ───────────────────────────────────────────
  const [detailView, setDetailView] = useState<DetailView>(null);

  // ── Data state ────────────────────────────────────────────────────────────
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [marketAssets, setMarketAssets] = useState<MarketAsset[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketQuery, setMarketQuery] = useState("");

  // ── Load chain/wallet ─────────────────────────────────────────────────────
  const load = useCallback(async (cid?: ExtChainId) => {
    setLoading(true);
    setLinked(null);
    setBalances(null);
    try {
      const user = await AuthService.getUser();
      if (!user) return;
      const activeChainId = cid ?? (await getActiveChainId());
      setChainId(activeChainId);
      const w = await WalletResolver.getForChain(user.id, activeChainId);
      setWallet(w);
      if (w?.isDeployed) {
        const meta = await WebAuthnService.getStored();
        if (meta) {
          const ok = await isDeviceLinkedOnChain(
            activeChainId,
            w.address,
            meta.credentialIdRaw as `0x${string}`,
          ).catch(() => false);
          setLinked(ok);
        } else {
          setLinked(false);
        }

        // Increment generation so a slow in-flight fetch from the previous
        // chain does not overwrite fresh data for the current chain.
        const gen = ++balanceGenRef.current;
        setBalancesLoading(true);
        getWalletTokens(w.address as `0x${string}`, activeChainId)
          .then((result) => { if (gen === balanceGenRef.current) setBalances(result); })
          .finally(() => { if (gen === balanceGenRef.current) setBalancesLoading(false); });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Refresh balances manually ─────────────────────────────────────────────
  const refreshBalances = useCallback(() => {
    if (!wallet?.isDeployed || !chainId) return;
    const gen = ++balanceGenRef.current;
    setBalancesLoading(true);
    getWalletTokens(wallet.address as `0x${string}`, chainId)
      .then((result) => { if (gen === balanceGenRef.current) setBalances(result); })
      .finally(() => { if (gen === balanceGenRef.current) setBalancesLoading(false); });
  }, [wallet, chainId]);

  // ── Copy wallet address ───────────────────────────────────────────────────
  const copyAddr = useCallback(async () => {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setAddrCopied(true);
      setTimeout(() => setAddrCopied(false), 2000);
    } catch { /* clipboard denied */ }
  }, [wallet?.address]);

  // ── Load activity when wallet/chain changes — merges pending txs ──────────
  useEffect(() => {
    if (!wallet?.isDeployed || !chainId) return;
    setActivity([]);
    setActivityLoading(true);
    const gen = ++activityGenRef.current;
    Promise.all([
      listActivity(wallet.address, chainId, 25),
      getPendingTxs(chainId),
    ]).then(([confirmed, pending]) => {
      if (gen !== activityGenRef.current) return;
      // Convert PendingTx → ActivityItem shape for unified rendering
      const confirmedHashes = new Set(confirmed.map((i) => i.userOpHash).filter(Boolean));
      const pendingItems: ActivityItem[] = (pending as PendingTx[])
        .filter((p) => !confirmedHashes.has(p.userOpHash))
        .map((p) => ({
          id: p.id,
          type: "transfer",
          status: "pending",
          direction: "outgoing",
          tokenSymbol: "ETH",
          amountDisplay: null,
          transactionHash: null,
          userOpHash: p.userOpHash,
          paymasterUsed: true,
          createdAt: new Date(p.submittedAt).toISOString(),
          fromAddress: null,
          toAddress: p.toAddress,
          blockNumber: null,
          fee: null,
        }));
      setActivity([...pendingItems, ...confirmed]);
    }).finally(() => { if (gen === activityGenRef.current) setActivityLoading(false); });
  }, [wallet, chainId]);

  // ── Load market once ──────────────────────────────────────────────────────
  useEffect(() => {
    setMarketLoading(true);
    getTopAssets(20)
      .then(setMarketAssets)
      .finally(() => setMarketLoading(false));
  }, []);

  // ── Chain switching (via dropdown) ────────────────────────────────────────
  const handleChainSelect = async (newChainId: ExtChainId) => {
    if (newChainId === chainId) return;
    await setActiveChainId(newChainId);
    setWallet(undefined);
    void load(newChainId);
  };

  const chainName = chainId ? getNetwork(chainId).name : "…";

  // ── Pending tx count for Activity tab badge ───────────────────────────────
  const pendingCount = activity.filter((a) => a.status?.toLowerCase() === "pending").length;

  // ── Compute 24h change from balances (memoized) ──────────────────────────
  const change24h = useMemo(
    () => balances
      ? computeTotalChange24h(
          balances.tokens.map((t: TokenItem) => ({
            value: t.valueUsd,
            changePct24h: t.change24h ?? null,
          })),
        )
      : null,
    [balances],
  );

  // ── Build market index for held-token detail join (memoized) ─────────────
  const marketIndex = useMemo(() => {
    const m = new Map<string, MarketAsset>();
    for (const a of marketAssets) m.set(a.symbol.toUpperCase(), a);
    if (!m.has("WETH") && m.has("ETH")) m.set("WETH", m.get("ETH")!);
    return m;
  }, [marketAssets]);

  // ── Filter market list by search query (name or symbol) ──────────────────
  const filteredMarket = useMemo(() => {
    const q = marketQuery.trim().toLowerCase();
    if (!q) return marketAssets;
    return marketAssets.filter(
      (a) => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q),
    );
  }, [marketAssets, marketQuery]);

  // ── Detail view overrides ─────────────────────────────────────────────────
  if (detailView?.type === "market") {
    return (
      <TokenDetailView
        detail={{ mode: "market", asset: detailView.asset }}
        onBack={() => setDetailView(null)}
      />
    );
  }

  if (detailView?.type === "holding") {
    const token = detailView.token;
    const marketAsset = marketIndex.get(token.symbol.toUpperCase());
    return (
      <TokenDetailView
        detail={{ mode: "holding", token, marketAsset }}
        onBack={() => setDetailView(null)}
        onSend={onSend ? () => onSend(token.symbol) : undefined}
        onReceive={onReceive}
      />
    );
  }

  if (detailView?.type === "activity" && chainId) {
    return (
      <TransactionDetailView
        item={detailView.item}
        chainId={chainId}
        onBack={() => setDetailView(null)}
      />
    );
  }

  return (
    <div
      className="flex flex-col min-h-screen font-sans"
      style={{ background: "var(--surface)", color: "var(--text)" }}
    >
      <div className="flex-1 p-4 pb-6">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-[8px]">
          <div className="flex items-center gap-[9px]">
            <Logo size={26} />
            <b className="text-[15px] font-semibold tracking-tight">Trezo</b>
          </div>
          <div className="flex items-center gap-2">
            <ChainPicker
              activeChainId={chainId}
              onSelect={(id) => { void handleChainSelect(id); }}
            />
            <IconButton
              title="Settings"
              onClick={onSettings}
            >
              <Settings size={16} strokeWidth={1.9} />
            </IconButton>
          </div>
        </div>

        {/* ── Sub-header: address + refresh ────────────────────────────── */}
        {wallet?.address && (
          <div className="flex items-center justify-end mb-[12px]">
            <div className="flex items-center gap-[6px]">
              <button
                type="button"
                onClick={() => { void copyAddr(); }}
                title={addrCopied ? "Copied!" : "Copy address"}
                className="flex items-center gap-[5px] px-[8px] py-[4px] rounded-[8px] border-0 cursor-pointer transition-all duration-[150ms]"
                style={{
                  background: addrCopied ? "rgba(52,211,153,.1)" : "rgba(124,58,237,.08)",
                  border: `1px solid ${addrCopied ? "rgba(52,211,153,.25)" : "rgba(124,58,237,.14)"}`,
                }}
              >
                <span className="font-mono text-[11px]" style={{ color: "var(--text-2)" }}>
                  {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
                </span>
                {addrCopied
                  ? <CheckCheck size={11} strokeWidth={2} style={{ color: "#34D399" }} />
                  : <Copy size={11} strokeWidth={1.9} style={{ color: "var(--text-3)" }} />
                }
              </button>
              {/* Refresh only makes sense when balances exist (deployed wallet) */}
              {wallet.isDeployed && (
                <button
                  type="button"
                  onClick={refreshBalances}
                  title="Refresh balances"
                  className="flex items-center justify-center rounded-[8px] border-0 cursor-pointer transition-all duration-[150ms]"
                  style={{
                    width: 26,
                    height: 26,
                    background: "rgba(124,58,237,.08)",
                    border: "1px solid rgba(124,58,237,.14)",
                    color: "var(--text-3)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
                >
                  <RefreshCw
                    size={12}
                    strokeWidth={1.9}
                    style={balancesLoading ? { animation: "spin 1s linear infinite" } : {}}
                  />
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Loading skeleton ─────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center gap-2 mt-4" style={{ color: "var(--text-2)" }}>
            <Spinner size={14} />
            <span className="text-[13px]">Loading…</span>
          </div>
        )}

        {/* ── No wallet on this chain ──────────────────────────────────── */}
        {!loading && wallet === null && (
          <EmptyState
            icon={<Coins size={20} strokeWidth={1.9} />}
            title={`No account on ${chainName} yet`}
            subtitle="Deploy your wallet on this chain in the Trezo mobile app, then pair this device."
            action={
              <Button variant="primary" onClick={() => onGoToPair()}>
                Pair this device
              </Button>
            }
          />
        )}

        {/* ── Wallet exists but not deployed ──────────────────────────── */}
        {!loading && wallet && !wallet.isDeployed && (
          <EmptyState
            icon={<AlertTriangle size={20} strokeWidth={1.9} />}
            title={`Not active on ${chainName}`}
            subtitle="Deploy your account in the Trezo mobile app first."
          />
        )}

        {/* ── Deployed wallet ──────────────────────────────────────────── */}
        {!loading && wallet?.isDeployed && (
          <div className="flex flex-col gap-3">
            {/* Device not linked — prominent CTA above content */}
            {linked === false && (
              <div
                className="rounded-[13px] p-3 flex flex-col gap-2"
                style={{
                  background: "rgba(245,158,11,.08)",
                  border: "1px solid rgba(245,158,11,.18)",
                }}
              >
                <p className="text-[12.5px]" style={{ color: "#F59E0B" }}>
                  This device isn&apos;t linked on {chainName} — signing is unavailable.
                </p>
                <Button
                  variant="primary"
                  onClick={() =>
                    onGoToPair(
                      `On your phone, switch to ${chainName}, then Profile → Devices → Pair New Device, and paste the code here.`,
                    )
                  }
                >
                  Link this device on {chainName}
                </Button>
              </div>
            )}

            {/* Device linked indicator */}
            {linked === true && (
              <Pill tone="ok">Linked on {chainName}</Pill>
            )}

            {/* Balance hero */}
            <BalanceHero
              totalUsd={balancesLoading ? "—" : formatUsd(balances?.totalUsd ?? 0)}
              change24hPct={balancesLoading ? undefined : change24h?.pct}
            />

            {/* Quick actions */}
            <div className="flex gap-2">
              <QuickAction
                icon={<ArrowDownLeft size={17} strokeWidth={1.9} />}
                label="Receive"
                onClick={onReceive}
                disabled={!onReceive}
              />
              <QuickAction
                icon={<ArrowUpRight size={17} strokeWidth={1.9} />}
                label="Send"
                onClick={onSend}
                disabled={!onSend}
              />
              <QuickAction
                icon={<List size={17} strokeWidth={1.9} />}
                label="Activity"
                onClick={() => setActiveTab("activity")}
              />
            </div>

            {/* Tabs */}
            <Tabs
              items={[
                { label: "Tokens", value: "tokens" },
                { label: pendingCount > 0 ? `Activity (${pendingCount})` : "Activity", value: "activity" },
                { label: "Market", value: "market" },
              ]}
              value={activeTab}
              onChange={(v) => setActiveTab(v as TabId)}
            />

            {/* Tab panels */}
            {activeTab === "tokens" && (
              <TokensTab
                balances={balances}
                loading={balancesLoading}
                onSelectToken={(token) => setDetailView({ type: "holding", token })}
                marketIndex={marketIndex}
              />
            )}

            {activeTab === "activity" && chainId && (
              <ActivityTab
                items={activity}
                loading={activityLoading}
                chainId={chainId}
                onSelectItem={(item) => setDetailView({ type: "activity", item })}
              />
            )}

            {activeTab === "market" && (
              <>
                {/* Search box */}
                {(marketAssets.length > 0 || marketQuery) && (
                  <div
                    className="flex items-center gap-2 px-[10px] rounded-[11px] mb-1"
                    style={{
                      height: 36,
                      background: "rgba(12,10,16,.85)",
                      border: "1px solid rgba(124,58,237,.16)",
                    }}
                  >
                    <Search size={14} strokeWidth={1.9} style={{ color: "var(--text-3)", flex: "none" }} />
                    <input
                      type="text"
                      value={marketQuery}
                      onChange={(e) => setMarketQuery(e.target.value)}
                      placeholder="Search coins (name or symbol)…"
                      className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[12.5px]"
                      style={{ color: "var(--text)" }}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    {marketQuery && (
                      <button
                        type="button"
                        onClick={() => setMarketQuery("")}
                        aria-label="Clear search"
                        className="grid place-items-center rounded-full border-0 cursor-pointer flex-none"
                        style={{ width: 18, height: 18, background: "rgba(124,58,237,.15)", color: "var(--text-2)" }}
                      >
                        <X size={11} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                )}

                {marketLoading && (
                  <div className="flex items-center justify-center py-8 gap-2" style={{ color: "var(--text-2)" }}>
                    <Spinner size={16} />
                    <span className="text-[12.5px]">Loading market…</span>
                  </div>
                )}
                {!marketLoading && marketAssets.length === 0 && (
                  <EmptyState
                    icon={<TrendingUp size={20} strokeWidth={1.9} />}
                    title="Market data unavailable"
                    subtitle="Could not load live prices right now."
                  />
                )}
                {!marketLoading && marketAssets.length > 0 && filteredMarket.length === 0 && (
                  <EmptyState
                    icon={<Search size={20} strokeWidth={1.9} />}
                    title="No coins match"
                    subtitle={`Nothing found for “${marketQuery.trim()}”.`}
                  />
                )}
                {!marketLoading && filteredMarket.length > 0 && (
                  <div>
                    {filteredMarket.map((asset, idx) => (
                      <MarketRow
                        key={asset.id}
                        asset={asset}
                        last={idx === filteredMarket.length - 1}
                        onClick={() => setDetailView({ type: "market", asset })}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
