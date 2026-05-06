import { marketService } from "@/src/services/MarketService";

import type { Address } from "viem";
import type { SupportedChainId } from "@/src/integration/chains";

export interface PriceQuery {
  symbol: string;
  address: Address | "native";
  chainId: SupportedChainId;
}

export interface PriceProvider {
  getPricesUsd(tokens: PriceQuery[]): Promise<Map<string, number | null>>;
}

export const priceKey = (chainId: SupportedChainId, address: string): string =>
  `${chainId}:${address.toLowerCase()}`;

interface MarketServiceLike {
  getTopAssets(limit?: number): Promise<{ id: string; symbol: string; priceUsd: string }[]>;
}

export class CoinCapPriceProvider implements PriceProvider {
  constructor(private readonly market: MarketServiceLike = marketService) {}

  async getPricesUsd(tokens: PriceQuery[]): Promise<Map<string, number | null>> {
    const out = new Map<string, number | null>();
    if (tokens.length === 0) return out;

    let assets: { id: string; symbol: string; priceUsd: string }[] = [];
    try {
      assets = await this.market.getTopAssets(200);
    } catch {
      // outage: leave assets empty; everything resolves to null
    }

    const bySymbol = new Map<string, number>();
    for (const a of assets) {
      const price = parseFloat(a.priceUsd);
      if (Number.isFinite(price)) {
        bySymbol.set(a.symbol.toUpperCase(), price);
      }
    }

    for (const q of tokens) {
      const key = priceKey(q.chainId, q.address);
      const price = bySymbol.get(q.symbol.toUpperCase());
      out.set(key, typeof price === "number" ? price : null);
    }

    return out;
  }
}
