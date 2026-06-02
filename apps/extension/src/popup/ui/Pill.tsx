import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { type ReactNode } from "react";

interface PillProps {
  tone: "ok" | "warn" | "danger";
  children: ReactNode;
  showIcon?: boolean;
  className?: string;
}

const TONE_STYLES = {
  ok: {
    background: "rgba(52,211,153,.13)",
    color: "#34D399",
  },
  warn: {
    background: "rgba(245,158,11,.13)",
    color: "#F59E0B",
  },
  danger: {
    background: "rgba(232,101,79,.13)",
    color: "#E8654F",
  },
};

const TONE_ICONS: Record<string, ReactNode> = {
  ok: <TrendingUp size={11} strokeWidth={2} />,
  warn: <Minus size={11} strokeWidth={2} />,
  danger: <TrendingDown size={11} strokeWidth={2} />,
};

/** Status pill with tone. Matches mockup `.pill.ok/.warn`. */
export function Pill({ tone, children, showIcon = true, className = "" }: PillProps) {
  const styles = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-[5px] text-[11px] font-semibold px-[9px] py-1 rounded-chip ${className}`}
      style={styles}
    >
      {showIcon && TONE_ICONS[tone]}
      {children}
    </span>
  );
}
