-- Trigger: emit a notification row for every new account_security_event.
-- SECURITY DEFINER so service-role inserts propagate notifications without
-- needing a user session.

CREATE OR REPLACE FUNCTION public.fn_emit_notification_from_security_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category TEXT;
  v_title    TEXT;
  v_body     TEXT;
  v_icon     TEXT;
  v_accent   TEXT;
  v_payload  JSONB;
BEGIN
  CASE NEW.event_type
    WHEN 'recovery_scheduled' THEN
      v_category := 'security';
      v_icon     := 'shield-alert';
      v_accent   := 'warning';
      v_title    := 'Recovery initiated';
      v_body     := 'A social recovery request has been scheduled for your wallet.';

    WHEN 'recovery_executed' THEN
      v_category := 'security';
      v_icon     := 'shield-check';
      v_accent   := 'success';
      v_title    := 'Recovery completed';
      v_body     := 'Your wallet has been recovered successfully.';

    WHEN 'recovery_cancelled' THEN
      v_category := 'security';
      v_icon     := 'shield-x';
      v_accent   := 'accent';
      v_title    := 'Recovery cancelled';
      v_body     := 'The pending recovery request was cancelled.';

    WHEN 'passkey_added' THEN
      v_category := 'security';
      v_icon     := 'key-round';
      v_accent   := 'success';
      v_title    := 'Passkey added';
      v_body     := 'A new passkey has been added to your wallet.';

    WHEN 'passkey_added_via_recovery' THEN
      v_category := 'security';
      v_icon     := 'key-round';
      v_accent   := 'success';
      v_title    := 'Passkey restored';
      v_body     := 'A passkey was added to your wallet via recovery.';

    WHEN 'passkey_removed' THEN
      v_category := 'security';
      v_icon     := 'key-round';
      v_accent   := 'danger';
      v_title    := 'Passkey removed';
      v_body     := 'A passkey has been removed from your wallet.';

    WHEN 'passkey_removal_scheduled' THEN
      v_category := 'security';
      v_icon     := 'clock';
      v_accent   := 'warning';
      v_title    := 'Passkey removal scheduled';
      v_body     := 'A passkey removal has been scheduled. Cancel if this was not you.';

    WHEN 'module_installed' THEN
      v_category := 'security';
      v_icon     := 'puzzle';
      v_accent   := 'accent';
      v_title    := 'Module installed';
      v_body     := 'A new module was installed on your smart account.';

    WHEN 'module_uninstalled' THEN
      v_category := 'security';
      v_icon     := 'puzzle';
      v_accent   := 'accent';
      v_title    := 'Module uninstalled';
      v_body     := 'A module was removed from your smart account.';

    WHEN 'guardian_approved' THEN
      v_category := 'security';
      v_icon     := 'user-check';
      v_accent   := 'accent';
      v_title    := 'Guardian approved';
      v_body     := 'A guardian approved a recovery request.';

    WHEN 'guardian_rejected' THEN
      v_category := 'security';
      v_icon     := 'user-x';
      v_accent   := 'warning';
      v_title    := 'Guardian rejected';
      v_body     := 'A guardian rejected a recovery request.';

    ELSE
      -- Unknown event type — emit a generic security alert
      v_category := 'security';
      v_icon     := 'shield';
      v_accent   := 'accent';
      v_title    := 'Security event';
      v_body     := 'A security-related event occurred on your wallet.';
  END CASE;

  v_payload := jsonb_build_object(
    'security_event_id', NEW.id,
    'wallet_address',    NEW.wallet_address,
    'chain_id',          NEW.chain_id,
    'event_type',        NEW.event_type,
    'event_data',        COALESCE(NEW.event_data, '{}'::jsonb),
    'tx_hash',           NEW.tx_hash,
    'block_number',      NEW.block_number,
    'deeplink',          jsonb_build_object(
      'screen', 'SecurityEvent',
      'params', jsonb_build_object('eventId', NEW.id)
    )
  );

  INSERT INTO public.notifications (
    user_id, aa_wallet_id, category, title, body, icon, accent, payload
  ) VALUES (
    NEW.user_id,
    NEW.aa_wallet_id,
    v_category,
    v_title,
    v_body,
    v_icon,
    v_accent,
    v_payload
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_emit_notification_from_security_event() FROM PUBLIC;

DROP TRIGGER IF EXISTS emit_notification_on_security_event ON public.account_security_events;
CREATE TRIGGER emit_notification_on_security_event
  AFTER INSERT ON public.account_security_events
  FOR EACH ROW
  WHEN (NEW.user_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_emit_notification_from_security_event();
