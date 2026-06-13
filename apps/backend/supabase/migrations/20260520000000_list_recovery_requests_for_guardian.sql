-- List all recovery_requests where the given address is a guardian.
-- Used by Trezo mobile clients to show "Pending guardian approvals for me" inbox.
-- SECURITY DEFINER because the recovery_requests RLS limits direct access to the requesting
-- user; a guardian is a different user and needs cross-user read scoped to requests they
-- are listed in.

CREATE OR REPLACE FUNCTION public.list_recovery_requests_for_guardian(
  p_guardian_address TEXT
)
RETURNS TABLE (
  id UUID,
  wallet_address TEXT,
  guardian_addresses TEXT[],
  threshold INTEGER,
  approval_count BIGINT,
  deadline TIMESTAMPTZ,
  status TEXT,
  digest TEXT,
  requester_note TEXT,
  target_chain_ids INTEGER[],
  recovery_intent_json JSONB,
  chain_scopes_json JSONB,
  created_at TIMESTAMPTZ,
  already_approved BOOLEAN
) AS $$
BEGIN
  IF p_guardian_address IS NULL OR p_guardian_address = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.id,
         r.wallet_address,
         r.guardian_addresses,
         r.threshold,
         (
           SELECT COUNT(*)
           FROM public.recovery_approvals approvals
           WHERE approvals.request_id = r.id
             AND approvals.verification_status = 'valid'
         ) AS approval_count,
         r.deadline,
         r.status,
         r.digest,
         r.requester_note,
         r.target_chain_ids,
         r.recovery_intent_json,
         r.chain_scopes_json,
         r.created_at,
         EXISTS (
           SELECT 1 FROM public.recovery_approvals a
           WHERE a.request_id = r.id
             AND lower(a.guardian_address) = lower(p_guardian_address)
             AND a.verification_status = 'valid'
         ) AS already_approved
  FROM public.recovery_requests r
  WHERE lower(p_guardian_address) = ANY (
          SELECT lower(unnest(r.guardian_addresses))
        )
    AND r.status IN ('collecting_approvals', 'threshold_reached')
    AND r.deadline > NOW()
  ORDER BY r.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.list_recovery_requests_for_guardian(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.list_recovery_requests_for_guardian(TEXT) IS
  'Returns recovery requests where the given address appears in guardian_addresses and the request is still open. Used by Trezo mobile to show in-app guardian approval inbox.';
