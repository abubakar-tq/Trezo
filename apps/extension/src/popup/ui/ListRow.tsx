import { type ReactNode } from "react";

interface ListRowProps {
  icon: ReactNode;
  name: string;
  sub?: string;
  value?: string;
  valueSub?: string;
  valueClass?: string;   // extra className on value (e.g. "text-success")
  onClick?: () => void;
  last?: boolean;
  className?: string;
}

/** Token / activity / market row. Matches mockup `.lrow`. */
export function ListRow({
  icon,
  name,
  sub,
  value,
  valueSub,
  valueClass = "",
  onClick,
  last = false,
  className = "",
}: ListRowProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 py-[11px] cursor-pointer transition-all duration-[150ms] group ${className}`}
      style={{
        borderBottom: last ? "none" : "1px solid rgba(124,58,237,.07)",
      }}
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
      {/* left icon */}
      <div className="flex-none">{icon}</div>

      {/* name + sub */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          {name}
        </div>
        {sub && (
          <div className="text-[11.5px]" style={{ color: "var(--text-2)" }}>
            {sub}
          </div>
        )}
      </div>

      {/* right value + sub */}
      {(value !== undefined || valueSub !== undefined) && (
        <div className="text-right">
          {value !== undefined && (
            <div
              className={`text-[13.5px] font-semibold font-mono ${valueClass}`}
              style={valueClass ? undefined : { color: "var(--text)" }}
            >
              {value}
            </div>
          )}
          {valueSub !== undefined && (
            <div className="text-[11.5px] font-mono" style={{ color: "var(--text-2)" }}>
              {valueSub}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
