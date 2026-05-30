import { formatUnits } from "viem";
import type { PreparedSend } from "../types/send";
import type { TxPreview } from "../../transactions/types/txPreview";

const truncate = (a: string) => (a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a);

export function buildSendPreview(prepared: PreparedSend, networkName: string): TxPreview {
  const { validation, execution } = prepared;
  const amountDisplay = formatUnits(validation.amountRaw, validation.token.decimals);
  return {
    kind: "send",
    title: `Send ${validation.token.symbol}`,
    assetDeltas: [{
      symbol: validation.token.symbol,
      name: validation.token.name,
      iconAddress: validation.token.type === "erc20" ? validation.token.address : undefined,
      direction: "out",
      amountRaw: validation.amountRaw,
      amountDisplay,
      chainId: execution.chainId,
      kind: "transfer",
    }],
    recipientDisplay: truncate(validation.recipient),
    network: { chainId: execution.chainId, networkKey: execution.networkKey, name: networkName },
    account: execution.account,
    calls: [{ to: execution.target, value: execution.value, data: execution.data }],
  };
}
