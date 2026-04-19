import { parseEther, type Address } from "viem";

import { getPublicClient, getWalletClientFromPrivateKey } from "@/src/integration/viem";
import type { SupportedChainId } from "@/src/integration/chains";

export const DEV_FUNDING_PRIVATE_KEY =
  ("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const);

export const DEV_FUNDING_AMOUNT_ETH = "0.5";

export async function devFundSmartAccount(params: {
  address: Address;
  chainId: SupportedChainId;
}) {
  const walletClient = getWalletClientFromPrivateKey(DEV_FUNDING_PRIVATE_KEY, params.chainId);
  const publicClient = getPublicClient(params.chainId);
  const txHash = await walletClient.sendTransaction({
    to: params.address,
    value: parseEther(DEV_FUNDING_AMOUNT_ETH),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  return {
    transactionHash: txHash,
    receipt,
  };
}
