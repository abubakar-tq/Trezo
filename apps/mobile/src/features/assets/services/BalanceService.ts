import { getPublicClient } from "@/src/integration/viem/clients";
import type { TokenMetadata } from "@/src/features/assets/types/token";
import type { SupportedChainId } from "@/src/integration/chains";
import { formatUnits, type Address } from "viem";

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

export type BalanceFeeMode = "sponsored" | "wallet_paid";

export type SpendableBalanceParams = {
  chainId: SupportedChainId;
  walletAddress: Address;
  token: TokenMetadata;
  feeMode: BalanceFeeMode;
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

  static async getBalance(params: {
    chainId: SupportedChainId;
    walletAddress: Address;
    token: TokenMetadata;
  }): Promise<bigint> {
    if (params.token.type === "native") {
      return this.getNativeBalance(params.chainId, params.walletAddress);
    }

    return this.getErc20Balance(params.chainId, params.token.address as Address, params.walletAddress);
  }

  static formatBalance(token: TokenMetadata, raw: bigint): string {
    return formatUnits(raw, token.decimals);
  }

  static async getSpendableBalance(
    params: SpendableBalanceParams,
  ): Promise<{ balanceRaw: bigint; spendableRaw: bigint; feeMode: BalanceFeeMode }> {
    const balanceRaw = await this.getBalance({
      chainId: params.chainId,
      walletAddress: params.walletAddress,
      token: params.token,
    });

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

  static async refreshBalancesAfterTransaction(params: {
    chainId: SupportedChainId;
    walletAddress: Address;
    tokens: TokenMetadata[];
  }): Promise<Record<string, bigint>> {
    const uniqueTokens = new Map<string, TokenMetadata>();

    for (const token of params.tokens) {
      const key = token.type === "native" ? "native" : token.address.toLowerCase();
      if (!uniqueTokens.has(key)) {
        uniqueTokens.set(key, token);
      }
    }

    const refreshed = await Promise.all(
      Array.from(uniqueTokens.entries()).map(async ([key, token]) => {
        const balance = await this.getBalance({
          chainId: params.chainId,
          walletAddress: params.walletAddress,
          token,
        });
        return [key, balance] as const;
      }),
    );

    return Object.fromEntries(refreshed);
  }
}
