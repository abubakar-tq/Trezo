import type { Address, Hex } from "viem";
import type { SupportedChainId } from "@/src/integration/chains";
import type { NetworkKey } from "@/src/integration/networks";

export type TxPreviewKind = "send" | "swap" | "bridge" | "dapp";

export type AssetDelta = {
  symbol: string;
  name?: string;
  iconAddress?: string;          // for TokenIcon address-based lookup
  direction: "in" | "out";
  amountRaw: bigint;
  amountDisplay: string;         // formatted, unsigned (UI adds +/-)
  fiatDisplay?: string;          // "$142.61" when price known
  chainId: SupportedChainId;     // supports cross-chain (bridge) rows
  kind?: "transfer" | "approval"; // "approval" renders as an amber warning row
};

export type TxCall = { to: Address; value: bigint; data: Hex };

export type TxPreview = {
  kind: TxPreviewKind;
  title: string;                 // "Confirm swap"
  contextLabel?: string;         // "via Uniswap v3" | dApp origin host
  origin?: string;               // dapp only — full url
  assetDeltas: AssetDelta[];
  recipientDisplay?: string;     // send — truncated address
  slippageBps?: number;          // swap/bridge
  minReceivedDisplay?: string;   // "141.80 USDC"
  extraNotes?: string[];         // e.g. "Bridge fee 0.3 USDC · ~30s"
  network: { chainId: SupportedChainId; networkKey?: NetworkKey; name: string };
  account: Address;
  calls: TxCall[];               // inner call(s) being confirmed (preflight target)
};

export type GasFee = {
  nativeDisplay: string;         // "0.00041 ETH"
  fiatDisplay?: string;          // "$0.004"
  sponsored: boolean;
};

export type SimulationStatus = "success" | "revert" | "unknown";

export type SimulationResult = {
  status: SimulationStatus;
  revertReason?: string;
  assetDeltas?: AssetDelta[];    // provider-sourced; when present, overrides preview deltas (dapp)
  warnings?: string[];           // e.g. "Grants USDC spending approval to 0x…"
  gasFee: GasFee;
  source: "derived" | "preflight" | "provider";
};
