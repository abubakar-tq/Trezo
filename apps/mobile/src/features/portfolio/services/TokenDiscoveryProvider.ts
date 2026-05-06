import type { Address, PublicClient } from "viem";

import type { SupportedChainId } from "@/src/integration/chains";
import { TokenRegistryService } from "@/src/features/assets/services/TokenRegistryService";
import type { TokenMetadata } from "@/src/features/assets/types/token";

export interface DiscoveredToken {
  address: Address | "native";
  symbol: string;
  name: string;
  decimals: number;
  amountRaw: bigint;
}

export interface TokenDiscoveryProvider {
  discover(
    chainId: SupportedChainId,
    address: Address,
    client: PublicClient,
  ): Promise<DiscoveredToken[]>;
}

const ERC20_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

type TokenLister = (chainId: SupportedChainId) => TokenMetadata[];

const defaultTokenLister: TokenLister = (chainId) =>
  TokenRegistryService.listTokens(chainId);

export class RegistryDiscoveryProvider implements TokenDiscoveryProvider {
  constructor(private readonly tokenLister: TokenLister = defaultTokenLister) {}

  async discover(
    chainId: SupportedChainId,
    address: Address,
    client: PublicClient,
  ): Promise<DiscoveredToken[]> {
    const all = this.tokenLister(chainId);
    const erc20s = all.filter((t) => t.type === "erc20");

    const nativeBalance = await client.getBalance({ address });
    const native: DiscoveredToken = {
      address: "native",
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      amountRaw: nativeBalance,
    };

    if (erc20s.length === 0) {
      return [native];
    }

    const results = await client.multicall({
      contracts: erc20s.map((t) => ({
        address: t.address as Address,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf" as const,
        args: [address] as const,
      })),
      allowFailure: true,
    });

    const found: DiscoveredToken[] = [];
    results.forEach((r, i) => {
      if (r.status !== "success") return;
      const raw = r.result as bigint;
      if (raw === 0n) return;
      const t = erc20s[i];
      found.push({
        address: t.address as Address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        amountRaw: raw,
      });
    });

    return [native, ...found];
  }
}
