import { ChevronDown } from "lucide-react";

interface ChipProps {
  label: string;
  onClick?: () => void;
  className?: string;
}

/** Chain chip: dot + label + chevron. Matches mockup `.chip`. */
export function Chip({ label, onClick, className = "" }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-[7px] px-[10px] py-[6px] rounded-chip text-xs font-medium cursor-pointer transition-all duration-[180ms] font-sans border-0 ${className}`}
      style={{
        background: "rgba(124,58,237,.15)",
        border: "1px solid rgba(124,58,237,.1)",
        color: "var(--text)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,.22)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(124,58,237,.15)";
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: "var(--accent-2)",
          boxShadow: "0 0 8px var(--accent-2)",
          flex: "none",
          display: "block",
        }}
      />
      {label}
      <ChevronDown size={10} strokeWidth={2} />
    </button>
  );
}
