-- Level 1 recovery metadata (UX-only, on-chain remains authority)

CREATE TABLE IF NOT EXISTS public.device_pairing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  pairing_secret_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'passkey_submitted', 'approved', 'rejected', 'expired', 'failed')),
  new_device_name TEXT,
  new_device_platform TEXT,
  new_passkey_id TEXT,
  new_credential_id TEXT,
  new_public_key_x TEXT,
  new_public_key_y TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  operation_hash TEXT,
  error TEXT
);

CREATE INDEX IF NOT EXISTS device_pairing_requests_user_idx
  ON public.device_pairing_requests (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS device_pairing_requests_wallet_idx
  ON public.device_pairing_requests (wallet_address, chain_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.wallet_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  passkey_id TEXT NOT NULL,
  credential_id TEXT,
  device_name TEXT,
  platform TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'pending_removal', 'removed')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  removal_execute_after TIMESTAMPTZ,
  CONSTRAINT wallet_devices_wallet_passkey_unique UNIQUE (wallet_address, chain_id, passkey_id)
);

CREATE INDEX IF NOT EXISTS wallet_devices_user_wallet_idx
  ON public.wallet_devices (user_id, wallet_address, chain_id, added_at DESC);

ALTER TABLE public.device_pairing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own device pairing requests"
  ON public.device_pairing_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own device pairing requests"
  ON public.device_pairing_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device pairing requests"
  ON public.device_pairing_requests FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own device pairing requests"
  ON public.device_pairing_requests FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own wallet devices"
  ON public.wallet_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own wallet devices"
  ON public.wallet_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet devices"
  ON public.wallet_devices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own wallet devices"
  ON public.wallet_devices FOR DELETE
  USING (auth.uid() = user_id);
