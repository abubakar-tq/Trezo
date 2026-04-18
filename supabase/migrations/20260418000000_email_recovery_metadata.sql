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
