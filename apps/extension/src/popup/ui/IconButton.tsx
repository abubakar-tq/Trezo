import { type ReactNode } from "react";

interface IconButtonProps {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  className?: string;
}

/** Square icon button. Matches mockup `.iconbtn`. */
export function IconButton({ children, onClick, title, className = "" }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`w-[34px] h-[34px] rounded-[10px] grid place-items-center cursor-pointer transition-all duration-[180ms] font-sans border-0 flex-none ${className}`}
      style={{
        background: "rgba(244,241,234,.03)",
        border: "1px solid rgba(124,58,237,.13)",
        color: "var(--text-2)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.color = "var(--text)";
        el.style.borderColor = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.color = "var(--text-2)";
        el.style.borderColor = "rgba(124,58,237,.13)";
      }}
    >
      {children}
    </button>
  );
}
