-- Store passkey metadata needed to restore device lists and build recovery/add-passkey payloads.
-- Private key material never belongs in this table.

ALTER TABLE public.passkeys
  ADD COLUMN IF NOT EXISTS credential_id_raw TEXT,
  ADD COLUMN IF NOT EXISTS public_key_x TEXT,
  ADD COLUMN IF NOT EXISTS public_key_y TEXT,
  ADD COLUMN IF NOT EXISTS rp_id TEXT;

UPDATE public.passkeys
SET credential_id_raw = credential_id
WHERE credential_id_raw IS NULL;

COMMENT ON COLUMN public.passkeys.credential_id_raw IS
  'Bytes32 WebAuthn credential ID used by PasskeyValidator, stored as hex.';
COMMENT ON COLUMN public.passkeys.public_key_x IS
  'P-256 public key X coordinate for on-chain passkey registration.';
COMMENT ON COLUMN public.passkeys.public_key_y IS
  'P-256 public key Y coordinate for on-chain passkey registration.';
COMMENT ON COLUMN public.passkeys.rp_id IS
  'WebAuthn relying-party ID used when the passkey was created.';
