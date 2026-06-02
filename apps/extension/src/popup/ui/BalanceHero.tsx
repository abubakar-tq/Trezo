import { Pill } from "./Pill";

interface BalanceHeroProps {
  totalUsd: string;         // e.g. "$1,284.50"
  change24hPct?: number;    // e.g. 2.4 (positive = up, negative = down)
  spark?: number[];         // sparkline data points
  label?: string;
  className?: string;
}

function buildSparkPath(data: number[], w = 140, h = 50): string {
  if (data.length < 2) return "";
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const xs = data.map((_, i) => (i / (data.length - 1)) * w);
  const ys = data.map((v) => h - ((v - min) / range) * (h * 0.8) - h * 0.1);
  return xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(" ");
}

/** Balance hero card with label, big balance, 24h pill, optional sparkline. */
export function BalanceHero({ totalUsd, change24hPct, spark, label = "Total balance", className = "" }: BalanceHeroProps) {
  const tone = change24hPct === undefined ? "warn" : change24hPct >= 0 ? "ok" : "danger";
  const changeLabel =
    change24hPct === undefined
      ? undefined
      : `${change24hPct >= 0 ? "+" : ""}${change24hPct.toFixed(1)}% today`;

  const sparkPath = spark && spark.length >= 2 ? buildSparkPath(spark) : null;
  const sparkColor = tone === "danger" ? "#E8654F" : "#34D399";
  const sparkFill = tone === "danger" ? "rgba(232,101,79,.1)" : "rgba(52,211,153,.1)";

  return (
    <div
      className={`rounded-hero px-[17px] py-[17px] relative overflow-hidden ${className}`}
      style={{
        background: `
          radial-gradient(120% 140% at 0% 0%, rgba(139,92,246,.22), transparent 55%),
          linear-gradient(160deg, rgba(26,18,42,.9), rgba(12,10,18,.85))
        `,
        border: "1px solid rgba(124,58,237,.1)",
      }}
    >
      <div className="text-[10px] font-semibold tracking-[.07em] uppercase" style={{ color: "var(--text-3)" }}>
        {label}
      </div>

      <div
        className="text-[30px] font-bold tracking-[-0.025em] my-[7px] font-sans"
        style={{ color: "var(--text)" }}
      >
        {totalUsd}
      </div>

      {changeLabel && (
        <Pill tone={tone}>{changeLabel}</Pill>
      )}

      {/* Sparkline */}
      {sparkPath && (
        <svg
          className="absolute right-0 bottom-0"
          width="140"
          height="50"
          viewBox="0 0 140 50"
          preserveAspectRatio="none"
          style={{ opacity: 0.85 }}
        >
          <path d={sparkPath} stroke={sparkColor} strokeWidth="2" fill="none" />
          <path
            d={`${sparkPath} L140 50 L0 50 Z`}
            fill={sparkFill}
          />
        </svg>
      )}
    </div>
  );
}
