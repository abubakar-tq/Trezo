-- Add security mode to email recovery configs.
-- Default is non-secure mode for faster user onboarding.

ALTER TABLE public.email_recovery_configs
ADD COLUMN IF NOT EXISTS security_mode text NOT NULL DEFAULT 'none'
CHECK (security_mode IN ('none', 'extra'));

COMMENT ON COLUMN public.email_recovery_configs.security_mode IS
'Email recovery metadata protection mode: none (default) or extra (encrypted with local vault key).';
