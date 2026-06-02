import { type ReactNode } from "react";

interface KVProps {
  label: string;
  value: ReactNode;
  last?: boolean;
  mono?: boolean;
  className?: string;
}

/** Key/value row used in approval cards. Matches mockup `.kv`. */
export function KV({ label, value, last = false, mono = false, className = "" }: KVProps) {
  return (
    <div
      className={`flex justify-between items-baseline gap-3 py-[9px] ${className}`}
      style={{
        borderBottom: last ? "none" : "1px solid rgba(124,58,237,.07)",
      }}
    >
      <span className="text-xs" style={{ color: "var(--text-3)" }}>
        {label}
      </span>
      <span
        className={`text-[12.5px] text-right break-all ${mono ? "font-mono" : "font-sans"}`}
        style={{ color: "var(--text)" }}
      >
        {value}
      </span>
    </div>
  );
}
