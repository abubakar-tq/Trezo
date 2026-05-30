import { formatUnits } from "viem";
import type { SwapPlan } from "../types/swap";
import type { TxPreview } from "../../transactions/types/txPreview";

export function buildSwapPreview(plan: SwapPlan, networkName: string): TxPreview {
  const { quote, swapExecution } = plan;
  const sellDisplay = formatUnits(quote.sellAmountRaw, quote.sellToken.decimals);
  const buyDisplay = formatUnits(quote.estimatedBuyAmountRaw, quote.buyToken.decimals);
  const minDisplay = formatUnits(quote.minimumBuyAmountRaw, quote.buyToken.decimals);
  return {
    kind: "swap",
    title: "Confirm swap",
    contextLabel: `via ${quote.provider}`,
    assetDeltas: [
      {
        symbol: quote.sellToken.symbol,
        name: quote.sellToken.name,
        iconAddress: quote.sellToken.type === "erc20" ? quote.sellToken.address : undefined,
        direction: "out",
        amountRaw: quote.sellAmountRaw,
        amountDisplay: sellDisplay,
        chainId: quote.chainId,
        kind: "transfer",
      },
      {
        symbol: quote.buyToken.symbol,
        name: quote.buyToken.name,
        iconAddress: quote.buyToken.type === "erc20" ? quote.buyToken.address : undefined,
        direction: "in",
        amountRaw: quote.estimatedBuyAmountRaw,
        amountDisplay: buyDisplay,
        chainId: quote.chainId,
        kind: "transfer",
      },
    ],
    slippageBps: quote.slippageBps,
    minReceivedDisplay: `${minDisplay} ${quote.buyToken.symbol}`,
    network: { chainId: quote.chainId, networkKey: quote.networkKey, name: networkName },
    account: swapExecution.account,
    calls: [{ to: swapExecution.target, value: swapExecution.value, data: swapExecution.data }],
  };
}
