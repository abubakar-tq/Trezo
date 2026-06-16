import { type InputHTMLAttributes } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  className?: string;
}

/** Pill input with focus ring. Matches mockup `.input`. */
export function Input({ className = "", style, ...rest }: InputProps) {
  return (
    <input
      {...rest}
      className={`w-full rounded-chip px-[15px] py-3 text-sm font-sans outline-none transition-all duration-[180ms] ${className}`}
      style={{
        background: "rgba(12,10,16,.85)",
        border: "1px solid rgba(124,58,237,.16)",
        color: "var(--text)",
        ...style,
      }}
      onFocus={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "var(--accent)";
        el.style.boxShadow = "0 0 0 3px rgba(124,58,237,.15)";
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        const el = e.currentTarget;
        el.style.borderColor = "rgba(124,58,237,.16)";
        el.style.boxShadow = "none";
        rest.onBlur?.(e);
      }}
    />
  );
}
