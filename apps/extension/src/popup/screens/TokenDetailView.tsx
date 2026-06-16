/**
 * TokenDetailView.tsx — Detail view for a market asset OR a held portfolio token.
 *
 * Modes:
 *  • mode="market"  — opened from the Market tab; shows price/chart/stats.
 *  • mode="holding" — opened from the Tokens tab; shows balance/value prominently,
 *                     then joins the market feed for price/24h/sparkline, and
 *                     provides Send / Receive quick actions.
 *
 * Both modes share: icon, name/symbol, sparkline chart, CoinGecko + Buy links.
 */

import { useEffect, useId, useState } from "react";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, TrendingUp, ExternalLink } from "lucide-react";
import { Spinner } from "../ui/Spinner";
import type { MarketAsset } from "../../data/market";
import type { TokenItem } from "../../data/balances";
import { TokenIcon } from "../ui/index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUsd(n: number, compact = false): string {
  if (compact) {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toFixed(2)}`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: n >= 1 ? 2 : 6,
  }).format(n);
}

function formatAmount(n: number, decimals = 4): string {
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

// ─── CoinGecko slug mapping ───────────────────────────────────────────────────

const COINGECKO_SLUGS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "weth",
  USDC: "usd-coin",
  USDT: "tether",
  BTC: "bitcoin",
  WBTC: "wrapped-bitcoin",
  SOL: "solana",
  BNB: "binancecoin",
  LINK: "chainlink",
  MATIC: "matic-network",
  AVAX: "avalanche-2",
  DOT: "polkadot",
  UNI: "uniswap",
  AAVE: "aave",
  DAI: "dai",
  LTC: "litecoin",
  XRP: "ripple",
  ADA: "cardano",
  ATOM: "cosmos",
  ALGO: "algorand",
};

function coingeckoSlug(symbol: string, coinId?: string): string {
  const upper = symbol.toUpperCase();
  // Prefer explicit map; then try coinId (CoinCap ids are often the same as CoinGecko slugs)
  return COINGECKO_SLUGS[upper] ?? coinId ?? symbol.toLowerCase();
}

function coingeckoUrl(symbol: string, coinId?: string): string {
  const slug = coingeckoSlug(symbol, coinId);
  return `https://www.coingecko.com/en/coins/${slug}`;
}

function coingeckoBuyUrl(symbol: string, coinId?: string): string {
  const slug = coingeckoSlug(symbol, coinId);
  return `https://www.coingecko.com/en/coins/${slug}#markets`;
}

function openExternal(url: string) {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    void chrome.tabs.create({ url });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

// ─── CoinGecko history fetch ──────────────────────────────────────────────────

interface HistoryPoint {
  time: number;
  price: number;
}

async function fetchHistory(coinId: string, days: number, signal?: AbortSignal): Promise<HistoryPoint[]> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`,
      { signal: signal ?? AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`CoinGecko chart ${res.status}`);
    const json = (await res.json()) as { prices?: [number, number][] };
    return (json.prices ?? []).map(([time, price]) => ({ time, price: price || 0 }));
  } catch {
    return [];
  }
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  points,
  color,
  width = 280,
  height = 72,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  // Stable unique gradient id (hook must run before any early return).
  const fillId = `sf-${useId().replace(/:/g, "")}`;
  if (points.length < 2) return null;

  const minP = Math.min(...points);
  const maxP = Math.max(...points);
  const range = maxP - minP || 1;
  const pad = 4;
  const innerH = height - pad * 2;
  const step = (width - pad * 2) / (points.length - 1);

  const coords = points.map((p, i) => [
    pad + i * step,
    pad + innerH - ((p - minP) / range) * innerH,
  ]);

  const d = coords
    .map((c, i) => `${i === 0 ? "M" : "L"}${c[0].toFixed(1)} ${c[1].toFixed(1)}`)
    .join(" ");

  const area =
    d +
    ` L${coords[coords.length - 1][0].toFixed(1)} ${height} L${coords[0][0].toFixed(1)} ${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${fillId})`} />
      <path d={d} stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── StatRow ──────────────────────────────────────────────────────────────────

function StatRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <div
      className="flex justify-between items-center py-[10px]"
      style={{ borderBottom: last ? "none" : "1px solid rgba(124,58,237,.07)" }}
    >
      <span className="text-[11.5px] uppercase tracking-wide font-semibold" style={{ color: "var(--text-3)" }}>
        {label}
      </span>
      <span className="text-[13px] font-semibold font-mono" style={{ color: "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}

// ─── Period selector ──────────────────────────────────────────────────────────

const PERIODS: { label: "1D" | "1W" | "1M"; days: number }[] = [
  { label: "1D", days: 1 },
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
];

// ─── External link button ─────────────────────────────────────────────────────

function ExternalLinkButton({
  label,
  url,
  variant = "secondary",
}: {
  label: string;
  url: string;
  variant?: "primary" | "secondary";
}) {
  const [hovered, setHovered] = useState(false);
  const isPrimary = variant === "primary";
  return (
    <button
      type="button"
      onClick={() => openExternal(url)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-[5px] px-[10px] py-[6px] rounded-[9px] text-[11.5px] font-semibold cursor-pointer border-0 transition-all duration-150"
      style={{
        background: isPrimary
          ? hovered ? "rgba(124,58,237,.30)" : "rgba(124,58,237,.18)"
          : hovered ? "rgba(124,58,237,.12)" : "rgba(124,58,237,.06)",
        color: isPrimary ? "#A78BFA" : "var(--text-2)",
        border: `1px solid ${isPrimary ? "rgba(124,58,237,.28)" : "rgba(124,58,237,.14)"}`,
      }}
    >
      {label}
      <ExternalLink size={10} strokeWidth={2} />
    </button>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex-1 flex flex-col items-center gap-[7px] py-[13px] px-[6px] rounded-[14px] cursor-pointer border-0 transition-all duration-[160ms] disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: "rgba(26,21,35,.6)",
        border: `1px solid ${hovered && onClick ? "rgba(124,58,237,.5)" : "rgba(124,58,237,.07)"}`,
        transform: hovered && onClick ? "translateY(-1px)" : "",
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

// ─── Props ────────────────────────────────────────────────────────────────────

export type TokenDetailMode =
  | { mode: "market"; asset: MarketAsset }
  | { mode: "holding"; token: TokenItem; marketAsset?: MarketAsset };

export interface TokenDetailViewProps {
  detail: TokenDetailMode;
  onBack: () => void;
  onSend?: () => void;
  onReceive?: () => void;
}

// Legacy compat: old callers pass `asset` + `onBack` directly.
interface LegacyProps {
  asset: MarketAsset;
  onBack: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TokenDetailView(props: TokenDetailViewProps | LegacyProps) {
  // Normalise legacy call-site (HomeScreen passes `asset` directly)
  const isLegacy = "asset" in props && !("detail" in props);
  const normalised: TokenDetailViewProps = isLegacy
    ? { detail: { mode: "market", asset: (props as LegacyProps).asset }, onBack: (props as LegacyProps).onBack }
    : (props as TokenDetailViewProps);

  const { detail, onBack, onSend, onReceive } = normalised;

  // Derive display values from mode
  const isHolding = detail.mode === "holding";
  const symbol = isHolding ? detail.token.symbol : detail.asset.symbol;
  const name   = isHolding ? detail.token.name   : detail.asset.name;

  // For market: use asset directly; for holding: prefer joined marketAsset
  const marketAsset: MarketAsset | undefined = isHolding
    ? detail.marketAsset
    : detail.asset;

  // CoinGecko id for history + slugs; real logo URL for the icon
  const coinId = marketAsset?.id;
  const iconUrl = marketAsset?.iconUrl;
  const sparkSeed = marketAsset?.sparkline;

  const priceUsd  = isHolding ? (marketAsset?.priceUsd  ?? detail.token.priceUsd)  : detail.asset.priceUsd;
  const change24h = isHolding ? (marketAsset?.change24h ?? detail.token.change24h ?? 0) : detail.asset.change24h;
  const rank      = marketAsset?.rank ?? 0;

  // Seed the chart from the embedded 7-day sparkline so it renders instantly.
  const [history, setHistory] = useState<HistoryPoint[]>(
    sparkSeed && sparkSeed.length >= 2 ? sparkSeed.map((p, i) => ({ time: i, price: p })) : [],
  );
  const [historyLoading, setHistoryLoading] = useState(!(sparkSeed && sparkSeed.length >= 2));
  const [noHistory, setNoHistory] = useState(false);
  const [period, setPeriod] = useState<"1D" | "1W" | "1M">("1W");

  useEffect(() => {
    if (!coinId) {
      setHistoryLoading(false);
      setNoHistory(!(sparkSeed && sparkSeed.length >= 2));
      return;
    }
    // 1W is already covered by the embedded 7-day sparkline — skip the API call.
    if (period === "1W" && sparkSeed && sparkSeed.length >= 2) {
      setHistory(sparkSeed.map((p, i) => ({ time: i, price: p })));
      setNoHistory(false);
      setHistoryLoading(false);
      return;
    }
    const controller = new AbortController();
    setHistoryLoading(true);
    setNoHistory(false);
    const meta = PERIODS.find((p) => p.label === period) ?? PERIODS[1];
    fetchHistory(coinId, meta.days, controller.signal)
      .then((pts) => {
        if (controller.signal.aborted) return; // period changed / unmounted
        setHistory(pts);
        setNoHistory(pts.length < 2);
      })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [coinId, period]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeCls = change24h >= 0 ? "text-[#34D399]" : "text-[#E8654F]";
  const sparkColor = change24h >= 0 ? "#34D399" : "#E8654F";
  const changeStr = `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}%`;

  const slicedHistory = history.map((p) => p.price);

  const cgUrl  = coingeckoUrl(symbol, coinId);
  const buyUrl = coingeckoBuyUrl(symbol, coinId);

  return (
    <div
      className="flex flex-col min-h-screen font-sans"
      style={{ background: "var(--surface)", color: "var(--text)" }}
    >
      <div className="flex-1 p-4 pb-6">
        {/* ── Back + header ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            className="grid place-items-center rounded-[10px] transition-colors duration-150 border-0 cursor-pointer"
            style={{
              width: 32,
              height: 32,
              background: "rgba(124,58,237,.10)",
              color: "#7C3AED",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,.20)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,.10)";
            }}
          >
            <ArrowLeft size={15} strokeWidth={2} />
          </button>
          <div className="flex items-center gap-[9px]">
            <TokenIcon symbol={symbol} src={iconUrl} size={28} />
            <div>
              <div className="text-[14px] font-bold leading-tight" style={{ color: "var(--text)" }}>
                {name}
              </div>
              <div className="text-[11.5px] font-semibold uppercase" style={{ color: "var(--text-3)" }}>
                {symbol}
              </div>
            </div>
          </div>
          {rank > 0 && (
            <div
              className="ml-auto flex items-center gap-1 rounded-full px-[8px] py-[3px] text-[11px] font-semibold"
              style={{ background: "rgba(124,58,237,.12)", color: "#7C3AED" }}
            >
              <TrendingUp size={10} strokeWidth={2} />
              #{rank}
            </div>
          )}
        </div>

        {/* ── Holding balance hero (only for holding mode) ──────────────── */}
        {isHolding && (
          <div
            className="rounded-[14px] p-3 mb-4"
            style={{ background: "rgba(124,58,237,.08)", border: "1px solid rgba(124,58,237,.16)" }}
          >
            <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: "var(--text-3)" }}>
              Your balance
            </div>
            <div className="text-[26px] font-black tracking-tight leading-none mb-[4px]" style={{ color: "var(--text)" }}>
              {formatUsd(detail.token.valueUsd)}
            </div>
            <div className="text-[13px] font-semibold font-mono" style={{ color: "var(--text-2)" }}>
              {formatAmount(detail.token.amount)} {symbol}
            </div>
          </div>
        )}

        {/* ── Price hero ──────────────────────────────────────────────────── */}
        <div className="mb-3">
          {!isHolding && (
            <div className="text-[28px] font-black tracking-tight leading-none mb-1" style={{ color: "var(--text)" }}>
              {formatUsd(priceUsd)}
            </div>
          )}
          {isHolding && priceUsd > 0 && (
            <div className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-2)" }}>
              {formatUsd(priceUsd)} <span style={{ color: "var(--text-3)", fontSize: 12 }}>per {symbol}</span>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[13px] font-bold rounded-lg px-[8px] py-[3px] ${changeCls}`}
              style={{
                background:
                  change24h >= 0
                    ? "rgba(52,211,153,.12)"
                    : "rgba(232,101,79,.12)",
              }}
            >
              {changeStr}
            </span>
            <span className="text-[11.5px]" style={{ color: "var(--text-3)" }}>
              24h
            </span>
            {/* CoinGecko + Buy links */}
            <div className="ml-auto flex items-center gap-[6px]">
              <ExternalLinkButton label="CoinGecko" url={cgUrl} variant="secondary" />
              <ExternalLinkButton label={`Buy ${symbol}`} url={buyUrl} variant="primary" />
            </div>
          </div>
        </div>

        {/* ── Send / Receive actions (holding mode only) ────────────────── */}
        {isHolding && (
          <div className="flex gap-2 mb-3">
            <ActionButton
              icon={<ArrowDownLeft size={17} strokeWidth={1.9} />}
              label="Receive"
              onClick={onReceive}
            />
            <ActionButton
              icon={<ArrowUpRight size={17} strokeWidth={1.9} />}
              label="Send"
              onClick={onSend}
            />
          </div>
        )}

        {/* ── Chart + period selector ──────────────────────────────────── */}
        <div
          className="rounded-[14px] p-3 mb-3"
          style={{ background: "rgba(20,16,27,.72)", border: "1px solid rgba(124,58,237,.13)" }}
        >
          {historyLoading ? (
            <div className="flex items-center justify-center gap-2" style={{ height: 72, color: "var(--text-3)" }}>
              <Spinner size={14} />
              <span className="text-[11.5px]">Loading chart…</span>
            </div>
          ) : noHistory ? (
            <div className="flex items-center justify-center" style={{ height: 72, color: "var(--text-3)" }}>
              <span className="text-[11.5px]">No price history available</span>
            </div>
          ) : (
            <Sparkline points={slicedHistory} color={sparkColor} width={272} height={72} />
          )}
          <div className="flex justify-center gap-2 mt-2">
            {PERIODS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setPeriod(p.label as "1D" | "1W" | "1M")}
                className="px-[10px] py-[4px] rounded-full text-[11px] font-bold border-0 cursor-pointer transition-colors duration-150"
                style={
                  period === p.label
                    ? { background: "rgba(124,58,237,.18)", color: "#7C3AED" }
                    : { background: "transparent", color: "var(--text-3)" }
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stats card ───────────────────────────────────────────────── */}
        <div
          className="rounded-[14px] px-3 pb-1"
          style={{ background: "rgba(20,16,27,.72)", border: "1px solid rgba(124,58,237,.13)" }}
        >
          <div
            className="text-[10px] uppercase tracking-widest font-bold pt-3 pb-1"
            style={{ color: "var(--text-3)" }}
          >
            {isHolding ? "Token Stats" : "Market Stats"}
          </div>
          {isHolding && (
            <>
              <StatRow label="Balance" value={`${formatAmount(detail.token.amount)} ${symbol}`} />
              <StatRow label="Value" value={formatUsd(detail.token.valueUsd)} />
            </>
          )}
          <StatRow label="Price" value={priceUsd > 0 ? formatUsd(priceUsd) : "—"} />
          <StatRow label="24h Change" value={changeStr} />
          <StatRow
            label="Rank"
            value={rank > 0 ? `#${rank}` : "Unranked"}
            last
          />
        </div>
      </div>
    </div>
  );
}
