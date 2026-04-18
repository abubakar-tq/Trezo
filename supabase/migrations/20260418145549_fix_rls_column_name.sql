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
