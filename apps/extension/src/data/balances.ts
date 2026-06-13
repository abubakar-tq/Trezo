/**
 * balances.ts — Extension data layer: wallet token balances
 *
 * Native ETH + popular ERC-20s per chain (Sepolia + Base Sepolia).
 * Prices joined from the market feed by symbol.
 * Runs in both popup and service worker.  No React-Native deps.
 */

import { formatUnits, type Address } from "viem";
import { getPublicClient } from "../core/clients";
import { getTopAssets, buildPriceIndex } from "./market";

// ─── ERC-20 ABI (minimal balanceOf) ──────────────────────────────────────────

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── Popular testnet token map ────────────────────────────────────────────────
//
// Source: apps/mobile/src/features/assets/config/tokenRegistry.ts
// Sepolia (11155111), Base Sepolia (84532), and Arbitrum Sepolia (421614) are extension-enabled chains.
// WETH maps to "ETH" for pricing (same as native ETH price).

interface KnownToken {
  symbol: string;
  name: string;
  address: Address;
  decimals: number;
  /** Symbol to look up in the market price feed (mainnet equivalent). */
  pricingSymbol: string;
}

const POPULAR_TOKENS: Record<number, KnownToken[]> = {
  // Ethereum Sepolia
  11155111: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle faucet USDC
      decimals: 6,
      pricingSymbol: "USDC",
    },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0xfff9976782d46cc05630d1f6ebab18b2324d6b14", // router-canonical Sepolia WETH
      decimals: 18,
      pricingSymbol: "ETH",
    },
  ],
  // Base Sepolia
  84532: [
    {
      symbol: "USDC",
      name: "USD Coin",
      address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Circle Base Sepolia USDC
      decimals: 6,
      pricingSymbol: "USDC",
    },
    {
      symbol: "WETH",
      name: "Wrapped Ether",
      address: "0x4200000000000000000000000000000000000006", // canonical Base WETH
      decimals: 18,
      pricingSymbol: "ETH",
    },
    {
      symbol: "LINK",
      name: "ChainLink Token",
      address: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410", // Chainlink LINK Base Sepolia
      decimals: 18,
      pricingSymbol: "LINK",
    },
  ],
  // Arbitrum Sepolia — native ETH only; no testnet ERC-20s registered yet
  421614: [],
};

// ─── Output types ─────────────────────────────────────────────────────────────

export interface TokenItem {
  symbol: string;
  name: string;
  amount: number;
  priceUsd: number;
  valueUsd: number;
  change24h?: number;
  address: string; // "native" for ETH
  decimals: number;
  native: boolean;
}

export interface WalletBalances {
  totalUsd: number;
  tokens: TokenItem[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch native ETH + known ERC-20 balances for `address` on `chainId`.
 * Joins prices from the market feed (CoinGecko/Binance).
 * Skips zero-balance ERC-20s (native ETH always shown).
 * Returns tokens sorted by USD value descending.
 * Never throws — returns { totalUsd: 0, tokens: [] } on error.
 */
export async function getWalletTokens(
  address: Address,
  chainId: number,
): Promise<WalletBalances> {
  try {
    const client = getPublicClient(chainId);

    // Parallel: native balance + ERC-20 individual reads + price feed.
    // Individual readContract calls (not multicall) so one token failure doesn't silently
    // suppress all others — multicall's allowFailure:true was dropping everything on RPC issues.
    const erc20s = POPULAR_TOKENS[chainId] ?? [];

    const [nativeRaw, erc20Raws, marketAssets] = await Promise.all([
      client.getBalance({ address }).catch(() => 0n),
      Promise.all(
        erc20s.map((t) =>
          client
            .readContract({ address: t.address, abi: ERC20_ABI, functionName: "balanceOf", args: [address] })
            .catch((e) => {
              console.debug(`[balances] ${t.symbol} readContract failed:`, e);
              return null as bigint | null;
            }),
        ),
      ),
      getTopAssets(200),
    ]);

    const priceIndex = buildPriceIndex(marketAssets);

    const tokens: TokenItem[] = [];

    // Native ETH
    const nativeAmount = parseFloat(formatUnits(nativeRaw, 18));
    const nativeMarket = priceIndex.get("ETH");
    const nativePriceUsd = nativeMarket?.priceUsd ?? 0;
    tokens.push({
      symbol: "ETH",
      name: "Ethereum",
      amount: nativeAmount,
      priceUsd: nativePriceUsd,
      valueUsd: nativeAmount * nativePriceUsd,
      change24h: nativeMarket?.change24h,
      address: "native",
      decimals: 18,
      native: true,
    });

    // ERC-20s
    for (let i = 0; i < erc20s.length; i++) {
      const raw = erc20Raws[i];
      if (raw === null || raw === 0n) continue; // null = read failed; 0 = no balance

      const t = erc20s[i];
      const amount = parseFloat(formatUnits(raw, t.decimals));
      const market = priceIndex.get(t.pricingSymbol.toUpperCase());
      const priceUsd = market?.priceUsd ?? 0;
      tokens.push({
        symbol: t.symbol,
        name: t.name,
        amount,
        priceUsd,
        valueUsd: amount * priceUsd,
        change24h: market?.change24h,
        address: t.address,
        decimals: t.decimals,
        native: false,
      });
    }

    // Sort by USD value desc
    tokens.sort((a, b) => b.valueUsd - a.valueUsd);

    const totalUsd = tokens.reduce((sum, t) => sum + t.valueUsd, 0);

    return { totalUsd, tokens };
  } catch {
    return { totalUsd: 0, tokens: [] };
  }
}
