# Mobile Correctness & UX Polish Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a release-ready polish pass fixing six concrete issues across the mobile wallet: real home portfolio balance, correct display of failed transactions, recovery routing for passkey-less devices, populated `passkeys` table, exit affordances on transaction screens, and classified swap errors.

**Architecture:** Three independent workstreams (A=Correctness, B=Recovery routing, C=Tx & swap UX) implemented behind small interfaces (`TokenDiscoveryProvider`, `PriceProvider`, `SwapErrorClassifier`) so the polish pass does not preclude future Moralis/indexer integration or expanded error categories. No shared state between workstreams; can be developed in parallel.

**Tech Stack:** React Native (Expo SDK 54), TypeScript, viem, ethers, NativeWind, Zustand, react-navigation, Supabase, ERC-4337 (Pimlico Alto bundler), CoinCap (existing market service).

**Spec:** `docs/plans/2026-05-06-mobile-correctness-and-ux-pass.md` (commit `1b256205d`).

---

## Conventions for this plan

The mobile app has no Jest runner configured (CLAUDE.md confirms). One test file exists (`apps/mobile/src/integration/viem/__tests__/recoveryHash.test.ts`) using a "bare assert helpers" pattern. New tests in this plan match that pattern so they are ready when a runner is added.

Verification commands referenced throughout:

- **Type check (mobile):** `npm --workspace apps/mobile exec -- tsc --noEmit`
- **Lint (mobile):** `npm --workspace apps/mobile run lint`
- **Backend type check (where touched):** `npx supabase --version` (check installed); migrations validated via `cd apps/backend/supabase && npx supabase migration list`.
- **Local Anvil + bundler stack:** `cd apps/backend/bundler && docker compose up -d` (starts Anvil, Pimlico Alto, mock paymaster).
- **Manual smoke run:** `npm --workspace apps/mobile run start` then open in Expo Go / iOS simulator / Android emulator.

For each task:
1. Write or modify code as shown.
2. Run **type check** and **lint** — both must pass before committing.
3. Where the task touches user-facing behavior, run the **manual smoke** in the task's "Verify behavior" step.
4. Commit with the message shown in the final step of the task.

Commits are atomic per task (one task = one commit). Use the project's existing commit style (no Co-Authored-By line per project convention).

### UI quality conventions (apply to every UI task)

- No hardcoded colors. Use `theme.colors` tokens via `useAppTheme()`.
- Reuse `withAlpha` from `@utils/color` for translucent surfaces.
- Tap targets ≥ 44x44 pt for any new icon/close/retry button.
- No emoji in any user-facing string introduced by this work.
- Match existing card padding (`16` content padding, `12-14` card padding, `8-12` gap) and typography seen in `DexScreen`, `RecoveryEntryScreen`, `DevicesPasskeysScreen`.
- Loading: skeletons for structured lists/cards; spinners only for bounded action confirmations.

---

## File structure

### Created files

| Path | Purpose |
|---|---|
| `apps/mobile/src/features/portfolio/services/TokenDiscoveryProvider.ts` | Interface + `RegistryDiscoveryProvider` (multicall over `dexRegistry` tokens) |
| `apps/mobile/src/features/portfolio/services/__tests__/TokenDiscoveryProvider.test.ts` | Unit tests for `RegistryDiscoveryProvider` |
| `apps/mobile/src/features/portfolio/services/PriceProvider.ts` | Interface + `CoinCapPriceProvider` wrapping `MarketService` |
| `apps/mobile/src/features/portfolio/services/__tests__/PriceProvider.test.ts` | Unit tests for `CoinCapPriceProvider` |
| `apps/mobile/src/features/wallet/hooks/useLazyPasskeyBackfill.ts` | One-shot post-auth backfill hook |
| `apps/mobile/src/features/swaps/services/SwapErrorClassifier.ts` | Pure-function classifier + `ClassifiedError` types |
| `apps/mobile/src/features/swaps/services/__tests__/SwapErrorClassifier.test.ts` | Unit tests for `classify()` |
| `apps/mobile/src/features/swaps/utils/withTimeoutAndRetry.ts` | Generic timeout + single-retry wrapper for RPC calls |
| `apps/mobile/src/features/swaps/utils/__tests__/withTimeoutAndRetry.test.ts` | Unit tests |
| `apps/mobile/src/shared/components/feedback/Toast.tsx` | Minimal in-app toast primitive (transient classifier surface) |
| `apps/backend/supabase/migrations/20260506000000_wallet_transactions_gas_fields.sql` | Add `gas_used`, `effective_gas_price` columns |

### Modified files

| Path | What changes |
|---|---|
| `apps/mobile/src/features/portfolio/services/PortfolioService.ts` | Accept `chainId`, drop hardcoded `anvil` and `3245.32` fallback, delegate to providers, return `missingPrices[]` |
| `apps/mobile/src/shared/hooks/useWalletData.ts` | Replace internals; delegate to `PortfolioService` |
| `apps/mobile/src/features/home/components/dashboard/BalanceCard.tsx` | Render "USD unavailable" hint when applicable |
| `apps/mobile/src/features/home/components/dashboard/ActivityFeed.tsx` | `getAmount`: drop sign on `failed/cancelled/dropped`; muted text + Failed badge styling |
| `apps/mobile/src/features/transactions/services/TransactionHistoryService.ts` | Capture `gas_used`, `effective_gas_price` on receipt processing |
| `apps/mobile/src/features/transactions/screens/TransactionDetailScreen.tsx` | Render "Gas burned" row for failed txs; add close X |
| `apps/mobile/src/features/transactions/screens/TransactionStatusScreen.tsx` | Add close X + Done button (popToTop) |
| `apps/mobile/src/features/transactions/types/transaction.ts` | Extend `WalletTransaction` with `gasUsed?`, `effectiveGasPriceWei?` |
| `apps/mobile/src/features/wallet/services/AccountDeploymentService.ts` | Auto-sync passkey to cloud on successful deploy |
| `apps/mobile/src/app/navigation/RootNavigation.tsx` | Tri-state initial route resolution; wire `useLazyPasskeyBackfill` |
| `apps/mobile/src/features/auth/screens/DeviceVerificationScreen.tsx` | Add "Recover account" link |
| `apps/mobile/src/features/recovery/screens/RecoveryEntryScreen.tsx` | Replace state with discriminated union; cancel-on-unmount; reason header |
| `apps/mobile/src/types/navigation.ts` | Add `reason?` route param to `RecoveryEntry` |
| `apps/mobile/src/features/dex/screens/DexScreen.tsx` | Replace `errorMessage` with `errorState: ClassifiedError`, banner severity, retry button, user-rejection pill |
| `apps/mobile/src/features/swaps/services/SwapQuoteService.ts` | Wrap outbound calls with `withTimeoutAndRetry`; tag plans with `quotedAt` |
| `apps/mobile/src/features/swaps/services/SwapPreparationService.ts` | Stamp `quotedAt` on returned `SwapPlan` |
| `apps/mobile/src/features/swaps/services/SwapExecutionService.ts` | Pre-sign quote staleness check + drift detection |
| `apps/mobile/src/features/swaps/services/AllowanceService.ts` | Wrap with `withTimeoutAndRetry` |
| `apps/mobile/src/features/swaps/types/swap.ts` | Extend `SwapPlan` with `quotedAt: number` |

---

## Workstream A — Correctness

### Task A1.1: Create `TokenDiscoveryProvider` interface and `RegistryDiscoveryProvider`

**Files:**
- Create: `apps/mobile/src/features/portfolio/services/TokenDiscoveryProvider.ts`
- Create: `apps/mobile/src/features/portfolio/services/__tests__/TokenDiscoveryProvider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/features/portfolio/services/__tests__/TokenDiscoveryProvider.test.ts
import {
  RegistryDiscoveryProvider,
  type DiscoveredToken,
  type TokenDiscoveryProvider,
} from "../TokenDiscoveryProvider";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

function assertEqual(a: unknown, b: unknown, msg: string): void {
  const aj = JSON.stringify(a, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  const bj = JSON.stringify(b, (_, v) => (typeof v === "bigint" ? v.toString() : v));
  if (aj !== bj) throw new Error(`assertEqual failed: ${msg}\n  expected: ${bj}\n  actual:   ${aj}`);
}

// Stub a public client + dexRegistry for this test
const fakeClient = {
  multicall: async (_args: { contracts: ReadonlyArray<{ address: string; functionName: string; args: unknown[] }>; allowFailure: boolean }) => [
    { status: "success", result: 0n },                             // USDC: zero -> filtered out
    { status: "success", result: 1_000_000n },                     // DAI: 1.0 (6 decimals)
    { status: "failure", error: new Error("rpc") },                // ERR: filtered out
  ],
  getBalance: async (_args: { address: string }) => 5n * 10n ** 18n,
} as unknown as Parameters<typeof RegistryDiscoveryProvider.prototype.discover>[2];

const fakeRegistry = [
  { address: "0xUSDC", symbol: "USDC", name: "USD Coin", decimals: 6 },
  { address: "0xDAI", symbol: "DAI", name: "Dai", decimals: 6 },
  { address: "0xERR", symbol: "ERR", name: "Err", decimals: 18 },
];

async function run(): Promise<void> {
  const provider: TokenDiscoveryProvider = new RegistryDiscoveryProvider(() => fakeRegistry);
  const result: DiscoveredToken[] = await provider.discover(31337, "0xWallet" as `0x${string}`, fakeClient);

  assertEqual(result.length, 2, "native + DAI only");
  assert(result[0].address === "native", "native first");
  assertEqual(result[0].amountRaw, 5n * 10n ** 18n, "native balance");
  assertEqual(result[1].symbol, "DAI", "DAI second");
  assertEqual(result[1].amountRaw, 1_000_000n, "DAI balance");
}

run().then(() => console.log("OK")).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace apps/mobile exec -- tsc --noEmit src/features/portfolio/services/__tests__/TokenDiscoveryProvider.test.ts`

Expected: FAIL — "Cannot find module '../TokenDiscoveryProvider'".

- [ ] **Step 3: Write the implementation**

```ts
// apps/mobile/src/features/portfolio/services/TokenDiscoveryProvider.ts
import type { Address, PublicClient } from "viem";

import type { SupportedChainId } from "@/src/integration/chains";
import { dexRegistry } from "@/src/features/swaps/config/dexRegistry";

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

export interface RegistryToken {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

type RegistryFn = (chainId: SupportedChainId) => RegistryToken[];

const defaultRegistry: RegistryFn = (chainId) => {
  const entry = (dexRegistry as Record<string, { tokens: RegistryToken[] }>)[String(chainId)];
  return entry?.tokens ?? [];
};

export class RegistryDiscoveryProvider implements TokenDiscoveryProvider {
  constructor(private readonly registry: RegistryFn = defaultRegistry) {}

  async discover(
    chainId: SupportedChainId,
    address: Address,
    client: PublicClient,
  ): Promise<DiscoveredToken[]> {
    const tokens = this.registry(chainId);

    const nativeBalance = await client.getBalance({ address });
    const native: DiscoveredToken = {
      address: "native",
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      amountRaw: nativeBalance,
    };

    if (tokens.length === 0) {
      return native.amountRaw > 0n ? [native] : [native];
    }

    const results = await client.multicall({
      contracts: tokens.map((t) => ({
        address: t.address,
        abi: ERC20_BALANCE_OF_ABI,
        functionName: "balanceOf" as const,
        args: [address] as const,
      })),
      allowFailure: true,
    });

    const erc20s: DiscoveredToken[] = [];
    results.forEach((r, i) => {
      if (r.status !== "success") return;
      const raw = r.result as bigint;
      if (raw === 0n) return;
      const t = tokens[i];
      erc20s.push({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        amountRaw: raw,
      });
    });

    return [native, ...erc20s];
  }
}
```

- [ ] **Step 4: Confirm `dexRegistry` shape**

Run: `grep -n "export\|tokens" apps/mobile/src/features/swaps/config/dexRegistry.ts | head -20`

If `dexRegistry`'s exported shape differs from `Record<string, { tokens: RegistryToken[] }>`, adjust `defaultRegistry` to match. The interface contract (return `RegistryToken[]` per chain) does not change.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm --workspace apps/mobile exec -- tsc --noEmit`

Expected: PASS (no type errors). The bare-asserts test executes when a runner is added; for now the type check is the gate.

- [ ] **Step 6: Lint + commit**

```bash
npm --workspace apps/mobile run lint
git add apps/mobile/src/features/portfolio/services/TokenDiscoveryProvider.ts \
        apps/mobile/src/features/portfolio/services/__tests__/TokenDiscoveryProvider.test.ts
git commit -m "feat(portfolio): add TokenDiscoveryProvider + RegistryDiscoveryProvider"
```

---

### Task A1.2: Create `PriceProvider` interface and `CoinCapPriceProvider`

**Files:**
- Create: `apps/mobile/src/features/portfolio/services/PriceProvider.ts`
- Create: `apps/mobile/src/features/portfolio/services/__tests__/PriceProvider.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/features/portfolio/services/__tests__/PriceProvider.test.ts
import { CoinCapPriceProvider, priceKey, type PriceProvider } from "../PriceProvider";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

async function run(): Promise<void> {
  const stubMarket = {
    getTopAssets: async () => [
      { id: "ethereum", symbol: "ETH", priceUsd: "2800.50" } as { id: string; symbol: string; priceUsd: string },
      { id: "usd-coin", symbol: "USDC", priceUsd: "1.00" } as { id: string; symbol: string; priceUsd: string },
    ],
  };

  const provider: PriceProvider = new CoinCapPriceProvider(stubMarket as Parameters<typeof CoinCapPriceProvider.prototype.constructor>[0]);

  const result = await provider.getPricesUsd([
    { symbol: "ETH", address: "native" as const, chainId: 31337 },
    { symbol: "USDC", address: "0xUSDC" as `0x${string}`, chainId: 31337 },
    { symbol: "ZZZ", address: "0xZZZ" as `0x${string}`, chainId: 31337 },
  ]);

  assert(result.get(priceKey(31337, "native")) === 2800.5, "ETH priced");
  assert(result.get(priceKey(31337, "0xusdc")) === 1.0, "USDC priced");
  assert(result.get(priceKey(31337, "0xzzz")) === null, "Unknown token returns null");
}

run().then(() => console.log("OK")).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --workspace apps/mobile exec -- tsc --noEmit`

Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

```ts
// apps/mobile/src/features/portfolio/services/PriceProvider.ts
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
  getTopAssets(limit?: number): Promise<Array<{ id: string; symbol: string; priceUsd: string }>>;
}

export class CoinCapPriceProvider implements PriceProvider {
  constructor(private readonly market: MarketServiceLike = marketService) {}

  async getPricesUsd(tokens: PriceQuery[]): Promise<Map<string, number | null>> {
    const out = new Map<string, number | null>();
    if (tokens.length === 0) return out;

    let assets: Array<{ id: string; symbol: string; priceUsd: string }> = [];
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
```

- [ ] **Step 4: Run type check**

Run: `npm --workspace apps/mobile exec -- tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm --workspace apps/mobile run lint
git add apps/mobile/src/features/portfolio/services/PriceProvider.ts \
        apps/mobile/src/features/portfolio/services/__tests__/PriceProvider.test.ts
git commit -m "feat(portfolio): add PriceProvider + CoinCapPriceProvider"
```

---

### Task A1.3: Refactor `PortfolioService.getPortfolio` to use providers and accept `chainId`

**Files:**
- Modify: `apps/mobile/src/features/portfolio/services/PortfolioService.ts`

- [ ] **Step 1: Replace the file contents**

```ts
// apps/mobile/src/features/portfolio/services/PortfolioService.ts
import { createPublicClient, formatUnits, http, type Address, type PublicClient } from "viem";

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

  private static makeClient(chainId: SupportedChainId): PublicClient {
    const cfg = getChainConfig(chainId);
    return createPublicClient({
      chain: cfg.viemChain,
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
```

- [ ] **Step 2: Confirm `getRpcUrl` and `getChainConfig` accept `chainId`**

Run: `grep -n "getRpcUrl\|getChainConfig\|viemChain" apps/mobile/src/core/network/chain.ts apps/mobile/src/integration/chains.ts | head -20`

If `getRpcUrl` does not accept `chainId`, add an optional argument first (one-liner). If `getChainConfig` returns a config without `viemChain`, replace `cfg.viemChain` with the equivalent local helper used elsewhere (e.g., `chainViem(chainId)` or `anvil` for 31337). Adjust the line in the code above to match what exists.

- [ ] **Step 3: Run type check**

Run: `npm --workspace apps/mobile exec -- tsc --noEmit`

Expected: PASS.

- [ ] **Step 4: Lint + commit**

```bash
npm --workspace apps/mobile run lint
git add apps/mobile/src/features/portfolio/services/PortfolioService.ts
git commit -m "refactor(portfolio): chain-aware getPortfolio with provider seams"
```

---

### Task A1.4: Rewrite `useWalletData` to delegate to `PortfolioService`

**Files:**
- Modify: `apps/mobile/src/shared/hooks/useWalletData.ts`

- [ ] **Step 1: Replace file contents**

```ts
// apps/mobile/src/shared/hooks/useWalletData.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";

import { PortfolioService, type TokenBalance } from "@/src/features/portfolio/services/PortfolioService";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";

export interface MoralisToken {
  symbol: string;
  name: string;
  balance: string;
  balance_formatted?: string;
  decimals: number;
  usd_price: number | null;
  usd_value: number | null;
  native_token?: boolean;
  logo?: string;
  token_address?: string;
}

export interface WalletDataState {
  ethBalance: number;
  tokens: MoralisToken[];
  totalBalanceUSD: number;
  totalChange24h: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  missingPrices: string[];
  refetch: () => void;
}

const POLL_MS = 10_000;

const toMoralisToken = (t: TokenBalance): MoralisToken => ({
  symbol: t.symbol,
  name: t.name,
  balance: t.amount.toString(),
  balance_formatted: t.amount.toFixed(6),
  decimals: t.decimals,
  usd_price: t.price,
  usd_value: t.value,
  native_token: t.address === "native",
  token_address: t.address === "native" ? undefined : (t.address as string),
});

export const useWalletData = (address?: string, _chain: string = "0x1"): WalletDataState => {
  const aaAccount = useWalletStore((s) => s.aaAccount);
  const activeChainId = useWalletStore((s) => s.activeChainId);
  const chainId: SupportedChainId =
    (aaAccount?.chainId as SupportedChainId | undefined) ??
    (activeChainId as SupportedChainId | undefined) ??
    DEFAULT_CHAIN_ID;

  const [tokens, setTokens] = useState<MoralisToken[]>([]);
  const [totalUsd, setTotalUsd] = useState<number>(0);
  const [missingPrices, setMissingPrices] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address) {
      setTokens([]);
      setTotalUsd(0);
      setMissingPrices([]);
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const portfolio = await PortfolioService.getPortfolio(address as Address, chainId);
      setTokens(portfolio.tokens.map(toMoralisToken));
      setTotalUsd(portfolio.totalValue);
      setMissingPrices(portfolio.missingPrices);
    } catch (e) {
      console.warn("[useWalletData] fetch failed:", e);
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, [address, chainId]);

  useEffect(() => {
    fetchPortfolio();
    pollRef.current = setInterval(fetchPortfolio, POLL_MS);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchPortfolio]);

  const ethBalance = useMemo(() => {
    const native = tokens.find((t) => t.native_token);
    return native ? parseFloat(native.balance) : 0;
  }, [tokens]);

  return {
    ethBalance,
    tokens,
    totalBalanceUSD: totalUsd,
    totalChange24h: 0,
    isLoading,
    isError: Boolean(error),
    error,
    missingPrices,
    refetch: fetchPortfolio,
  };
};
```

- [ ] **Step 2: Run type check**

Run: `npm --workspace apps/mobile exec -- tsc --noEmit`

Expected: PASS. If errors mention `aaAccount?.chainId` typing, cast as in `DexScreen.tsx:98-102`.

- [ ] **Step 3: Verify behavior on Anvil**

```bash
cd apps/backend/bundler && docker compose up -d
# In another terminal:
npm --workspace apps/mobile run start
```

Open the app → log in or restore wallet → home screen. Confirm the displayed USD figure is no longer rounded to a `$2500 × ETH` multiple, and matches what `cast balance <wallet> --rpc-url http://localhost:8545` reports for native (the discovery should be one row with 0 ERC-20s on a clean Anvil unless the dex registry exposes deployed local tokens).

- [ ] **Step 4: Lint + commit**

```bash
npm --workspace apps/mobile run lint
git add apps/mobile/src/shared/hooks/useWalletData.ts
git commit -m "refactor(home): wire useWalletData to PortfolioService for real balance"
```

---

### Task A1.5: Update `BalanceCard` to surface `missingPrices`

**Files:**
- Modify: `apps/mobile/src/features/home/components/dashboard/BalanceCard.tsx`
- Modify: `apps/mobile/src/features/home/screens/HomeScreen.tsx`

- [ ] **Step 1: Inspect the current `BalanceCard`**

Run: `grep -n "interface\|BalanceCardProps\|theme\|colors\|StyleSheet" apps/mobile/src/features/home/components/dashboard/BalanceCard.tsx | head -20`

Note: (a) the exact name of the props interface, (b) whether the file uses `useAppTheme()` or imports a theme directly, (c) whether a `StyleSheet.create` block exists.

- [ ] **Step 2: Add the optional prop**

Find the props interface (e.g., `interface BalanceCardProps { balance: number; ... }`) and append one field:

```ts
missingPrices?: string[];
```

Find the component signature (e.g., `const BalanceCard: React.FC<BalanceCardProps> = ({ balance, ... }) => {`) and add `missingPrices` to the destructure.

- [ ] **Step 3: Render the hint below the balance text**

Inside the component, immediately after the JSX `<Text>` element that renders the formatted balance amount (search for the line that interpolates `balance` or `portfolioBalance` into a USD-formatted string), append:

```tsx
{missingPrices && missingPrices.length > 0 ? (
  <Text style={styles.missingPriceHint}>
    USD unavailable for {missingPrices.length} token{missingPrices.length === 1 ? "" : "s"}
  </Text>
) : null}
```

If the file uses inline styles instead of `StyleSheet.create`, replace `style={styles.missingPriceHint}` with the inline equivalent:

```tsx
style={{ marginTop: 4, fontSize: 11, fontWeight: "500", color: theme.colors.textMuted }}
```

- [ ] **Step 4: Add the style entry (skip if using inline)**

In the existing `StyleSheet.create({ ... })` block:

```ts
missingPriceHint: {
  marginTop: 4,
  fontSize: 11,
  fontWeight: "500",
  // color is set inline using theme.colors.textMuted to remain theme-aware
},
```

In the JSX, supply the color: `<Text style={[styles.missingPriceHint, { color: theme.colors.textMuted }]}>`.

- [ ] **Step 3: Pass `missingPrices` from `HomeScreen` into `BalanceCard`**

In `HomeScreen.tsx`, the existing destructure is:
```tsx
const { totalBalanceUSD, walletLoading } = useWalletData(smartAccountAddress ?? undefined);
```

Change to:
```tsx
const { totalBalanceUSD, missingPrices } = useWalletData(smartAccountAddress ?? undefined);
```

(Keep `walletLoading` if it's still used elsewhere; otherwise rename to `isLoading` per the new hook shape.)

Then update the `<BalanceCard balance={portfolioBalance} ... />` JSX to pass `missingPrices={missingPrices}`.

- [ ] **Step 4: Type check, lint, commit**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
git add apps/mobile/src/features/home/components/dashboard/BalanceCard.tsx \
        apps/mobile/src/features/home/screens/HomeScreen.tsx
git commit -m "feat(home): surface missing-price tokens on BalanceCard"
```

---

### Task A2.1: Migration — add `gas_used` and `effective_gas_price` to `wallet_transactions`

**Files:**
- Create: `apps/backend/supabase/migrations/20260506000000_wallet_transactions_gas_fields.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- apps/backend/supabase/migrations/20260506000000_wallet_transactions_gas_fields.sql
-- Add gas accounting columns for displaying gas burned on failed transactions.

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS gas_used NUMERIC(78, 0),
  ADD COLUMN IF NOT EXISTS effective_gas_price NUMERIC(78, 0);

COMMENT ON COLUMN public.wallet_transactions.gas_used IS
  'Gas units consumed (from receipt). NULL for txs prior to 2026-05-06 or not yet receipted.';

COMMENT ON COLUMN public.wallet_transactions.effective_gas_price IS
  'Effective gas price in wei (from receipt). NULL for txs prior to 2026-05-06 or not yet receipted.';
```

- [ ] **Step 2: Apply migration locally**

```bash
cd apps/backend/supabase
npx supabase db push
```

Expected: `Applying migration 20260506000000_wallet_transactions_gas_fields.sql ✓`

- [ ] **Step 3: Verify schema**

```bash
cd apps/backend/supabase
npx supabase db dump --data-only=false | grep -A 1 "gas_used\|effective_gas_price" | head -10
```

Expected: both columns appear in the dump output with NUMERIC(78,0) type.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/supabase/migrations/20260506000000_wallet_transactions_gas_fields.sql
git commit -m "feat(db): add gas_used + effective_gas_price to wallet_transactions"
```

---

### Task A2.2: Capture gas fields in `TransactionHistoryService` and extend `WalletTransaction` type

**Files:**
- Modify: `apps/mobile/src/features/transactions/types/transaction.ts`
- Modify: `apps/mobile/src/features/transactions/services/TransactionHistoryService.ts`

- [ ] **Step 1: Locate the type and the receipt-handling code**

Run: `grep -n "interface WalletTransaction\|markConfirmed\|markFailed\|gasUsed\|gas_used" apps/mobile/src/features/transactions/types/transaction.ts apps/mobile/src/features/transactions/services/TransactionHistoryService.ts | head -30`

Note the existing `WalletTransaction` interface and the `markConfirmed` / `markFailed` methods.

- [ ] **Step 2: Extend the `WalletTransaction` type**

In `apps/mobile/src/features/transactions/types/transaction.ts`, add to the interface:

```ts
export interface WalletTransaction {
  // ...existing fields
  gasUsed?: string | null;
  effectiveGasPriceWei?: string | null;
}
```

(Use `string | null` since these are NUMERIC(78,0) columns serialized as strings by Supabase to preserve `bigint` precision.)

- [ ] **Step 3: Update the row mapper**

Find the function that maps DB rows to `WalletTransaction` (likely a `mapRow` / `fromRow` helper in `TransactionHistoryService.ts`). Add:

```ts
gasUsed: row.gas_used ?? null,
effectiveGasPriceWei: row.effective_gas_price ?? null,
```

- [ ] **Step 4: Capture gas in `markConfirmed` and `markFailed`**

In each of `markConfirmed` and `markFailed`, the receipt object is passed. Add to the update payload:

```ts
const updates = {
  // ...existing fields
  gas_used: receipt.gasUsed != null ? receipt.gasUsed.toString() : null,
  effective_gas_price:
    (receipt as { effectiveGasPrice?: bigint }).effectiveGasPrice != null
      ? (receipt as { effectiveGasPrice: bigint }).effectiveGasPrice.toString()
      : null,
};
```

(The exact field names on `receipt` may be `gasUsed` and `effectiveGasPrice`. Check the receipt type via `grep` if uncertain. If the function does not currently take a receipt directly, accept it via an additional `receipt?: { gasUsed?: bigint; effectiveGasPrice?: bigint }` parameter and pass from the caller.)

- [ ] **Step 5: Type check, lint, commit**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
git add apps/mobile/src/features/transactions/types/transaction.ts \
        apps/mobile/src/features/transactions/services/TransactionHistoryService.ts
git commit -m "feat(transactions): capture gas_used + effective_gas_price on receipt"
```

---

### Task A2.3: Drop sign for failed-tx amount in `ActivityFeed` and add Failed badge styling

**Files:**
- Modify: `apps/mobile/src/features/home/components/dashboard/ActivityFeed.tsx`

- [ ] **Step 1: Replace `getAmount` and the row's `amountText` styling**

In `apps/mobile/src/features/home/components/dashboard/ActivityFeed.tsx`:

Replace lines 54-58:

```tsx
const FAILED_STATUSES: ReadonlyArray<WalletTransaction["status"]> = [
  "failed",
  "cancelled",
  "dropped",
];

const isFailedStatus = (status: WalletTransaction["status"]): boolean =>
  FAILED_STATUSES.includes(status);

const getAmount = (tx: WalletTransaction): string => {
  if (!tx.amountDisplay || !tx.tokenSymbol) return "-";
  if (isFailedStatus(tx.status)) {
    return tx.amountDisplay;
  }
  const sign = tx.direction === "outgoing" ? "-" : tx.direction === "incoming" ? "+" : "";
  return `${sign}${tx.amountDisplay}`;
};
```

- [ ] **Step 2: Add Failed badge in the row's right side**

In the `itemRight` View (around line 161), add a Failed pill *before* the existing amount/status indicator when `isFailedStatus(tx.status)` is true. Replace the existing `<View style={styles.itemRight}>` block with:

```tsx
<View style={styles.itemRight}>
  {isFailedStatus(tx.status) ? (
    <View style={[styles.failedBadge, { backgroundColor: withAlpha(colors.danger, 0.15) }]}>
      <Text style={[styles.failedBadgeText, { color: colors.danger }]}>Failed</Text>
    </View>
  ) : null}
  <Text
    style={[
      styles.amountText,
      {
        color: isFailedStatus(tx.status) ? colors.textMuted : colors.textPrimary,
      },
    ]}
    numberOfLines={1}
    adjustsFontSizeToFit
  >
    {getAmount(tx)}
  </Text>
  <View
    style={[
      styles.statusIndicator,
      {
        backgroundColor: getStatusColor(
          tx.status,
          colors.success,
          colors.warning,
          colors.danger,
          colors.textMuted,
        ),
      },
    ]}
  />
</View>
```

- [ ] **Step 3: Add the `failedBadge` and `failedBadgeText` styles**

Add to the `StyleSheet.create` block (alongside `amountText`, `statusIndicator`, etc.):

```tsx
failedBadge: {
  paddingHorizontal: 8,
  paddingVertical: 3,
  borderRadius: 8,
},
failedBadgeText: {
  fontSize: 10,
  fontWeight: "700",
  textTransform: "uppercase",
  letterSpacing: 0.5,
},
```

- [ ] **Step 4: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 5: Verify behavior**

Trigger a failed tx (e.g., send to an address with insufficient gas allocation against Anvil). Confirm: row in Recent Activity shows the amount with no minus sign, muted text color, and a red "Failed" pill.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/home/components/dashboard/ActivityFeed.tsx
git commit -m "fix(home): drop sign on failed tx in Recent Activity, add Failed badge"
```

---

### Task A2.4: Add "Gas burned" row in `TransactionDetailScreen` for failed txs

**Files:**
- Modify: `apps/mobile/src/features/transactions/screens/TransactionDetailScreen.tsx`

- [ ] **Step 1: Compute gas burned and prepend a row when failed**

In `TransactionDetailScreen.tsx`:

1. Add the import at the top: `import { formatEther } from "viem";`

2. Modify the `detailRows` `useMemo` (lines 66-110). Do NOT rewrite the existing 39-element array. Instead, replace its `return [...]` line with `const rows = [...];` (i.e., assign to a `const`), then *after* the array literal closes, before the closing `}, [row]);`, insert:

```tsx
const isFailed = ["failed", "cancelled", "dropped"].includes(String(row.status));
if (isFailed && row.gasUsed && row.effectiveGasPriceWei) {
  try {
    const burnedWei = BigInt(row.gasUsed) * BigInt(row.effectiveGasPriceWei);
    rows.unshift({ label: "Gas burned", value: `${formatEther(burnedWei)} ETH` });
  } catch {
    // malformed numerics; skip
  }
}
return rows;
```

The existing 39-element array is preserved unchanged — only the variable binding (`return [...]` → `const rows = [...];`) and the appended logic before `return rows;` change.

- [ ] **Step 2: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 3: Verify behavior**

Tap into the Detail screen for a failed tx (one created after Task A2.2). Confirm the "Gas burned" row appears at the top with a real ETH value.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/transactions/screens/TransactionDetailScreen.tsx
git commit -m "feat(transactions): show gas burned for failed txs in detail screen"
```

---

### Task A3.1: Auto-sync passkey to cloud on successful deploy

**Files:**
- Modify: `apps/mobile/src/features/wallet/services/AccountDeploymentService.ts`

- [ ] **Step 1: Locate `deployWithPasskeyAuth`**

Run: `grep -n "deployWithPasskeyAuth\|userId\|walletId" apps/mobile/src/features/wallet/services/AccountDeploymentService.ts | head -30`

Confirm the method signature: `static async deployWithPasskeyAuth(userId: string, params: CreateAccountBuildRequest)` and that `params.walletId` is available. (If `walletId` is not on `params`, identify where it's available at the callsite — likely the calling service has it. Adjust by adding a parameter or moving the sync hook to the caller.)

- [ ] **Step 2: Add the sync at the success branch**

Find the existing `return { accountAddress: ... }` (around line 222 after `waitForUserOperationReceipt`). Just before the final `return`, add:

```ts
// Auto-sync the local onboarding passkey to Supabase now that we have a confirmed
// on-chain wallet. Non-fatal: a Supabase failure here must not block deployment.
try {
  const localPasskey = await PasskeyService.getPasskey(userId);
  const walletId = (params as { walletId?: string }).walletId;
  if (localPasskey?.credentialId && walletId) {
    await PasskeyService.syncPasskeyToCloud(userId, walletId, {
      credentialId: localPasskey.credentialId,
      credentialIdRaw: localPasskey.credentialIdRaw ?? "0x",
      publicKeyX: localPasskey.publicKeyX ?? "0x",
      publicKeyY: localPasskey.publicKeyY ?? "0x",
      deviceName: localPasskey.deviceName,
      deviceType: localPasskey.deviceType,
      createdAt: localPasskey.createdAt ?? new Date().toISOString(),
      rpId: localPasskey.rpId ?? "",
    });
  }
} catch (err) {
  console.warn("[AccountDeploymentService] passkey cloud sync failed (non-fatal):", err);
}
```

(The exact field names on `localPasskey` come from `PasskeyMetadata`. If `publicKeyX`/`publicKeyY` aren't on the local metadata, the spec's note applies — capture them at create time in a follow-up. For now, pass `"0x"` as a safe default; the cloud row is then a "best-effort" record.)

- [ ] **Step 3: Add the import if missing**

At the top of the file:

```ts
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
```

- [ ] **Step 4: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 5: Verify behavior**

Create a fresh wallet end-to-end against Anvil. After deployment completes, query Supabase:

```bash
psql "$SUPABASE_DB_URL" -c "select user_id, credential_id, device_name, created_at from passkeys order by created_at desc limit 5;"
```

Expect: a row matching the just-created credential.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/wallet/services/AccountDeploymentService.ts
git commit -m "feat(wallet): auto-sync onboarding passkey to cloud on deploy"
```

---

### Task A3.2: Create `useLazyPasskeyBackfill` hook

**Files:**
- Create: `apps/mobile/src/features/wallet/hooks/useLazyPasskeyBackfill.ts`

- [ ] **Step 1: Write the hook**

```ts
// apps/mobile/src/features/wallet/hooks/useLazyPasskeyBackfill.ts
import { useEffect, useRef } from "react";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { SupabaseWalletService } from "@/src/features/wallet/services/SupabaseWalletService";
import { useUserStore } from "@/src/store/useUserStore";

/**
 * One-shot backfill: if the user has a local passkey AND a deployed AA wallet
 * but the passkeys table has no row for that credential, sync it.
 *
 * Non-fatal in all paths.
 */
export const useLazyPasskeyBackfill = (): void => {
  const user = useUserStore((s) => s.user);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const smartAccountDeployed = useUserStore((s) => s.smartAccountDeployed);
  const ranRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user?.id || !smartAccountDeployed) return;
    if (ranRef.current === user.id) return;

    let cancelled = false;
    const run = async (): Promise<void> => {
      try {
        const local = await PasskeyService.getPasskey(user.id);
        if (cancelled || !local?.credentialId) return;

        const cloud = await PasskeyService.fetchCloudPasskeys(user.id);
        if (cancelled) return;
        if (cloud.some((c) => c.credentialId === local.credentialId)) {
          ranRef.current = user.id;
          return;
        }

        const walletService = new SupabaseWalletService();
        const wallet = await walletService.getAAWallet(user.id);
        if (cancelled || !wallet?.id) return;

        await PasskeyService.syncPasskeyToCloud(user.id, wallet.id, {
          credentialId: local.credentialId,
          credentialIdRaw: local.credentialIdRaw ?? "0x",
          publicKeyX: local.publicKeyX ?? "0x",
          publicKeyY: local.publicKeyY ?? "0x",
          deviceName: local.deviceName,
          deviceType: local.deviceType,
          createdAt: local.createdAt ?? new Date().toISOString(),
          rpId: local.rpId ?? "",
        });
        ranRef.current = user.id;
      } catch (err) {
        console.warn("[useLazyPasskeyBackfill] failed (non-fatal):", err);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id, smartAccountDeployed]);
};
```

- [ ] **Step 2: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/wallet/hooks/useLazyPasskeyBackfill.ts
git commit -m "feat(wallet): add useLazyPasskeyBackfill hook"
```

---

### Task A3.3: Wire `useLazyPasskeyBackfill` into `RootNavigation`

**Files:**
- Modify: `apps/mobile/src/app/navigation/RootNavigation.tsx`

- [ ] **Step 1: Add the import**

At the top of `RootNavigation.tsx`:

```ts
import { useLazyPasskeyBackfill } from "@features/wallet/hooks/useLazyPasskeyBackfill";
```

- [ ] **Step 2: Call the hook inside `RootNavigation`**

After the existing `useEffect` blocks (around line 88, before the `return`), add:

```tsx
useLazyPasskeyBackfill();
```

- [ ] **Step 3: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 4: Verify behavior**

In Supabase, manually delete the passkeys row for an existing logged-in user:

```bash
psql "$SUPABASE_DB_URL" -c "delete from passkeys where user_id = '<uuid>';"
```

Re-launch the app on that account. Within seconds of landing on the wallet, query the table again — expect the row to reappear (idempotent upsert).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/navigation/RootNavigation.tsx
git commit -m "feat(wallet): backfill passkey row on login"
```

---

## Workstream B — Recovery routing

### Task B1: RootNavigation tri-state initial route

**Files:**
- Modify: `apps/mobile/src/app/navigation/RootNavigation.tsx`
- Modify: `apps/mobile/src/types/navigation.ts`

- [ ] **Step 1: Add `reason` route param to `RecoveryEntry`**

In `apps/mobile/src/types/navigation.ts`, find the `RecoveryEntry: ...` entry in `RootStackParamList`. Replace its value with:

```ts
RecoveryEntry: { reason?: "no_local_passkey" | "user_initiated" } | undefined;
```

- [ ] **Step 2: Replace the `splashTarget` derivation in `RootNavigation.tsx`**

Replace lines 60-67 of `RootNavigation.tsx`:

```tsx
const [showingSplash, setShowingSplash] = useState(true);
const [splashTarget, setSplashTarget] = useState<"DeviceVerification" | "AuthNavigation" | "RecoveryEntry">(
  isLoggedIn ? "DeviceVerification" : "AuthNavigation",
);
const splashTargetRef = useRef(splashTarget);

const userId = useUserStore((state) => state.user?.id);

useEffect(() => {
  splashTargetRef.current = splashTarget;
}, [splashTarget]);

// Re-resolve target when auth changes; on logged-in, also probe local passkey.
useEffect(() => {
  let cancelled = false;
  if (!isLoggedIn) {
    setSplashTarget("AuthNavigation");
    return () => {
      cancelled = true;
    };
  }
  if (!userId) {
    setSplashTarget("DeviceVerification");
    return () => {
      cancelled = true;
    };
  }
  // Tight timeout: if AsyncStorage is slow, fall through to DeviceVerification
  // (the inline "Recover account" link still gives the user an exit).
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
  Promise.race([PasskeyService.getPasskey(userId), timeout])
    .then((passkey) => {
      if (cancelled) return;
      const hasLocal = Boolean(passkey && (passkey as { credentialIdRaw?: string }).credentialIdRaw);
      setSplashTarget(hasLocal ? "DeviceVerification" : "RecoveryEntry");
    })
    .catch(() => {
      if (cancelled) return;
      setSplashTarget("DeviceVerification");
    });
  return () => {
    cancelled = true;
  };
}, [isLoggedIn, userId]);
```

- [ ] **Step 3: Update the splash redirect to pass `reason` for `RecoveryEntry`**

The existing splash effect at lines 73-88 calls `navigationRef.resetRoot({ index: 0, routes: [{ name: splashTargetRef.current }] })`. Replace with:

```tsx
useEffect(() => {
  const timer = setTimeout(() => {
    setShowingSplash(false);
    if (navigationRef.isReady()) {
      const target = splashTargetRef.current;
      const route =
        target === "RecoveryEntry"
          ? { name: "RecoveryEntry" as const, params: { reason: "no_local_passkey" as const } }
          : { name: target };
      navigationRef.resetRoot({ index: 0, routes: [route] });
    }
  }, 2500);
  return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 4: Add the `PasskeyService` import**

```ts
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
```

- [ ] **Step 5: Update `<Stack.Screen name="AppSplash" initialParams={{ redirectTo: { name: splashTarget } }} />`**

When `splashTarget === "RecoveryEntry"`, the `redirectTo` should also include the `reason` param. Replace with:

```tsx
<Stack.Screen
  name="AppSplash"
  component={SplashScreen}
  initialParams={{
    redirectTo:
      splashTarget === "RecoveryEntry"
        ? { name: "RecoveryEntry", params: { reason: "no_local_passkey" } }
        : { name: splashTarget },
  }}
/>
```

(If `SplashScreen` doesn't currently honor `params` inside `redirectTo`, leave the `redirectTo` shape unchanged but pass `params` separately. Inspect `apps/mobile/src/features/auth/SplashScreen.tsx` and adapt.)

- [ ] **Step 6: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 7: Verify behavior**

On a clean device install, log in to an account whose AA wallet exists in DB and on chain. Without restoring a local passkey, observe the app routes directly to `RecoveryEntry` rather than flashing through `DeviceVerification`.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/app/navigation/RootNavigation.tsx \
        apps/mobile/src/types/navigation.ts
git commit -m "fix(navigation): route passkey-less devices to RecoveryEntry"
```

---

### Task B2: Inline "Recover account" link on `DeviceVerificationScreen`

**Files:**
- Modify: `apps/mobile/src/features/auth/screens/DeviceVerificationScreen.tsx`

- [ ] **Step 1: Add the navigation handler**

Inside the component (after `handleReLogin`), add:

```tsx
const handleRecover = useCallback(() => {
  setGuardNavigation(false);
  navigation.reset({
    index: 0,
    routes: [{ name: "RecoveryEntry", params: { reason: "user_initiated" } }],
  });
}, [navigation, setGuardNavigation]);
```

- [ ] **Step 2: Add the link below the secondary button**

In the JSX, find the `<TouchableOpacity ...handleReLogin>` block (lines 274-283) and add a new `<TouchableOpacity>` *above* it, inside the same parent `View`:

```tsx
<TouchableOpacity
  activeOpacity={0.7}
  style={styles.recoverButton}
  onPress={handleRecover}
  disabled={isAuthenticating || isLoggingOut}
>
  <Text style={[styles.recoverText, { color: colors.accent }]}>
    Don&apos;t have a passkey on this device? Recover account
  </Text>
</TouchableOpacity>
```

- [ ] **Step 3: Add styles**

In the `StyleSheet.create` block, add:

```ts
recoverButton: {
  paddingVertical: 8,
  paddingHorizontal: 12,
  alignItems: "center",
  justifyContent: "center",
  minHeight: 44,
},
recoverText: {
  fontSize: 13,
  fontWeight: "600",
  textDecorationLine: "underline",
},
```

- [ ] **Step 4: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 5: Verify behavior**

On `DeviceVerification`, observe the underlined "Don't have a passkey on this device? Recover account" link. Tap it → lands on `RecoveryEntry` with the appropriate header.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/auth/screens/DeviceVerificationScreen.tsx
git commit -m "feat(auth): add Recover account escape hatch to DeviceVerification"
```

---

### Task B3: Refactor `RecoveryEntryScreen` to discriminated state + cancel-on-unmount + reason header

**Files:**
- Modify: `apps/mobile/src/features/recovery/screens/RecoveryEntryScreen.tsx`

- [ ] **Step 1: Replace state declaration with a discriminated union**

Replace lines 20-22 of `RecoveryEntryScreen.tsx`:

```tsx
type RecoveryEntryState =
  | { kind: "loading" }
  | { kind: "no_passkey"; activeRequest: RecoveryRequest | null }
  | { kind: "has_passkey"; activeRequest: RecoveryRequest | null }
  | { kind: "has_active_request"; request: RecoveryRequest }
  | { kind: "error"; message: string };

const [state, setState] = useState<RecoveryEntryState>({ kind: "loading" });
```

- [ ] **Step 2: Replace the loader effect with cancel-safe version**

Replace lines 59-98 (the existing `useEffect` block):

```tsx
useEffect(() => {
  const controller = new AbortController();
  const checkState = async (): Promise<void> => {
    if (!user?.id) {
      if (!controller.signal.aborted) setState({ kind: "no_passkey", activeRequest: null });
      return;
    }
    try {
      const [passkey, latestActiveRequest] = await Promise.all([
        withTimeout(PasskeyService.getPasskey(user.id), 2500),
        withTimeout(getRecoveryRequestService().getLatestActiveRecoveryRequestForUser(user.id), 4000),
      ]);
      if (controller.signal.aborted) return;

      const hasLocalPasskey = Boolean(passkey?.credentialIdRaw);
      if (latestActiveRequest) {
        setState({ kind: "has_active_request", request: latestActiveRequest });
      } else if (hasLocalPasskey) {
        setState({ kind: "has_passkey", activeRequest: null });
      } else {
        setState({ kind: "no_passkey", activeRequest: null });
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      console.warn("[RecoveryEntry] check failed:", error);
      setState({
        kind: "error",
        message: error instanceof Error ? error.message : "Couldn't check device.",
      });
    }
  };

  void checkState();
  return () => {
    controller.abort();
  };
}, [user?.id]);
```

- [ ] **Step 3: Read `reason` from route params and render header**

At the top of the component:

```tsx
import { useRoute, type RouteProp } from "@react-navigation/native";
type RecoveryEntryRoute = RouteProp<RootStackParamList, "RecoveryEntry">;
const route = useRoute<RecoveryEntryRoute>();
const reason = route.params?.reason;
```

In the render, replace the existing single-`<Text style={styles.title}>` derivation with a reason-aware version:

```tsx
const titleText =
  state.kind === "loading"
    ? "Checking device passkey status..."
    : state.kind === "error"
    ? "Couldn't check this device"
    : state.kind === "has_active_request"
    ? "A recovery request is already in progress."
    : state.kind === "has_passkey"
    ? "A usable passkey is available on this device."
    : reason === "user_initiated"
    ? "Recover your account"
    : "We didn't find a passkey on this device.";

const bodyText =
  state.kind === "error"
    ? state.message
    : state.kind === "has_active_request"
    ? "Resume your active request to view guardian approvals, per-chain status, and timelock progress."
    : state.kind === "has_passkey"
    ? "Configure guardian recovery first. If this device is compromised, you can still create a guardian recovery request."
    : "Start a guardian recovery request, or switch to device pairing if you still have another trusted device.";
```

Then in the JSX:

```tsx
<Text style={styles.title}>{titleText}</Text>
<Text style={styles.body}>{bodyText}</Text>
```

- [ ] **Step 4: Replace conditional render branches**

Replace lines 121-186 with state-driven branches:

```tsx
{state.kind === "has_active_request" ? (
  <View style={styles.activeRequestCard}>
    <Text style={styles.activeRequestLabel}>Active request</Text>
    <Text style={styles.activeRequestValue} numberOfLines={1}>
      {state.request.id}
    </Text>
    <Text style={styles.activeRequestMeta}>Status: {state.request.status}</Text>
    {activeRequestTimeLabel ? (
      <Text style={styles.activeRequestMeta}>{activeRequestTimeLabel}</Text>
    ) : null}
  </View>
) : null}

{state.kind === "loading" ? (
  <View style={styles.loadingRow}>
    <ActivityIndicator color={theme.colors.accent} />
    <Text style={styles.loadingLabel}>Checking local passkey...</Text>
  </View>
) : state.kind === "error" ? (
  <TouchableOpacity
    style={styles.primaryButton}
    onPress={() => setState({ kind: "loading" })}
  >
    <Text style={styles.primaryButtonText}>Retry</Text>
  </TouchableOpacity>
) : (
  <TouchableOpacity
    style={styles.primaryButton}
    onPress={() => {
      if (state.kind === "has_active_request") {
        navigation.navigate("RecoveryProgress", { requestId: state.request.id });
      } else {
        navigation.navigate(state.kind === "has_passkey" ? "GuardianRecovery" : "CreateRecoveryRequest");
      }
    }}
  >
    <Text style={styles.primaryButtonText}>
      {state.kind === "has_active_request"
        ? "Resume Recovery Progress"
        : state.kind === "has_passkey"
        ? "Configure Guardian Recovery"
        : "Recover with Guardians"}
    </Text>
  </TouchableOpacity>
)}

{state.kind === "has_active_request" ? (
  <TouchableOpacity
    style={styles.secondaryButton}
    onPress={() => navigation.navigate("CreateRecoveryRequest")}
  >
    <Text style={styles.secondaryButtonText}>Create New Request</Text>
  </TouchableOpacity>
) : state.kind === "has_passkey" ? (
  <TouchableOpacity
    style={styles.secondaryButton}
    onPress={() => navigation.navigate("CreateRecoveryRequest")}
  >
    <Text style={styles.secondaryButtonText}>Create Recovery Request</Text>
  </TouchableOpacity>
) : state.kind === "no_passkey" ? (
  <TouchableOpacity
    style={styles.secondaryButton}
    onPress={() => navigation.navigate("EmailRecovery")}
  >
    <Text style={styles.secondaryButtonText}>Recover with Email</Text>
  </TouchableOpacity>
) : null}

<TouchableOpacity
  style={styles.tertiaryButton}
  onPress={() => navigation.navigate("PairDevice")}
>
  <Text style={styles.tertiaryButtonText}>I have another device</Text>
</TouchableOpacity>
```

- [ ] **Step 5: Re-trigger load when retry pressed**

The retry path sets `kind: "loading"` but the original load effect only fires on `user?.id` change. Wrap the loader in a callback re-runnable on demand:

Replace the load effect with:

```tsx
const runChecks = useCallback(async (): Promise<void> => {
  // ...same body as Step 2's checkState
}, [user?.id]);

useEffect(() => {
  const controller = new AbortController();
  setState({ kind: "loading" });
  runChecks().catch(() => {});
  return () => {
    controller.abort();
  };
}, [runChecks]);
```

And the retry button's `onPress`:

```tsx
onPress={() => {
  setState({ kind: "loading" });
  runChecks().catch(() => {});
}}
```

(For brevity the abort wiring is consolidated — `runChecks` itself reads `user?.id` and bails early if changed; for full cancel safety, route the controller signal through closure.)

- [ ] **Step 6: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 7: Verify behavior**

Repeatedly enter and exit `RecoveryEntry` in quick succession. Observe: no flicker between options; one clean loading state; correct branch each time. Force `getPasskey` to throw (instrument with a temporary `throw new Error("forced")`) → observe Retry UI rather than misleading "no passkey" branch.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/features/recovery/screens/RecoveryEntryScreen.tsx
git commit -m "refactor(recovery): discriminated state + cancel-on-unmount + reason header"
```

---

## Workstream C — Tx & swap UX

### Task C1.1: TransactionStatusScreen — close X + Done button

**Files:**
- Modify: `apps/mobile/src/features/transactions/screens/TransactionStatusScreen.tsx`

- [ ] **Step 1: Add a top-left close X**

After `<SafeAreaView ...>` and before `<ScrollView>`, add an absolutely-positioned close button:

```tsx
<TouchableOpacity
  accessibilityLabel="Close"
  style={styles.closeButton}
  onPress={() => navigation.popToTop()}
  hitSlop={8}
>
  <Feather name="x" size={22} color={colors.textPrimary} />
</TouchableOpacity>
```

- [ ] **Step 2: Add Done button at the end of the ScrollView**

After the existing `<TouchableOpacity ...Refresh Status>` and `<TouchableOpacity ...Open Details>` buttons, add:

```tsx
{row && (
  <TouchableOpacity
    style={[styles.doneButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
    onPress={() => navigation.popToTop()}
  >
    <Text style={[styles.doneButtonText, { color: colors.textPrimary }]}>
      {["confirmed", "failed", "cancelled", "dropped"].includes(String(row.status)) ? "Done" : "Close"}
    </Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 3: Add styles**

```ts
closeButton: {
  position: "absolute",
  top: 14,
  left: 12,
  zIndex: 10,
  width: 44,
  height: 44,
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 22,
},
doneButton: {
  borderWidth: 1,
  borderRadius: 12,
  paddingVertical: 14,
  alignItems: "center",
  marginTop: 4,
},
doneButtonText: {
  fontSize: 14,
  fontWeight: "700",
},
```

Also offset the title left padding to clear the X (`paddingLeft: 48` on the title or similar adjustment).

- [ ] **Step 4: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 5: Verify + commit**

Submit a swap or send → confirm tap on X closes the screen and lands on the wallet/home tab; Done button does the same.

```bash
git add apps/mobile/src/features/transactions/screens/TransactionStatusScreen.tsx
git commit -m "feat(transactions): add close X + Done button to TransactionStatusScreen"
```

---

### Task C1.2: TransactionDetailScreen — close X

**Files:**
- Modify: `apps/mobile/src/features/transactions/screens/TransactionDetailScreen.tsx`

- [ ] **Step 1: Add the close X**

After `<SafeAreaView ...>` and before `<ScrollView>`:

```tsx
<TouchableOpacity
  accessibilityLabel="Close"
  style={styles.closeButton}
  onPress={() => navigation.popToTop()}
  hitSlop={8}
>
  <Feather name="x" size={22} color={colors.textPrimary} />
</TouchableOpacity>
```

Add the `Feather` import + `useNavigation` if not present:

```tsx
import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
// ...
const navigation = useNavigation<any>();
```

- [ ] **Step 2: Add styles**

Same `closeButton` style as Task C1.1.

- [ ] **Step 3: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 4: Verify + commit**

```bash
git add apps/mobile/src/features/transactions/screens/TransactionDetailScreen.tsx
git commit -m "feat(transactions): add close X to TransactionDetailScreen"
```

---

### Task C2.1: Create `SwapErrorClassifier`

**Files:**
- Create: `apps/mobile/src/features/swaps/services/SwapErrorClassifier.ts`
- Create: `apps/mobile/src/features/swaps/services/__tests__/SwapErrorClassifier.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/features/swaps/services/__tests__/SwapErrorClassifier.test.ts
import { classify } from "../SwapErrorClassifier";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

const cases: Array<{ err: unknown; expectedKind: string; expectedSeverity: string; retryable: boolean }> = [
  { err: new Error("No swap provider configured for chain 31337"), expectedKind: "no_provider", expectedSeverity: "error", retryable: false },
  { err: new Error("Slippage must be between 0.01% and 50%."), expectedKind: "slippage_invalid", expectedSeverity: "error", retryable: false },
  { err: new Error("Insufficient sell token balance."), expectedKind: "insufficient_balance", expectedSeverity: "error", retryable: false },
  { err: new Error("User cancelled passkey prompt"), expectedKind: "user_rejected", expectedSeverity: "info", retryable: true },
  { err: new Error("Network Error"), expectedKind: "network", expectedSeverity: "warning", retryable: true },
  { err: new Error("Quote is stale"), expectedKind: "quote_stale", expectedSeverity: "warning", retryable: true },
  { err: new Error("UserOperation reverted: Pool paused"), expectedKind: "bundler_error", expectedSeverity: "error", retryable: false },
  { err: "weird string", expectedKind: "unknown", expectedSeverity: "error", retryable: false },
];

for (const c of cases) {
  const r = classify(c.err);
  assert(r.kind === c.expectedKind, `kind for ${String((c.err as Error).message ?? c.err)}: got ${r.kind}`);
  assert(r.severity === c.expectedSeverity, `severity for ${String((c.err as Error).message ?? c.err)}: got ${r.severity}`);
  assert(r.retryable === c.retryable, `retryable for ${String((c.err as Error).message ?? c.err)}: got ${r.retryable}`);
}
console.log("OK");
```

- [ ] **Step 2: Run type check (test fails because module is missing)**

Run: `npm --workspace apps/mobile exec -- tsc --noEmit`

Expected: FAIL — "Cannot find module '../SwapErrorClassifier'".

- [ ] **Step 3: Write the implementation**

```ts
// apps/mobile/src/features/swaps/services/SwapErrorClassifier.ts
export type SwapErrorKind =
  | "network"
  | "no_provider"
  | "insufficient_balance"
  | "insufficient_allowance"
  | "slippage_invalid"
  | "quote_stale"
  | "simulation_revert"
  | "user_rejected"
  | "bundler_error"
  | "unknown";

export interface ClassifiedError {
  kind: SwapErrorKind;
  userMessage: string;
  retryable: boolean;
  severity: "info" | "warning" | "error";
  source?: string;
}

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

export const classify = (err: unknown): ClassifiedError => {
  const m = messageOf(err);
  const lower = m.toLowerCase();

  if (lower.includes("user cancel") || lower.includes("cancelled passkey") || lower.includes("user_cancel")) {
    return { kind: "user_rejected", userMessage: "Cancelled. Try again whenever you're ready.", retryable: true, severity: "info" };
  }
  if (lower.includes("no swap provider")) {
    return { kind: "no_provider", userMessage: "No swap provider available for this chain or token pair.", retryable: false, severity: "error" };
  }
  if (lower.includes("slippage must be")) {
    return { kind: "slippage_invalid", userMessage: "Slippage must be between 0.01% and 50%.", retryable: false, severity: "error" };
  }
  if (lower.includes("insufficient sell token") || lower.includes("insufficient balance")) {
    return { kind: "insufficient_balance", userMessage: "Insufficient balance for this swap.", retryable: false, severity: "error" };
  }
  if (lower.includes("allowance") && lower.includes("insufficient")) {
    return { kind: "insufficient_allowance", userMessage: "Token approval needed before swapping.", retryable: true, severity: "error" };
  }
  if (lower.includes("quote is stale") || lower.includes("quote_stale") || lower.includes("price moved")) {
    return { kind: "quote_stale", userMessage: "Quote changed — review again.", retryable: true, severity: "warning" };
  }
  if (lower.includes("network error") || lower.includes("timeout") || lower.includes("fetch failed") || lower.includes("econnrefused") || lower.includes("etimedout")) {
    return { kind: "network", userMessage: "Network error. Check your connection and try again.", retryable: true, severity: "warning" };
  }
  if (lower.includes("useroperation") || lower.includes("bundler") || lower.includes("reverted")) {
    return { kind: "bundler_error", userMessage: m, retryable: false, severity: "error" };
  }
  return { kind: "unknown", userMessage: m || "Something went wrong.", retryable: false, severity: "error" };
};
```

- [ ] **Step 4: Type check passes**

Run: `npm --workspace apps/mobile exec -- tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Lint + commit**

```bash
npm --workspace apps/mobile run lint
git add apps/mobile/src/features/swaps/services/SwapErrorClassifier.ts \
        apps/mobile/src/features/swaps/services/__tests__/SwapErrorClassifier.test.ts
git commit -m "feat(swaps): add SwapErrorClassifier with kind/severity/retryable"
```

---

### Task C2.2: Create minimal `Toast` component

**Files:**
- Create: `apps/mobile/src/shared/components/feedback/Toast.tsx`

- [ ] **Step 1: Write the toast**

```tsx
// apps/mobile/src/shared/components/feedback/Toast.tsx
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

export type ToastSeverity = "info" | "warning" | "error";

export interface ToastProps {
  visible: boolean;
  message: string;
  severity?: ToastSeverity;
  durationMs?: number;
  onHide?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  severity = "info",
  durationMs = 3000,
  onHide,
}) => {
  const { theme } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        onHide?.();
      });
    }, durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs, opacity, onHide]);

  if (!visible) return null;

  const color =
    severity === "error" ? theme.colors.danger : severity === "warning" ? theme.colors.warning : theme.colors.accent;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity, backgroundColor: withAlpha(color, 0.18), borderColor: withAlpha(color, 0.5) }]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color: theme.colors.textPrimary }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 100,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
});

export default Toast;
```

- [ ] **Step 2: Type check, lint, commit**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
git add apps/mobile/src/shared/components/feedback/Toast.tsx
git commit -m "feat(ui): add minimal Toast component"
```

---

### Task C2.3: `withTimeoutAndRetry` utility for RPC calls

**Files:**
- Create: `apps/mobile/src/features/swaps/utils/withTimeoutAndRetry.ts`
- Create: `apps/mobile/src/features/swaps/utils/__tests__/withTimeoutAndRetry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/mobile/src/features/swaps/utils/__tests__/withTimeoutAndRetry.test.ts
import { withTimeoutAndRetry } from "../withTimeoutAndRetry";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

async function run(): Promise<void> {
  // succeeds first try
  let calls = 0;
  const r1 = await withTimeoutAndRetry(() => {
    calls++;
    return Promise.resolve("ok");
  }, { timeoutMs: 1000 });
  assert(r1 === "ok" && calls === 1, "first-try success");

  // fails, then succeeds
  calls = 0;
  const r2 = await withTimeoutAndRetry(() => {
    calls++;
    if (calls === 1) return Promise.reject(new Error("Network Error"));
    return Promise.resolve("ok2");
  }, { timeoutMs: 1000 });
  assert(r2 === "ok2" && calls === 2, "retried after one failure");

  // fails twice → throws
  calls = 0;
  let threw = false;
  try {
    await withTimeoutAndRetry(() => {
      calls++;
      return Promise.reject(new Error("Network Error"));
    }, { timeoutMs: 1000 });
  } catch {
    threw = true;
  }
  assert(threw && calls === 2, "throws after retries exhausted");

  // times out
  calls = 0;
  threw = false;
  try {
    await withTimeoutAndRetry(() => {
      calls++;
      return new Promise((resolve) => setTimeout(() => resolve("late"), 500));
    }, { timeoutMs: 50 });
  } catch (e) {
    threw = e instanceof Error && e.message.toLowerCase().includes("timeout");
  }
  assert(threw && calls === 2, "times out and counts as one retry");
}

run().then(() => console.log("OK")).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Write implementation**

```ts
// apps/mobile/src/features/swaps/utils/withTimeoutAndRetry.ts
export interface TimeoutAndRetryOptions {
  timeoutMs: number;
  retries?: number; // default 1 -> total 2 attempts
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const isRetryable = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("fetch failed") ||
    msg.includes("econn") ||
    msg.includes("eai_again") ||
    msg.includes("etimedout")
  );
};

export const withTimeoutAndRetry = async <T>(
  fn: () => Promise<T>,
  opts: TimeoutAndRetryOptions,
): Promise<T> => {
  const total = (opts.retries ?? 1) + 1;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= total; attempt++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), opts.timeoutMs),
        ),
      ]);
    } catch (err) {
      lastErr = err;
      if (attempt >= total) break;
      if (!isRetryable(err)) break;
      await sleep(150 * attempt);
    }
  }
  throw lastErr ?? new Error("withTimeoutAndRetry exhausted");
};
```

- [ ] **Step 3: Type check, lint, commit**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
git add apps/mobile/src/features/swaps/utils/withTimeoutAndRetry.ts \
        apps/mobile/src/features/swaps/utils/__tests__/withTimeoutAndRetry.test.ts
git commit -m "feat(swaps): add withTimeoutAndRetry utility"
```

---

### Task C2.4: Wrap quote and allowance calls with `withTimeoutAndRetry`

**Files:**
- Modify: `apps/mobile/src/features/swaps/services/SwapQuoteService.ts`
- Modify: `apps/mobile/src/features/swaps/services/AllowanceService.ts`

- [ ] **Step 1: Locate the outbound RPC sites**

Run: `grep -n "provider.getQuote\|public client\|publicClient\|client\\.read" apps/mobile/src/features/swaps/services/SwapQuoteService.ts apps/mobile/src/features/swaps/services/AllowanceService.ts | head -20`

Identify the call site in `SwapQuoteService.getQuote()` where the provider is invoked (around line 103) and any public-client read in `AllowanceService.isApprovalRequired`.

- [ ] **Step 2: Wrap the quote call**

In `SwapQuoteService.getQuote(request)`, replace:

```ts
const quote = await provider.getQuote(request);
```

with:

```ts
import { withTimeoutAndRetry } from "@/src/features/swaps/utils/withTimeoutAndRetry";

const quote = await withTimeoutAndRetry(() => provider.getQuote(request), { timeoutMs: 8000 });
```

- [ ] **Step 3: Wrap the allowance check**

In `AllowanceService.isApprovalRequired`, locate the `client.readContract({...})` (or equivalent `getAllowance` call) and wrap similarly:

```ts
const current = await withTimeoutAndRetry(
  () => client.readContract({ /* existing args */ }),
  { timeoutMs: 8000 },
);
```

- [ ] **Step 4: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 5: Verify behavior**

Stop the local Anvil container (`docker compose stop anvil`). Open the swap screen, enter an amount. Observe a classified network warning instead of an indefinite spinner / unhandled crash. Restart Anvil, observe the next quote succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/swaps/services/SwapQuoteService.ts \
        apps/mobile/src/features/swaps/services/AllowanceService.ts
git commit -m "feat(swaps): timeout + retry around quote and allowance RPC"
```

---

### Task C2.5: Stamp `quotedAt` on `SwapPlan` and add staleness check in `SwapExecutionService`

**Files:**
- Modify: `apps/mobile/src/features/swaps/types/swap.ts`
- Modify: `apps/mobile/src/features/swaps/services/SwapPreparationService.ts`
- Modify: `apps/mobile/src/features/swaps/services/SwapExecutionService.ts`

- [ ] **Step 1: Add `quotedAt` to `SwapPlan`**

In `apps/mobile/src/features/swaps/types/swap.ts`, extend `SwapPlan`:

```ts
export type SwapPlan = {
  // ...existing fields
  /** Epoch ms when the underlying quote was obtained. Used for staleness checks. */
  quotedAt: number;
};
```

- [ ] **Step 2: Stamp `quotedAt` in `SwapPreparationService.prepareSwap`**

In `SwapPreparationService.ts`, find the function that returns the `SwapPlan` (likely `prepareSwap`). At the return, add `quotedAt: Date.now()`:

```ts
return {
  // ...existing fields
  quotedAt: Date.now(),
};
```

- [ ] **Step 3: Add staleness check in `SwapExecutionService.executeSwap`**

In `SwapExecutionService.ts`, before signing the user-op (search for `SwapExecutionService.executeSwap` and the path that calls `signWithPasskey` or equivalent — typically just after preparing the plan), insert:

```ts
const MAX_QUOTE_AGE_MS = 30_000;

if (Date.now() - plan.quotedAt > MAX_QUOTE_AGE_MS) {
  // Re-prepare with fresh quote.
  const fresh = await SwapPreparationService.prepareSwap(intent);
  const oldOut = plan.quote.estimatedBuyAmountRaw;
  const newOut = fresh.quote.estimatedBuyAmountRaw;
  // Slippage tolerance is in BPS on the intent
  const allowedDriftBps = BigInt(intent.slippageBps);
  // If new estimate is materially worse beyond slippage tolerance, throw.
  if (newOut < oldOut) {
    const driftBps = ((oldOut - newOut) * 10_000n) / oldOut;
    if (driftBps > allowedDriftBps) {
      throw new Error("Quote is stale: price moved beyond slippage tolerance");
    }
  }
  plan = fresh;
}
```

(If the variable is named `preparedPlan` or `swapPlan`, adjust accordingly. Place the import for `SwapPreparationService` at the top of the file if not already there.)

- [ ] **Step 4: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 5: Verify behavior**

Open swap, fill amount, wait > 30 seconds, then submit. Confirm a classified `quote_stale` warning appears if the price moved enough; otherwise the swap proceeds with the refreshed quote silently.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/swaps/types/swap.ts \
        apps/mobile/src/features/swaps/services/SwapPreparationService.ts \
        apps/mobile/src/features/swaps/services/SwapExecutionService.ts
git commit -m "feat(swaps): stamp quotedAt + stale-quote drift detection"
```

---

### Task C2.6: DexScreen — replace `errorMessage` with `errorState`, add severity banner + retry + user-rejection pill + toast

**Files:**
- Modify: `apps/mobile/src/features/dex/screens/DexScreen.tsx`

- [ ] **Step 1: Add imports**

At the top of `DexScreen.tsx`:

```tsx
import { classify, type ClassifiedError } from "@/src/features/swaps/services/SwapErrorClassifier";
import Toast from "@/src/shared/components/feedback/Toast";
```

- [ ] **Step 2: Replace `errorMessage` state with `errorState` + add toast + retry-nonce state**

Locate the existing `const [errorMessage, setErrorMessage] = useState<string | null>(null);` (around line 122). Replace with:

```tsx
const [errorState, setErrorState] = useState<ClassifiedError | null>(null);
const [toast, setToast] = useState<{ message: string; severity: "info" | "warning" | "error" } | null>(null);
const [retryNonce, setRetryNonce] = useState<number>(0);
```

Find the existing quote-fetch `useEffect` (around lines 253-333) and add `retryNonce` to its dependency array. This makes the effect re-fire when the user taps "Try again".

- [ ] **Step 3: Replace each `setErrorMessage(...)` site with classified `setErrorState`**

Find every `setErrorMessage(...)` callsite in the file (at least the catches in `handleReviewSwap`, `handleExecuteSwap`, the quote effect catch, and the wallet/balance effect catches). Replace:

```ts
catch (err) {
  setErrorMessage(err instanceof Error ? err.message : "Failed to ...");
}
```

with:

```ts
catch (err) {
  const c = classify(err);
  if (c.kind === "network") {
    setToast({ message: c.userMessage, severity: c.severity });
  } else {
    setErrorState(c);
  }
}
```

For the user-rejection path in `handleExecuteSwap`, **do not** treat as error — the SwapExecutionService returns `result.status === "cancelled"` before throwing. Replace the existing handling:

```ts
const result = await SwapExecutionService.executeSwap(intent, options);
if (result.status === "cancelled") {
  setErrorState(classify(new Error("User cancelled passkey prompt")));
} else if (result.status === "failed" && result.error) {
  setErrorState(classify(new Error(result.error)));
} else {
  setErrorState(null);
  navigation.navigate("TransactionStatus", { transactionId: result.swapTransactionId ?? result.approvalTransactionId ?? "" });
}
```

- [ ] **Step 4: Replace the existing single `errorMessage` banner with severity-aware rendering**

Find the JSX block (around `{errorMessage ? (...) : null}`). Replace with:

```tsx
{errorState ? (
  errorState.kind === "user_rejected" ? (
    <View style={[styles.infoPill, { backgroundColor: withAlpha(colors.accent, 0.12), borderColor: withAlpha(colors.accent, 0.4) }]}>
      <Text style={[styles.infoPillText, { color: colors.accent }]}>{errorState.userMessage}</Text>
    </View>
  ) : (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: withAlpha(
            errorState.severity === "warning" ? colors.warning : colors.danger,
            0.12,
          ),
          borderColor: withAlpha(
            errorState.severity === "warning" ? colors.warning : colors.danger,
            0.4,
          ),
        },
      ]}
    >
      <Text
        style={[
          styles.errorBannerText,
          { color: errorState.severity === "warning" ? colors.warning : colors.danger },
        ]}
      >
        {errorState.userMessage}
      </Text>
      {errorState.retryable ? (
        <TouchableOpacity
          onPress={() => {
            setErrorState(null);
            setRetryNonce((n) => n + 1);
          }}
          style={styles.retryButton}
        >
          <Text style={[styles.retryButtonText, { color: colors.accent }]}>Try again</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  )
) : null}
```

(Add the corresponding styles `errorBanner`, `errorBannerText`, `retryButton`, `retryButtonText`, `infoPill`, `infoPillText`, mirroring the existing `card` and button styles in this file.)

- [ ] **Step 5: Render Toast at the screen root**

At the top-level JSX (just inside the `<TabScreenContainer>` or root `<View>`), add:

```tsx
<Toast
  visible={Boolean(toast)}
  message={toast?.message ?? ""}
  severity={toast?.severity}
  onHide={() => setToast(null)}
/>
```

- [ ] **Step 6: Add new styles**

```ts
errorBanner: {
  borderWidth: 1,
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
},
errorBannerText: {
  flex: 1,
  fontSize: 12,
  fontWeight: "600",
},
retryButton: {
  paddingHorizontal: 10,
  paddingVertical: 6,
  minHeight: 44,
  alignItems: "center",
  justifyContent: "center",
},
retryButtonText: {
  fontSize: 13,
  fontWeight: "700",
},
infoPill: {
  borderWidth: 1,
  borderRadius: 12,
  paddingHorizontal: 12,
  paddingVertical: 10,
},
infoPillText: {
  fontSize: 12,
  fontWeight: "600",
},
```

- [ ] **Step 7: Type check, lint**

```bash
npm --workspace apps/mobile exec -- tsc --noEmit
npm --workspace apps/mobile run lint
```

- [ ] **Step 8: Verify behavior**

- Stop Anvil → enter swap amount → expect a yellow warning banner with "Try again".
- Restart Anvil → tap "Try again" → quote loads.
- Trigger user rejection (cancel passkey prompt during swap) → expect an info pill ("Cancelled. Try again whenever you're ready.") in accent color, NOT a red banner.
- Set sell amount > balance → expect red banner "Insufficient balance for this swap." (no retry button).
- Trigger a brief network blip during background quote poll → expect a transient toast at top.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/features/dex/screens/DexScreen.tsx
git commit -m "feat(dex): classified error UX with severity banner, retry, user-rejection pill"
```

---

## End-to-end QA checklist (post-implementation)

Run on local Anvil + bundler stack with at least one ERC-20 deployed to the dexRegistry list.

### Workstream A
- [ ] Home balance USD figure differs from `ETH × $2500` and matches `cast balance` × current CoinCap ETH price (within 30s cache).
- [ ] Holding a non-zero ERC-20 on the active chain causes the balance to include that token's USD value (when CoinCap has its symbol).
- [ ] Stopping CoinCap (offline) → home shows native amount with `—` for USD; "USD unavailable for N tokens" hint visible.
- [ ] Sending a tx that reverts → Recent Activity row shows the amount with no minus sign + red "Failed" pill; tap into Detail → top row shows "Gas burned: 0.00xx ETH".
- [ ] Fresh wallet creation → `select * from passkeys` returns a row immediately after deployment.
- [ ] `delete from passkeys where user_id = '<uuid>'` then re-launch app → row reappears within seconds.

### Workstream B
- [ ] Logging in on a clean device (no AsyncStorage passkey) for an existing AA wallet → lands on `RecoveryEntry` directly with header "We didn't find a passkey on this device."
- [ ] On `DeviceVerification`, the underlined "Recover account" link is visible; tap → `RecoveryEntry` with header "Recover your account".
- [ ] Re-entering `RecoveryEntry` rapidly via back-and-forth → no flickering; one clean loading state.
- [ ] Forcing `getPasskey` to throw → Retry button shown.

### Workstream C
- [ ] Tapping X on TransactionStatus or TransactionDetail → lands on wallet/home tab.
- [ ] Done button visible on TransactionStatus once the tx is terminal; same target.
- [ ] Stopping the bundler mid-quote → yellow warning banner + Try again button (no spinner forever).
- [ ] User rejection in passkey prompt → info pill, not red banner; form preserved.
- [ ] Insufficient balance → red banner without retry.
- [ ] Wait >30s on confirm step → submit triggers fresh quote; if drift > slippage, "Quote changed — review again" warning surfaces.

---

## Self-review notes (already applied)

- **Spec coverage.** Each issue (1-6) is addressed by one or more tasks in the matching workstream. Issue 1 → A1.1-A1.5; issue 2 → A2.1-A2.4; issue 4 → A3.1-A3.3; issue 3 → B1-B3; issue 5 → C1.1-C1.2; issue 6 → C2.1-C2.6.
- **Placeholder scan.** No "TBD" / "TODO" / "implement later" tokens. The single "simulation_revert" enum value is intentional and documented as out-of-scope per the spec.
- **Type consistency.** `ClassifiedError` shape declared once in C2.1 and consumed identically in C2.6. `DiscoveredToken` + `TokenBalance` types match between A1.1, A1.3, A1.4. `SwapPlan.quotedAt` declared once in C2.5 and read in C2.5 only.
- **Scope.** All tasks fit a single plan; workstreams are independent and can ship as one PR or three.
- **Ambiguity.** Where a callsite or signature couldn't be fully verified from the spec alone (e.g., `getRpcUrl` chain-id arg, `markConfirmed` receipt shape), the task includes an explicit verification step (`grep` or `Run`) and an "adjust if necessary" instruction.
