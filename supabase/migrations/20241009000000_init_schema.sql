-- Initial Trezo Wallet schema
-- Run via `npx supabase db push` once the project is linked.

-- Ensure required extensions are available
create extension if not exists "pgcrypto";

create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- Profiles table stores public-facing user metadata
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  avatar_url text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger handle_profiles_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_current_timestamp_updated_at();

alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner" on public.profiles
  for select using (auth.uid() = id);

create policy "Profiles are insertable by owner" on public.profiles
  for insert with check (auth.uid() = id);

create policy "Profiles are updatable by owner" on public.profiles
  for update using (auth.uid() = id);

-- Wallets table lists accounts per user
create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null default 'crypto',
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.wallets enable row level security;

create index if not exists wallets_user_id_idx on public.wallets (user_id);

create policy "Wallets are manageable by owner" on public.wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Assets table stores per-wallet holdings
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  symbol text not null,
  balance numeric(36, 18) not null default 0,
  value_usd numeric(36, 2) not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.assets enable row level security;

create index if not exists assets_wallet_id_idx on public.assets (wallet_id);

create policy "Assets tied to owner wallets" on public.assets
  for all using (
    exists (
      select 1 from public.wallets w
      where w.id = assets.wallet_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.wallets w
      where w.id = assets.wallet_id and w.user_id = auth.uid()
    )
  );

-- Transactions table captures activity history
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  hash text,
  symbol text not null,
  amount numeric(36, 18) not null,
  direction text not null check (direction in ('in', 'out')),
  status text not null default 'completed',
  occurred_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.transactions enable row level security;

create index if not exists transactions_wallet_id_idx on public.transactions (wallet_id);
create index if not exists transactions_occurred_at_idx on public.transactions (occurred_at desc);

create policy "Transactions tied to owner wallets" on public.transactions
  for all using (
    exists (
      select 1 from public.wallets w
      where w.id = transactions.wallet_id and w.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.wallets w
      where w.id = transactions.wallet_id and w.user_id = auth.uid()
    )
  );

-- Notifications table for in-app alerts
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text,
  read boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.notifications enable row level security;

create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);

create policy "Notifications accessible to owner" on public.notifications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
