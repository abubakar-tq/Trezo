import { formatEther } from "viem";
import type { Address, Hex } from "viem";
import type { SupportedChainId } from "@/src/integration/chains";
import type { AssetDelta, TxPreview } from "../../../transactions/types/txPreview";

const host = (url: string): string => { try { return new URL(url).host; } catch { return url; } };

export function buildDappPreview(
  origin: string,
  tx: { to: Address; data?: Hex; value?: Hex },
  account: Address,
  chainId: SupportedChainId,
  networkName: string,
): TxPreview {
  const value = tx.value ? BigInt(tx.value) : 0n;
  const deltas: AssetDelta[] = value > 0n
    ? [{ symbol: "ETH", name: "Ethereum", direction: "out", amountRaw: value, amountDisplay: formatEther(value), chainId, kind: "transfer" }]
    : [];
  return {
    kind: "dapp",
    title: "Confirm transaction",
    contextLabel: host(origin),
    origin,
    assetDeltas: deltas,
    network: { chainId, name: networkName },
    account,
    calls: [{ to: tx.to, value, data: (tx.data ?? "0x") as Hex }],
  };
}
