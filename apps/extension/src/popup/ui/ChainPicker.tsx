/**
 * ChainPicker.tsx — Dropdown chain selector for the Home header.
 *
 * Clicking the Chip opens a small menu listing all ENABLED_CHAIN_IDS;
 * the active one is checkmarked. Selecting a chain calls onSelect + closes
 * the menu. Clicking outside also closes it.
 */

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { ENABLED_CHAIN_IDS, getNetwork, type ExtChainId } from "../../core/networks";
import { Chip } from "./Chip";

interface ChainPickerProps {
  activeChainId: ExtChainId | null;
  onSelect: (chainId: ExtChainId) => void;
}

export function ChainPicker({ activeChainId, onSelect }: ChainPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const chainName = activeChainId ? getNetwork(activeChainId).name : "…";
  const chainShortName = chainName.replace("Ethereum ", "").replace(" Testnet", "");

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <Chip
        label={chainShortName}
        onClick={() => setOpen((v) => !v)}
      />

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            zIndex: 50,
            minWidth: 176,
            background: "rgba(22,17,32,.97)",
            border: "1px solid rgba(124,58,237,.22)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,.55)",
            overflow: "hidden",
          }}
        >
          {/* Header label */}
          <div
            style={{
              padding: "8px 12px 6px",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".07em",
              textTransform: "uppercase",
              color: "var(--text-3)",
              borderBottom: "1px solid rgba(124,58,237,.1)",
            }}
          >
            Select network
          </div>

          {/* Network list */}
          {ENABLED_CHAIN_IDS.map((id) => {
            const name = getNetwork(id).name;
            const isActive = id === activeChainId;
            return (
              <ChainOption
                key={id}
                name={name}
                active={isActive}
                onClick={() => {
                  setOpen(false);
                  onSelect(id);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChainOption({
  name,
  active,
  onClick,
}: {
  name: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        padding: "9px 12px",
        background: hovered
          ? "rgba(124,58,237,.12)"
          : active
          ? "rgba(124,58,237,.07)"
          : "transparent",
        border: "none",
        cursor: "pointer",
        textAlign: "left",
        transition: "background 120ms",
        borderBottom: "1px solid rgba(124,58,237,.06)",
      }}
    >
      {/* Network dot */}
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: active ? "var(--accent-2)" : "rgba(124,58,237,.4)",
          boxShadow: active ? "0 0 8px var(--accent-2)" : "none",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          fontSize: 12.5,
          fontWeight: active ? 700 : 500,
          color: active ? "var(--text)" : "var(--text-2)",
          fontFamily: "inherit",
        }}
      >
        {name}
      </span>
      {active && (
        <Check
          size={12}
          strokeWidth={2.5}
          style={{ color: "var(--accent-2)", flexShrink: 0 }}
        />
      )}
    </button>
  );
}
