// apps/mobile/src/features/portfolio/services/PortfolioService.ts
import { createPublicClient, formatUnits, http, defineChain, type Address, type PublicClient, type Chain } from "viem";

import { getRpcUrl } from "@/src/core/network/chain";
import { getChainConfig, type SupportedChainId } from "@/src/integration/chains";
import { CoinCapPriceProvider, priceKey, type PriceProvider } from "./PriceProvider";
import { RegistryDiscoveryProvider, type TokenDiscoveryProvider, type DiscoveredToken } from "./TokenDiscoveryProvider";

export interface TokenBalance {
  symbol: string;
  name: string;
  price: number | null;
  amount: number;
  value: number | null;
  address: Address | "native";
  decimals: number;
  change24h?: number;
}

export interface PortfolioData {
  chainId: SupportedChainId;
  totalValue: number;        // sum of priced values; tokens without prices are excluded
  tokens: TokenBalance[];
  missingPrices: string[];   // symbols whose prices were unavailable
}

interface CacheEntry {
  data: PortfolioData;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;

export class PortfolioService {
  private static cache: Map<string, CacheEntry> = new Map();

  private static chainConfigToViemChain(chainId: SupportedChainId): Chain {
    const config = getChainConfig(chainId);
    return defineChain({
      id: config.id,
      name: config.name,
      nativeCurrency: config.nativeCurrency,
      rpcUrls: {
        default: { http: [config.rpcUrl] },
        public: { http: [config.rpcUrl] },
      },
      testnet: config.environment !== "mainnet",
    });
  }

  private static makeClient(chainId: SupportedChainId): PublicClient {
    return createPublicClient({
      chain: this.chainConfigToViemChain(chainId),
      transport: http(getRpcUrl(chainId)),
    }) as PublicClient;
  }

  static async getPortfolio(
    address: Address,
    chainId: SupportedChainId,
    deps?: { discovery?: TokenDiscoveryProvider; price?: PriceProvider },
  ): Promise<PortfolioData> {
    const cacheKey = `${chainId}:${address.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    const discovery = deps?.discovery ?? new RegistryDiscoveryProvider();
    const price = deps?.price ?? new CoinCapPriceProvider();

    const client = this.makeClient(chainId);
    let discovered: DiscoveredToken[] = [];
    try {
      discovered = await discovery.discover(chainId, address, client);
    } catch (err) {
      console.warn("[PortfolioService] discovery failed:", err);
      // fall back to native-only
      try {
        const native = await client.getBalance({ address });
        discovered = [{ address: "native", symbol: "ETH", name: "Ethereum", decimals: 18, amountRaw: native }];
      } catch {
        discovered = [];
      }
    }

    const prices = await price.getPricesUsd(
      discovered.map((d) => ({ symbol: d.symbol, address: d.address, chainId })),
    );

    const tokens: TokenBalance[] = [];
    const missing: string[] = [];
    let total = 0;

    for (const d of discovered) {
      const amount = parseFloat(formatUnits(d.amountRaw, d.decimals));
      const p = prices.get(priceKey(chainId, d.address as string));
      const value = typeof p === "number" ? amount * p : null;
      tokens.push({
        symbol: d.symbol,
        name: d.name,
        price: typeof p === "number" ? p : null,
        amount,
        value,
        address: d.address,
        decimals: d.decimals,
      });
      if (value === null) {
        missing.push(d.symbol);
      } else {
        total += value;
      }
    }

    const data: PortfolioData = {
      chainId,
      totalValue: total,
      tokens,
      missingPrices: missing,
    };
    this.cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    return data;
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static formatUSD(value: number | null): string {
    if (value === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  static formatAmount(amount: number, decimals: number = 4): string {
    return amount.toFixed(decimals);
  }
}
