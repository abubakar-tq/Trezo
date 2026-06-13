interface TabItem {
  label: string;
  value: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Segmented tab bar. Matches mockup `.tabs` / `.tab`. */
export function Tabs({ items, value, onChange, className = "" }: TabsProps) {
  return (
    <div
      className={`flex gap-1 p-1 rounded-btn mb-[6px] ${className}`}
      style={{
        background: "rgba(14,12,18,.45)",
        border: "1px solid rgba(124,58,237,.07)",
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className="flex-1 text-center py-2 rounded-[9px] text-[12.5px] font-semibold cursor-pointer transition-all duration-[160ms] font-sans border-0"
            style={{
              background: active ? "rgba(124,58,237,.15)" : "transparent",
              color: active ? "var(--text)" : "var(--text-3)",
              boxShadow: active ? "inset 0 0 0 1px rgba(124,58,237,.1)" : "none",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
