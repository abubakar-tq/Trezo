import { type ReactNode, type CSSProperties } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}

/** Glass card matching mockup `.card` — bg, border, radius 16. */
export function Card({ children, className = "", style, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-card p-[14px] ${className}`}
      style={{
        background: "rgba(20,16,27,.72)",
        border: "1px solid rgba(124,58,237,.13)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
