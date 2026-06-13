/**
 * TransactionDetailView.tsx — Detail view for an activity item.
 *
 * Opened from the Activity tab when a transaction row is clicked.
 * Shows: status header, type/direction, amount+token, relative+absolute time,
 * from/to, userOpHash, transactionHash, paymaster, and explorer link.
 */

import { ArrowLeft, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { ActivityItem } from "../../data/activity";
import { getNetwork } from "../../core/networks";
import type { ExtChainId } from "../../core/networks";
import { Card, KV } from "../ui/index";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shorten(value: string | null | undefined, head = 8, tail = 6): string {
  if (!value) return "—";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatAbsDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoDate;
  }
}

function relativeTime(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return diffMin <= 1 ? "just now" : `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "Yesterday";
  return `${diffDay}d ago`;
}

function humanLabel(item: ActivityItem): string {
  const dir = item.direction?.toLowerCase() ?? "";
  const type = item.type?.toLowerCase() ?? "";
  if (type === "approve") return `Approve${item.tokenSymbol ? ` · ${item.tokenSymbol}` : ""}`;
  if (dir === "in" || dir === "received") return "Received";
  if (dir === "out" || dir === "sent") return item.tokenSymbol ? `Sent · ${item.tokenSymbol}` : "Sent";
  return type.charAt(0).toUpperCase() + type.slice(1) || "Transaction";
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusHeader({ status }: { status: string }) {
  const s = status.toLowerCase();
  const isConfirmed = s === "confirmed" || s === "success";
  const isFailed = s === "failed" || s === "reverted" || s === "cancelled";

  let icon: React.ReactNode;
  let color: string;
  let bg: string;

  if (isConfirmed) {
    icon = <CheckCircle2 size={20} strokeWidth={1.9} />;
    color = "#34D399";
    bg = "rgba(52,211,153,.12)";
  } else if (isFailed) {
    icon = <XCircle size={20} strokeWidth={1.9} />;
    color = "#E8654F";
    bg = "rgba(232,101,79,.12)";
  } else {
    icon = <Clock size={20} strokeWidth={1.9} />;
    color = "#F59E0B";
    bg = "rgba(245,158,11,.12)";
  }

  const label = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div
      className="flex items-center gap-2 rounded-[12px] px-3 py-[10px] mb-3"
      style={{ background: bg }}
    >
      <span style={{ color }}>{icon}</span>
      <span className="text-[13px] font-bold" style={{ color }}>
        {label}
      </span>
    </div>
  );
}

// ─── Amount display ───────────────────────────────────────────────────────────

function amountStr(item: ActivityItem): { value: string; cls: string } {
  const dir = item.direction?.toLowerCase() ?? "";
  const type = item.type?.toLowerCase() ?? "";
  if (type === "approve") return { value: item.tokenSymbol ?? "—", cls: "text-[color:var(--text)]" };
  if (!item.amountDisplay) return { value: "—", cls: "text-[color:var(--text-3)]" };
  const sym = item.tokenSymbol ? ` ${item.tokenSymbol}` : "";
  if (dir === "in" || dir === "received")
    return { value: `+${item.amountDisplay}${sym}`, cls: "text-[#34D399]" };
  if (dir === "out" || dir === "sent")
    return { value: `−${item.amountDisplay}${sym}`, cls: "text-[#E8654F]" };
  return { value: `${item.amountDisplay}${sym}`, cls: "text-[color:var(--text)]" };
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TransactionDetailViewProps {
  item: ActivityItem;
  chainId: ExtChainId;
  onBack: () => void;
}

export function TransactionDetailView({ item, chainId, onBack }: TransactionDetailViewProps) {
  const network = (() => {
    try {
      return getNetwork(chainId);
    } catch {
      return null;
    }
  })();

  const explorerUrl =
    network && item.transactionHash
      ? `${network.blockExplorerUrl}/tx/${item.transactionHash}`
      : null;

  const explorerHost = network
    ? (() => {
        try {
          return new URL(network.blockExplorerUrl).hostname;
        } catch {
          return "Explorer";
        }
      })()
    : "Explorer";

  const { value: amt, cls: amtCls } = amountStr(item);
  const label = humanLabel(item);

  const handleExplorer = () => {
    if (!explorerUrl) return;
    if (typeof chrome !== "undefined" && chrome.tabs) {
      void chrome.tabs.create({ url: explorerUrl });
    } else {
      window.open(explorerUrl, "_blank");
    }
  };

  return (
    <div
      className="flex flex-col min-h-screen font-sans"
      style={{ background: "var(--surface)", color: "var(--text)" }}
    >
      <div className="flex-1 p-4 pb-6 flex flex-col gap-3">
        {/* ── Back button ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="grid place-items-center rounded-[10px] border-0 cursor-pointer transition-colors duration-150"
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
          <span className="text-[15px] font-bold" style={{ color: "var(--text)" }}>
            {label}
          </span>
        </div>

        {/* ── Status header ─────────────────────────────────────────────── */}
        <StatusHeader status={item.status} />

        {/* ── Amount + time card ────────────────────────────────────────── */}
        <Card>
          <div className="flex flex-col gap-[2px] mb-2">
            <span className={`text-[22px] font-black tracking-tight leading-none ${amtCls}`}>
              {amt}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              {relativeTime(item.createdAt)}
            </span>
            <span style={{ color: "var(--text-3)" }}>·</span>
            <span className="text-[12px]" style={{ color: "var(--text-3)" }}>
              {formatAbsDate(item.createdAt)}
            </span>
          </div>
        </Card>

        {/* ── Details card ──────────────────────────────────────────────── */}
        <Card>
          <div
            className="text-[10px] uppercase tracking-widest font-bold mb-2"
            style={{ color: "var(--text-3)" }}
          >
            Details
          </div>
          {item.fromAddress && (
            <KV label="From" value={shorten(item.fromAddress)} mono />
          )}
          {item.toAddress && (
            <KV label="To" value={shorten(item.toAddress)} mono />
          )}
          {item.userOpHash && (
            <KV label="UserOp Hash" value={shorten(item.userOpHash, 10, 8)} mono />
          )}
          {item.transactionHash && (
            <KV label="Tx Hash" value={shorten(item.transactionHash, 10, 8)} mono />
          )}
          {item.blockNumber != null && (
            <KV label="Block" value={String(item.blockNumber)} mono />
          )}
          <KV
            label="Gas"
            value={item.paymasterUsed ? "Sponsored" : item.fee ?? "—"}
          />
          <KV label="Network" value={network?.name ?? `Chain ${chainId}`} last />
        </Card>

        {/* ── Explorer link ──────────────────────────────────────────────── */}
        {explorerUrl && (
          <button
            type="button"
            onClick={handleExplorer}
            className="flex items-center justify-center gap-2 rounded-[14px] py-[12px] border-0 cursor-pointer transition-all duration-150 font-semibold text-[13px]"
            style={{
              background: "rgba(124,58,237,.10)",
              color: "#7C3AED",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,.18)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,.10)";
            }}
          >
            <ExternalLink size={14} strokeWidth={2} />
            View on {explorerHost} ↗
          </button>
        )}
      </div>
    </div>
  );
}
