-- On-ramp orders tracking table
-- Stores status of fiat-to-crypto transactions

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
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Trigger for updated_at
create trigger handle_ramp_orders_updated_at
  before update on public.ramp_orders
  for each row
  execute procedure public.set_current_timestamp_updated_at();

-- RLS Policies
alter table public.ramp_orders enable row level security;

create policy "Users can view their own ramp orders" on public.ramp_orders
  for select using (auth.uid() = user_id);

create policy "Users can create their own ramp orders" on public.ramp_orders
  for insert with check (auth.uid() = user_id);

-- Indexes for performance
create index if not exists ramp_orders_user_id_idx on public.ramp_orders (user_id);
create index if not exists ramp_orders_wallet_address_idx on public.ramp_orders (wallet_address);
create index if not exists ramp_orders_provider_order_id_idx on public.ramp_orders (provider_order_id);
create index if not exists ramp_orders_internal_status_idx on public.ramp_orders (internal_status);
create index if not exists ramp_orders_chain_id_idx on public.ramp_orders (chain_id);
