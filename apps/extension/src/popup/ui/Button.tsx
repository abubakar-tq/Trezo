import { type ReactNode } from "react";
import { Spinner } from "./Spinner";

interface ButtonProps {
  variant?: "primary" | "ghost";
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  type?: "button" | "submit" | "reset";
  className?: string;
}

export function Button({
  variant = "primary",
  children,
  onClick,
  loading = false,
  disabled = false,
  fullWidth = true,
  type = "button",
  className = "",
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-btn px-4 py-[13px] text-sm font-semibold tracking-tight transition-all duration-150 cursor-pointer border-0 font-sans focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

  const primary =
    "text-white shadow-accent hover:brightness-110 active:scale-[.99] active:translate-y-px";
  const primaryStyle = {
    background: "linear-gradient(150deg,#8B5CF6,#7C3AED 60%,#6D28D9)",
    boxShadow: "0 8px 22px rgba(124,58,237,.34)",
  };

  const ghost =
    "text-text2 hover:border-accent hover:text-text bg-transparent";
  const ghostStyle = {
    border: "1px solid rgba(124,58,237,.13)",
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variant === "primary" ? primary : ghost} ${widthClass} ${className}`}
      style={variant === "primary" ? primaryStyle : ghostStyle}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}
