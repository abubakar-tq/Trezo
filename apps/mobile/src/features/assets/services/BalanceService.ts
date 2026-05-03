import { getPublicClient } from "@/src/integration/viem/clients";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import type { SendFeeMode } from "@/src/features/send/types/send";
import type { SupportedChainId } from "@/src/integration/chains";
import type { Address } from "viem";

const DEFAULT_NATIVE_GAS_RESERVE = 3_000_000_000_000_000n;

const ERC20_MIN_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type SpendableBalanceParams = {
  chainId: SupportedChainId;
  walletAddress: Address;
  token: TokenMetadata;
  feeMode: SendFeeMode;
  nativeGasReserveRaw?: bigint;
};

export class BalanceService {
  static async getNativeBalance(chainId: SupportedChainId, walletAddress: Address): Promise<bigint> {
    const client = getPublicClient(chainId);
    return client.getBalance({ address: walletAddress });
  }

  static async getErc20Balance(
    chainId: SupportedChainId,
    tokenAddress: Address,
    walletAddress: Address,
  ): Promise<bigint> {
    const client = getPublicClient(chainId);
    const raw = await client.readContract({
      address: tokenAddress,
      abi: ERC20_MIN_ABI,
      functionName: "balanceOf",
      args: [walletAddress],
    });

    return raw as bigint;
  }

  static async getSpendableBalance(
    params: SpendableBalanceParams,
  ): Promise<{ balanceRaw: bigint; spendableRaw: bigint; feeMode: SendFeeMode }> {
    const balanceRaw = params.token.type === "native"
      ? await this.getNativeBalance(params.chainId, params.walletAddress)
      : await this.getErc20Balance(params.chainId, params.token.address as Address, params.walletAddress);

    if (params.feeMode === "sponsored") {
      return {
        balanceRaw,
        spendableRaw: balanceRaw,
        feeMode: params.feeMode,
      };
    }

    if (params.token.type !== "native") {
      return {
        balanceRaw,
        spendableRaw: balanceRaw,
        feeMode: params.feeMode,
      };
    }

    const gasReserve = params.nativeGasReserveRaw ?? DEFAULT_NATIVE_GAS_RESERVE;
    const spendableRaw = balanceRaw > gasReserve ? balanceRaw - gasReserve : 0n;

    return {
      balanceRaw,
      spendableRaw,
      feeMode: params.feeMode,
    };
  }
}
