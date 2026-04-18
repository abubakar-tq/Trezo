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
