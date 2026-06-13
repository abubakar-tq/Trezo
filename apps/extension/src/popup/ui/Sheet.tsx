import { type ReactNode } from "react";

interface SheetProps {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Approval window body wrapper — consistent padding, header slot + children.
 * Used as the root container in all approval sheets.
 */
export function Sheet({ header, children, className = "" }: SheetProps) {
  return (
    <div
      className={`flex flex-col min-h-screen font-sans ${className}`}
      style={{ background: "var(--surface)", color: "var(--text)" }}
    >
      {header && (
        <div
          className="flex items-center gap-[7px] px-[13px] h-8 flex-none"
          style={{
            background: "rgba(8,6,12,.6)",
            borderBottom: "1px solid rgba(124,58,237,.07)",
          }}
        >
          {header}
        </div>
      )}
      <div className="flex-1 p-4 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
