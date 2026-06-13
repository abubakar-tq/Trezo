import { type ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

/** Composed empty state — icon, title, subtitle, optional action. */
export function EmptyState({ icon, title, subtitle, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-10 px-6 text-center gap-3 ${className}`}>
      <div
        className="w-12 h-12 rounded-full grid place-items-center mb-1"
        style={{ background: "rgba(124,58,237,.12)", color: "var(--text-3)" }}
      >
        {icon}
      </div>
      <div className="text-sm font-semibold" style={{ color: "var(--text)" }}>
        {title}
      </div>
      {subtitle && (
        <div className="text-[12.5px] leading-[1.55]" style={{ color: "var(--text-2)", maxWidth: "22ch" }}>
          {subtitle}
        </div>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
