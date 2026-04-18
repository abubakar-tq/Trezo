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
