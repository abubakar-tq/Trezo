import { formatUnits } from "viem";
import type { BridgePlan } from "../types/bridge";
import type { TxPreview } from "../../transactions/types/txPreview";

export function buildBridgePreview(plan: BridgePlan, chainNames: Record<number, string>): TxPreview {
  const { quote, bridgeExecution } = plan;
  const inDisplay = formatUnits(quote.inputAmountRaw, quote.inputToken.decimals);
  const outDisplay = formatUnits(quote.outputAmountRaw, quote.outputToken.decimals);
  const feeNote = `Bridge fee ${(quote.feeBps / 100).toFixed(2)}%`;
  return {
    kind: "bridge",
    title: "Confirm bridge",
    contextLabel: "via Across",
    assetDeltas: [
      {
        symbol: quote.inputToken.symbol,
        name: `${quote.inputToken.symbol} · ${chainNames[quote.sourceChainId] ?? quote.sourceChainId}`,
        iconAddress: quote.inputToken.type === "erc20" ? quote.inputToken.address : undefined,
        direction: "out",
        amountRaw: quote.inputAmountRaw,
        amountDisplay: inDisplay,
        chainId: quote.sourceChainId,
        kind: "transfer",
      },
      {
        symbol: quote.outputToken.symbol,
        name: `${quote.outputToken.symbol} · ${chainNames[quote.destChainId] ?? quote.destChainId}`,
        iconAddress: quote.outputToken.type === "erc20" ? quote.outputToken.address : undefined,
        direction: "in",
        amountRaw: quote.outputAmountRaw,
        amountDisplay: outDisplay,
        chainId: quote.destChainId,
        kind: "transfer",
      },
    ],
    extraNotes: plan.approvalRequired
      ? [feeNote, `Approve ${quote.inputToken.symbol} first · 2 signatures`]
      : [feeNote],
    network: {
      chainId: quote.sourceChainId,
      networkKey: quote.sourceNetworkKey,
      name: chainNames[quote.sourceChainId] ?? String(quote.sourceChainId),
    },
    account: bridgeExecution.account,
    calls: [{ to: bridgeExecution.target, value: bridgeExecution.value, data: bridgeExecution.data }],
    requiresPriorApproval: plan.approvalRequired,
  };
}
