import { useEffect, useState } from "react";
import { ENABLED_CHAIN_IDS, getNetwork, type ExtChainId } from "../../core/networks";
import { getActiveChainId, setActiveChainId } from "../../core/activeChain";

interface ChainSwitcherProps {
  onChange: (chainId: ExtChainId) => void;
}

export function ChainSwitcher({ onChange }: ChainSwitcherProps) {
  const [activeChainId, setActive] = useState<ExtChainId | null>(null);

  useEffect(() => {
    getActiveChainId().then(setActive);
  }, []);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = Number(e.target.value) as ExtChainId;
    await setActiveChainId(id);
    setActive(id);
    onChange(id);
  }

  if (activeChainId === null) return null;

  return (
    <select
      value={activeChainId}
      onChange={handleChange}
      style={{
        background: "#1e1e2a",
        color: "#fff",
        border: "1px solid #333",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 13,
        cursor: "pointer",
        marginBottom: 12,
        width: "100%",
      }}
    >
      {ENABLED_CHAIN_IDS.map((id) => (
        <option key={id} value={id}>
          {getNetwork(id).name}
        </option>
      ))}
    </select>
  );
}
