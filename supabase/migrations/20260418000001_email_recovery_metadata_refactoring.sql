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
