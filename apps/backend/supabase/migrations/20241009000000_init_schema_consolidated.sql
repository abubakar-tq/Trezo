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
-- AA Wallet Tables for Trezo Wallet
-- Stores Account Abstraction wallet metadata, passkeys, and guardian information

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;

-- =====================================================
-- AA Wallets Table
-- Stores smart contract wallet information
-- =====================================================
CREATE TABLE IF NOT EXISTS public.aa_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Wallet addresses
  predicted_address TEXT NOT NULL UNIQUE,
  owner_address TEXT NOT NULL, -- EOA that controls this AA wallet
  
  -- Deployment status
  is_deployed BOOLEAN DEFAULT FALSE,
  deployment_tx_hash TEXT,
  deployment_block_number BIGINT,
  deployment_gas_used BIGINT,
  
  -- Wallet configuration
  wallet_name TEXT DEFAULT 'My Wallet',
  chain_id INTEGER NOT NULL DEFAULT 31337, -- Anvil default
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deployed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT aa_wallets_user_chain_unique UNIQUE(user_id, chain_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS aa_wallets_user_id_idx ON public.aa_wallets(user_id);
CREATE INDEX IF NOT EXISTS aa_wallets_predicted_address_idx ON public.aa_wallets(predicted_address);
CREATE INDEX IF NOT EXISTS aa_wallets_owner_address_idx ON public.aa_wallets(owner_address);

-- =====================================================
-- Passkeys Table
-- Stores WebAuthn/biometric credentials
-- =====================================================
CREATE TABLE IF NOT EXISTS public.passkeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aa_wallet_id UUID REFERENCES public.aa_wallets(id) ON DELETE CASCADE,
  
  -- Credential information
  credential_id TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  
  -- Device information
  device_name TEXT,
  device_type TEXT, -- 'ios', 'android', 'web'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT passkeys_credential_unique UNIQUE(credential_id)
);

CREATE INDEX IF NOT EXISTS passkeys_user_id_idx ON public.passkeys(user_id);
CREATE INDEX IF NOT EXISTS passkeys_wallet_id_idx ON public.passkeys(aa_wallet_id);

-- =====================================================
-- Guardians Table
-- Stores social recovery guardian information
-- =====================================================
CREATE TABLE IF NOT EXISTS public.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aa_wallet_id UUID NOT NULL REFERENCES public.aa_wallets(id) ON DELETE CASCADE,
  
  -- Guardian information
  guardian_address TEXT NOT NULL,
  guardian_name TEXT,
  guardian_email TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_confirmed BOOLEAN DEFAULT FALSE,
  confirmation_token TEXT,
  
  -- Timestamps
  added_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  
  -- Indexes
  CONSTRAINT guardians_wallet_address_unique UNIQUE(aa_wallet_id, guardian_address)
);

CREATE INDEX IF NOT EXISTS guardians_wallet_id_idx ON public.guardians(aa_wallet_id);
CREATE INDEX IF NOT EXISTS guardians_address_idx ON public.guardians(guardian_address);

-- =====================================================
-- AA Transactions Table
-- Stores UserOperation history (ERC-4337 transactions)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.aa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aa_wallet_id UUID NOT NULL REFERENCES public.aa_wallets(id) ON DELETE CASCADE,
  
  -- Transaction identifiers
  user_op_hash TEXT NOT NULL UNIQUE,
  tx_hash TEXT, -- Actual blockchain transaction hash
  
  -- Transaction details
  sender TEXT NOT NULL,
  target TEXT,
  value TEXT DEFAULT '0',
  calldata TEXT,
  
  -- Gas information
  gas_limit TEXT,
  gas_used TEXT,
  gas_price TEXT,
  
  -- Paymaster (if gasless)
  paymaster_address TEXT,
  paymaster_data TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  error_message TEXT,
  
  -- Blockchain data
  block_number BIGINT,
  block_timestamp TIMESTAMPTZ,
  chain_id INTEGER NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS aa_transactions_wallet_id_idx ON public.aa_transactions(aa_wallet_id);
CREATE INDEX IF NOT EXISTS aa_transactions_user_op_hash_idx ON public.aa_transactions(user_op_hash);
CREATE INDEX IF NOT EXISTS aa_transactions_status_idx ON public.aa_transactions(status);
CREATE INDEX IF NOT EXISTS aa_transactions_created_at_idx ON public.aa_transactions(created_at DESC);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

-- Enable RLS
ALTER TABLE public.aa_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aa_transactions ENABLE ROW LEVEL SECURITY;

-- AA Wallets Policies
CREATE POLICY "Users can view their own AA wallets"
  ON public.aa_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own AA wallets"
  ON public.aa_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AA wallets"
  ON public.aa_wallets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AA wallets"
  ON public.aa_wallets FOR DELETE
  USING (auth.uid() = user_id);

-- Passkeys Policies
CREATE POLICY "Users can view their own passkeys"
  ON public.passkeys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own passkeys"
  ON public.passkeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own passkeys"
  ON public.passkeys FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own passkeys"
  ON public.passkeys FOR DELETE
  USING (auth.uid() = user_id);

-- Guardians Policies
CREATE POLICY "Users can view guardians for their wallets"
  ON public.guardians FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = guardians.aa_wallet_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add guardians to their wallets"
  ON public.guardians FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = guardians.aa_wallet_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update guardians for their wallets"
  ON public.guardians FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = guardians.aa_wallet_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete guardians from their wallets"
  ON public.guardians FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = guardians.aa_wallet_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

-- AA Transactions Policies
CREATE POLICY "Users can view transactions for their wallets"
  ON public.aa_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = aa_transactions.aa_wallet_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create transactions for their wallets"
  ON public.aa_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = aa_transactions.aa_wallet_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for aa_wallets
DROP TRIGGER IF EXISTS update_aa_wallets_updated_at ON public.aa_wallets;
CREATE TRIGGER update_aa_wallets_updated_at
  BEFORE UPDATE ON public.aa_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to update passkey last_used_at
CREATE OR REPLACE FUNCTION update_passkey_last_used()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.counter > OLD.counter THEN
    NEW.last_used_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for passkeys
DROP TRIGGER IF EXISTS update_passkey_last_used_trigger ON public.passkeys;
CREATE TRIGGER update_passkey_last_used_trigger
  BEFORE UPDATE ON public.passkeys
  FOR EACH ROW
  EXECUTE FUNCTION update_passkey_last_used();

-- =====================================================
-- Comments for Documentation
-- =====================================================

COMMENT ON TABLE public.aa_wallets IS 'Stores Account Abstraction smart contract wallet metadata';
COMMENT ON TABLE public.passkeys IS 'Stores WebAuthn/biometric authentication credentials';
COMMENT ON TABLE public.guardians IS 'Stores social recovery guardian information';
COMMENT ON TABLE public.aa_transactions IS 'Stores ERC-4337 UserOperation transaction history';

COMMENT ON COLUMN public.aa_wallets.predicted_address IS 'Counterfactual address computed before deployment';
COMMENT ON COLUMN public.aa_wallets.owner_address IS 'EOA address that controls this smart wallet';
COMMENT ON COLUMN public.passkeys.credential_id IS 'WebAuthn credential ID (unique per device)';
COMMENT ON COLUMN public.passkeys.counter IS 'WebAuthn signature counter (prevents replay attacks)';
COMMENT ON COLUMN public.aa_transactions.user_op_hash IS 'ERC-4337 UserOperation hash';
COMMENT ON COLUMN public.aa_transactions.paymaster_address IS 'Paymaster contract address (if gasless transaction)';
-- Contacts Table Migration
-- Stores user contacts with multi-chain addresses
-- Migration: 20241212000000_contacts_table.sql

-- =====================================================
-- Contacts Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contact information
  name TEXT NOT NULL,
  memo TEXT,
  avatar_url TEXT,
  tags TEXT[], -- e.g., ['guardian', 'friend', 'business']
  
  -- Multi-chain addresses stored as JSONB
  -- Format: [{"chain_id": 1, "address": "0x...", "label": "Ethereum"}, ...]
  addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT contacts_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT contacts_addresses_not_empty CHECK (jsonb_array_length(addresses) > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_name_idx ON public.contacts(user_id, name);
CREATE INDEX IF NOT EXISTS contacts_tags_idx ON public.contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS contacts_addresses_idx ON public.contacts USING GIN(addresses);
CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON public.contacts(user_id, created_at DESC);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.contacts FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for contacts
DROP TRIGGER IF EXISTS update_contacts_updated_at_trigger ON public.contacts;
CREATE TRIGGER update_contacts_updated_at_trigger
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to search contacts by address
CREATE OR REPLACE FUNCTION search_contacts_by_address(
  search_address TEXT,
  user_uuid UUID
)
RETURNS SETOF public.contacts AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM public.contacts c
  WHERE c.user_id = user_uuid
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(c.addresses) AS addr
      WHERE addr->>'address' ILIKE '%' || search_address || '%'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get contacts by tag
CREATE OR REPLACE FUNCTION get_contacts_by_tag(
  tag_name TEXT,
  user_uuid UUID
)
RETURNS SETOF public.contacts AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.contacts
  WHERE user_id = user_uuid
    AND tags @> ARRAY[tag_name]::TEXT[]
  ORDER BY name ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for Documentation
-- =====================================================
COMMENT ON TABLE public.contacts IS 'Stores user contacts with multi-chain blockchain addresses';
COMMENT ON COLUMN public.contacts.addresses IS 'JSONB array of address objects: [{"chain_id": 1, "address": "0x...", "label": "Ethereum"}]';
COMMENT ON COLUMN public.contacts.tags IS 'Array of tag strings for categorization (e.g., guardian, friend, business)';
COMMENT ON COLUMN public.contacts.is_favorite IS 'Flag to mark favorite contacts for quick access';
-- Create storage bucket for profile avatars
-- Run this in Supabase Dashboard > SQL Editor

-- Create storage bucket with file type and size restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles',
  'profiles',
  true,
  2097152, -- 2MB in bytes
  ARRAY['image/*'] -- Allow all image types
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/*'];

-- Drop existing policies if they exist (to allow recreation)
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.filename(name))::text LIKE CONCAT(auth.uid()::text, '%')
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.filename(name))::text LIKE CONCAT(auth.uid()::text, '%')
)
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.filename(name))::text LIKE CONCAT(auth.uid()::text, '%')
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow public read access to all avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profiles');
-- Email Recovery Offchain Metadata
-- Stores email recovery configuration and per-chain install state.

CREATE TABLE IF NOT EXISTS public.email_recovery_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aa_wallet_id UUID NOT NULL REFERENCES public.aa_wallets(id) ON DELETE CASCADE,
  recovery_type TEXT NOT NULL DEFAULT 'email' CHECK (recovery_type = 'email'),
  threshold INTEGER NOT NULL CHECK (threshold > 0),
  delay_seconds BIGINT NOT NULL CHECK (delay_seconds > 0),
  expiry_seconds BIGINT NOT NULL CHECK (expiry_seconds > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active email recovery config per wallet for now.
CREATE UNIQUE INDEX IF NOT EXISTS email_recovery_one_active_config_per_wallet_idx
  ON public.email_recovery_configs (aa_wallet_id)
  WHERE is_active = TRUE AND recovery_type = 'email';

CREATE INDEX IF NOT EXISTS email_recovery_configs_user_id_idx
  ON public.email_recovery_configs (user_id);

CREATE INDEX IF NOT EXISTS email_recovery_configs_wallet_id_idx
  ON public.email_recovery_configs (aa_wallet_id);

CREATE TABLE IF NOT EXISTS public.email_recovery_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.email_recovery_configs(id) ON DELETE CASCADE,
  normalized_email_encrypted TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  masked_email TEXT NOT NULL,
  display_label TEXT,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_recovery_guardians_config_hash_unique UNIQUE (config_id, email_hash)
);

CREATE INDEX IF NOT EXISTS email_recovery_guardians_config_id_idx
  ON public.email_recovery_guardians (config_id);

CREATE INDEX IF NOT EXISTS email_recovery_guardians_email_hash_idx
  ON public.email_recovery_guardians (email_hash);

CREATE TABLE IF NOT EXISTS public.email_recovery_chain_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.email_recovery_configs(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  smart_account_address TEXT NOT NULL,
  email_recovery_module TEXT,
  derived_guardian_addresses TEXT[] NOT NULL DEFAULT '{}',
  install_status TEXT NOT NULL DEFAULT 'not_installed'
    CHECK (install_status IN ('not_installed', 'pending', 'installed', 'failed')),
  install_user_op_hash TEXT,
  installed_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_recovery_chain_install_unique UNIQUE (config_id, chain_id, smart_account_address)
);

CREATE INDEX IF NOT EXISTS email_recovery_chain_installs_config_id_idx
  ON public.email_recovery_chain_installs (config_id);

CREATE INDEX IF NOT EXISTS email_recovery_chain_installs_status_idx
  ON public.email_recovery_chain_installs (install_status);

ALTER TABLE public.email_recovery_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recovery_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recovery_chain_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own email recovery configs"
  ON public.email_recovery_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email recovery configs"
  ON public.email_recovery_configs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.aa_wallets
      WHERE aa_wallets.id = email_recovery_configs.aa_wallet_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own email recovery configs"
  ON public.email_recovery_configs FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.aa_wallets
      WHERE aa_wallets.id = email_recovery_configs.aa_wallet_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own email recovery configs"
  ON public.email_recovery_configs FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.aa_wallets
      WHERE aa_wallets.id = email_recovery_configs.aa_wallet_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view email recovery guardians for their wallets"
  ON public.email_recovery_guardians FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.email_recovery_configs
      JOIN public.aa_wallets ON aa_wallets.id = email_recovery_configs.aa_wallet_id
      WHERE email_recovery_configs.id = email_recovery_guardians.config_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert email recovery guardians for their wallets"
  ON public.email_recovery_guardians FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.email_recovery_configs
      JOIN public.aa_wallets ON aa_wallets.id = email_recovery_configs.aa_wallet_id
      WHERE email_recovery_configs.id = email_recovery_guardians.config_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update email recovery guardians for their wallets"
  ON public.email_recovery_guardians FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.email_recovery_configs
      JOIN public.aa_wallets ON aa_wallets.id = email_recovery_configs.aa_wallet_id
      WHERE email_recovery_configs.id = email_recovery_guardians.config_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete email recovery guardians for their wallets"
  ON public.email_recovery_guardians FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.email_recovery_configs
      JOIN public.aa_wallets ON aa_wallets.id = email_recovery_configs.aa_wallet_id
      WHERE email_recovery_configs.id = email_recovery_guardians.config_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view email recovery chain installs for their wallets"
  ON public.email_recovery_chain_installs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.email_recovery_configs
      JOIN public.aa_wallets ON aa_wallets.id = email_recovery_configs.aa_wallet_id
      WHERE email_recovery_configs.id = email_recovery_chain_installs.config_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert email recovery chain installs for their wallets"
  ON public.email_recovery_chain_installs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.email_recovery_configs
      JOIN public.aa_wallets ON aa_wallets.id = email_recovery_configs.aa_wallet_id
      WHERE email_recovery_configs.id = email_recovery_chain_installs.config_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update email recovery chain installs for their wallets"
  ON public.email_recovery_chain_installs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.email_recovery_configs
      JOIN public.aa_wallets ON aa_wallets.id = email_recovery_configs.aa_wallet_id
      WHERE email_recovery_configs.id = email_recovery_chain_installs.config_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete email recovery chain installs for their wallets"
  ON public.email_recovery_chain_installs FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.email_recovery_configs
      JOIN public.aa_wallets ON aa_wallets.id = email_recovery_configs.aa_wallet_id
      WHERE email_recovery_configs.id = email_recovery_chain_installs.config_id
      AND aa_wallets.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_email_recovery_configs_updated_at ON public.email_recovery_configs;
CREATE TRIGGER update_email_recovery_configs_updated_at
  BEFORE UPDATE ON public.email_recovery_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_recovery_guardians_updated_at ON public.email_recovery_guardians;
CREATE TRIGGER update_email_recovery_guardians_updated_at
  BEFORE UPDATE ON public.email_recovery_guardians
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_email_recovery_chain_installs_updated_at ON public.email_recovery_chain_installs;
CREATE TRIGGER update_email_recovery_chain_installs_updated_at
  BEFORE UPDATE ON public.email_recovery_chain_installs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
-- Email Recovery Offchain Metadata (Refactored for Multi-Chain CREATE2)
-- Stores email recovery configuration and per-chain install state.
-- Anchored by smart_account_address which is deterministic across chains.

-- Drop existing tables to refactor
DROP TABLE IF EXISTS public.email_recovery_chain_installs CASCADE;
DROP TABLE IF EXISTS public.email_recovery_guardians CASCADE;
DROP TABLE IF EXISTS public.email_recovery_configs CASCADE;

CREATE TABLE public.email_recovery_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- smart_account_address is our "Group ID" because of CREATE2 determinism.
  smart_account_address TEXT NOT NULL,
  recovery_type TEXT NOT NULL DEFAULT 'email' CHECK (recovery_type = 'email'),
  threshold INTEGER NOT NULL CHECK (threshold > 0),
  delay_seconds BIGINT NOT NULL CHECK (delay_seconds > 0),
  expiry_seconds BIGINT NOT NULL CHECK (expiry_seconds > 0),
  -- Reference to a specific aa_wallet for the initial chain/owner context.
  aa_wallet_id UUID REFERENCES public.aa_wallets(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active email recovery config per deterministic smart account address.
CREATE UNIQUE INDEX email_recovery_one_active_config_per_address_idx
  ON public.email_recovery_configs (smart_account_address)
  WHERE is_active = TRUE AND recovery_type = 'email';

CREATE INDEX email_recovery_configs_user_id_idx ON public.email_recovery_configs (user_id);
CREATE INDEX email_recovery_configs_smart_address_idx ON public.email_recovery_configs (smart_account_address);

CREATE TABLE public.email_recovery_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.email_recovery_configs(id) ON DELETE CASCADE,
  -- AES-GCM encrypted email
  normalized_email_encrypted TEXT NOT NULL,
  email_hash TEXT NOT NULL,
  masked_email TEXT NOT NULL,
  display_label TEXT,
  weight INTEGER NOT NULL DEFAULT 1 CHECK (weight > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_recovery_guardians_config_hash_unique UNIQUE (config_id, email_hash)
);

CREATE INDEX email_recovery_guardians_config_id_idx ON public.email_recovery_guardians (config_id);

CREATE TABLE public.email_recovery_chain_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES public.email_recovery_configs(id) ON DELETE CASCADE,
  chain_id INTEGER NOT NULL,
  -- Re-verified on each chain
  install_status TEXT NOT NULL DEFAULT 'not_installed'
    CHECK (install_status IN ('not_installed', 'pending', 'installed', 'failed')),
  install_user_op_hash TEXT,
  installed_at TIMESTAMPTZ,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_recovery_chain_install_unique UNIQUE (config_id, chain_id)
);

CREATE INDEX email_recovery_chain_installs_config_id_idx ON public.email_recovery_chain_installs (config_id);

-- Enable RLS
ALTER TABLE public.email_recovery_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recovery_guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_recovery_chain_installs ENABLE ROW LEVEL SECURITY;

-- Dynamic Policy Helper: Ensure the auth UID owns one of the aa_wallets 
-- associated with this smart_account_address.
CREATE OR REPLACE FUNCTION public.check_smart_account_ownership(target_address TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.aa_wallets 
    WHERE public.aa_wallets.smart_account_address = target_address
    AND public.aa_wallets.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for public.email_recovery_configs
CREATE POLICY "Users can view their own email recovery configs"
  ON public.email_recovery_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email recovery configs"
  ON public.email_recovery_configs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND public.check_smart_account_ownership(smart_account_address)
  );

CREATE POLICY "Users can update their own email recovery configs"
  ON public.email_recovery_configs FOR UPDATE
  USING (
    auth.uid() = user_id 
    AND public.check_smart_account_ownership(smart_account_address)
  );

CREATE POLICY "Users can delete their own email recovery configs"
  ON public.email_recovery_configs FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for public.email_recovery_guardians
CREATE POLICY "Users can manage guardians for their configs"
  ON public.email_recovery_guardians FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.email_recovery_configs
      WHERE id = config_id AND user_id = auth.uid()
    )
  );

-- Policies for public.email_recovery_chain_installs
CREATE POLICY "Users can manage chain installs for their configs"
  ON public.email_recovery_chain_installs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.email_recovery_configs
      WHERE id = config_id AND user_id = auth.uid()
    )
  );

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_email_configs BEFORE UPDATE ON public.email_recovery_configs FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_updated_at_email_guardians BEFORE UPDATE ON public.email_recovery_guardians FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE TRIGGER set_updated_at_email_installs BEFORE UPDATE ON public.email_recovery_chain_installs FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
CREATE OR REPLACE FUNCTION public.check_smart_account_ownership(target_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.aa_wallets
    WHERE public.aa_wallets.predicted_address = target_address
      AND public.aa_wallets.user_id = auth.uid()
  );
END;
$$;
-- Fix email recovery config insert/update RLS to support lowercase normalization
-- and safe first-claim flow when aa_wallets row is not present yet.

CREATE OR REPLACE FUNCTION public.check_smart_account_ownership(target_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.aa_wallets
    WHERE lower(public.aa_wallets.predicted_address) = lower(target_address)
      AND public.aa_wallets.user_id = auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_claim_smart_account(target_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    EXISTS (
      SELECT 1
      FROM public.aa_wallets
      WHERE lower(public.aa_wallets.predicted_address) = lower(target_address)
        AND public.aa_wallets.user_id = auth.uid()
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.aa_wallets
      WHERE lower(public.aa_wallets.predicted_address) = lower(target_address)
        AND public.aa_wallets.user_id <> auth.uid()
    )
  );
END;
$$;

DROP POLICY IF EXISTS "Users can create their own email recovery configs" ON public.email_recovery_configs;
CREATE POLICY "Users can create their own email recovery configs"
  ON public.email_recovery_configs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND public.can_claim_smart_account(smart_account_address)
  );

DROP POLICY IF EXISTS "Users can update their own email recovery configs" ON public.email_recovery_configs;
CREATE POLICY "Users can update their own email recovery configs"
  ON public.email_recovery_configs FOR UPDATE
  USING (
    auth.uid() = user_id
    AND public.can_claim_smart_account(smart_account_address)
  );
-- Add security mode to email recovery configs.
-- Default is non-secure mode for faster user onboarding.

ALTER TABLE public.email_recovery_configs
ADD COLUMN IF NOT EXISTS security_mode text NOT NULL DEFAULT 'none'
CHECK (security_mode IN ('none', 'extra'));

COMMENT ON COLUMN public.email_recovery_configs.security_mode IS
'Email recovery metadata protection mode: none (default) or extra (encrypted with local vault key).';

