# On-Ramp Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a provider-agnostic on-ramp system supporting Transak Staging, Local Mock funding, and Hybrid Demo mode for Trezo Wallet.

**Architecture:** A centralized `ramp` module handles session creation and webhook processing. Providers (Transak, Mock) are abstracted via a common interface. Local Anvil fulfillment is triggered as a post-completion hook in development.

**Tech Stack:** Supabase (DB & Edge Functions), Viem (Local Funding), React Native (Expo), Transak SDK/API.

---

## Phase 1: Foundation (Types, DB, Config)

### Task 1: Define Shared Ramp Types
**Files:**
- Create: `apps/mobile/src/types/ramp.ts`

**Step 1: Write types**
```typescript
export type RampProvider = 'transak' | 'mock';
export type RampStatus = 
  | 'created' 
  | 'widget_opened' 
  | 'payment_pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'refunded' 
  | 'expired' 
  | 'local_mock_completed';

export interface RampOrder {
  id: string;
  userId: string;
  walletAddress: string;
  chainId: number;
  provider: RampProvider;
  providerOrderId?: string;
  providerStatus: string;
  internalStatus: RampStatus;
  fiatCurrency: string;
  fiatAmount: number;
  cryptoCurrency: string;
  cryptoAmount?: number;
  txHash?: string;
  localFulfillmentTxHash?: string;
  createdAt: string;
}
```

### Task 2: Supabase Migration
**Files:**
- Create: `apps/backend/supabase/migrations/20240502000000_create_ramp_orders.sql`

**Step 1: Write SQL migration**
```sql
create table if not exists public.ramp_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  chain_id integer not null,
  provider text not null default 'transak',
  provider_order_id text,
  provider_status text not null default 'created',
  internal_status text not null default 'created',
  ramp_type text not null default 'buy' check (ramp_type in ('buy')),
  fiat_currency text,
  fiat_amount numeric,
  crypto_currency text,
  crypto_amount numeric,
  tx_hash text,
  local_fulfillment_tx_hash text,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ramp_orders enable row level security;
create policy "Users can view their own ramp orders" on public.ramp_orders
  for select using (auth.uid() = user_id);
```

---

## Phase 2: Backend Infrastructure

### Task 3: Create Shared Provider Logic
**Files:**
- Create: `apps/backend/supabase/functions/_shared/ramp/types.ts`
- Create: `apps/backend/supabase/functions/_shared/ramp/providers/TransakProvider.ts`
- Create: `apps/backend/supabase/functions/_shared/ramp/providers/MockProvider.ts`

**Step 1: Implement Transak Staging logic**
- Map Transak statuses to `RampStatus`.
- Implement `createSession` using Transak API.

### Task 4: Local Anvil Fulfillment Service
**Files:**
- Create: `apps/backend/supabase/functions/_shared/ramp/LocalFulfillmentService.ts`

**Step 1: Implement funding logic**
- Use `viem` to connect to `ANVIL_RPC_URL`.
- Guard: Only run if `LOCAL_DEV_FULFILLMENT=true` and `chainId=31337`.

---

## Phase 3: API Layer (Edge Functions)

### Task 5: Session Creation Endpoint
**Files:**
- Create: `apps/backend/supabase/functions/onramp-session/index.ts`

**Step 1: Implement POST handler**
- Authenticate user.
- Create DB record.
- Call active provider.
- Return `widgetUrl` and `orderId`.

### Task 6: Transak Webhook Handler
**Files:**
- Create: `apps/backend/supabase/functions/onramp-webhook/index.ts`

**Step 1: Implement Webhook verification**
- Verify signature from Transak.
- Update DB status.
- Trigger `LocalFulfillmentService` if in hybrid mode.

---

## Phase 4: Frontend Implementation

### Task 7: Mobile Ramp Service
**Files:**
- Create: `apps/mobile/src/services/RampService.ts`

**Step 1: Implement API calls**
- `createSession(params)`
- `getOrder(id)`
- `completeMockOrder(id)` (Dev only)

### Task 8: Buy Crypto Screen
**Files:**
- Create: `apps/mobile/src/features/wallet/screens/BuyCryptoScreen.tsx`
- Modify: `apps/mobile/src/app/(tabs)/wallet/index.tsx` (Add navigation link)

**Step 1: Implement UI**
- Amount input, Currency selectors.
- "Buy Crypto" button.
- Progress/Status card during polling.

---

## Phase 5: Polish & Docs

### Task 9: Documentation
**Files:**
- Create: `docs/on-ramp-fyp.md`

**Step 1: Write demo steps and architecture overview.**

### Task 10: Tests
**Files:**
- Create: `apps/backend/supabase/functions/_shared/ramp/status.test.ts`

**Step 1: Verify Transak status mapping.**
