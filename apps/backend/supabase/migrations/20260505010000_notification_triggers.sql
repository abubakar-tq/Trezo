-- Notification triggers off wallet_transactions.
-- Generates rows in public.notifications for the lifecycle events the user cares about.
-- SECURITY DEFINER so service-role inserts (e.g. an indexer filling incoming rows)
-- can populate notifications without owning a session.

CREATE OR REPLACE FUNCTION public.fn_emit_notification_from_wallet_tx()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category TEXT;
  v_title TEXT;
  v_body TEXT;
  v_icon TEXT;
  v_accent TEXT;
  v_amount TEXT := COALESCE(NEW.amount_display, '');
  v_symbol TEXT := COALESCE(NEW.token_symbol, '');
  v_short_to TEXT := CASE
    WHEN NEW.to_address IS NOT NULL AND length(NEW.to_address) > 12
      THEN substr(NEW.to_address, 1, 6) || '…' || substr(NEW.to_address, length(NEW.to_address) - 3)
    ELSE COALESCE(NEW.to_address, '')
  END;
  v_short_from TEXT := CASE
    WHEN NEW.from_address IS NOT NULL AND length(NEW.from_address) > 12
      THEN substr(NEW.from_address, 1, 6) || '…' || substr(NEW.from_address, length(NEW.from_address) - 3)
    ELSE COALESCE(NEW.from_address, '')
  END;
  v_should_emit BOOLEAN := FALSE;
  v_payload JSONB;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Incoming transfer just landed.
    IF NEW.direction = 'incoming' AND NEW.status IN ('pending','confirmed') THEN
      v_category := 'incoming_transfer';
      v_should_emit := TRUE;
      v_icon := 'arrow-down-circle';
      v_accent := 'success';
      IF NEW.status = 'pending' THEN
        v_title := 'Incoming ' || v_symbol;
        v_body := 'Detected ' || v_amount || ' ' || v_symbol || ' from ' || v_short_from || ' — pending confirmation.';
      ELSE
        v_title := 'Received ' || v_amount || ' ' || v_symbol;
        v_body := 'From ' || v_short_from || '.';
      END IF;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Lifecycle transitions.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.direction = 'incoming' AND NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
        v_category := 'incoming_transfer';
        v_should_emit := TRUE;
        v_icon := 'arrow-down-circle';
        v_accent := 'success';
        v_title := 'Received ' || v_amount || ' ' || v_symbol;
        v_body := 'From ' || v_short_from || '.';
      ELSIF NEW.direction = 'outgoing' AND NEW.status = 'confirmed' AND OLD.status <> 'confirmed' THEN
        IF NEW.type = 'swap' THEN
          v_category := 'swap';
          v_icon := 'repeat';
          v_accent := 'accent';
          v_title := 'Swap completed';
          v_body := 'Swap of ' || v_amount || ' ' || v_symbol || ' confirmed.';
        ELSE
          v_category := 'outgoing_tx';
          v_icon := 'arrow-up-circle';
          v_accent := 'accent';
          v_title := 'Sent ' || v_amount || ' ' || v_symbol;
          v_body := 'To ' || v_short_to || '.';
        END IF;
        v_should_emit := TRUE;
      ELSIF NEW.direction = 'outgoing' AND NEW.status IN ('failed','dropped','cancelled') AND OLD.status NOT IN ('failed','dropped','cancelled') THEN
        v_category := CASE WHEN NEW.type = 'swap' THEN 'swap' ELSE 'outgoing_tx' END;
        v_icon := 'alert-triangle';
        v_accent := 'danger';
        v_title := CASE WHEN NEW.type = 'swap' THEN 'Swap failed' ELSE 'Send failed' END;
        v_body := COALESCE(NEW.error_message, 'Transaction did not complete.');
        v_should_emit := TRUE;
      END IF;
    END IF;
  END IF;

  IF v_should_emit THEN
    v_payload := jsonb_build_object(
      'tx_id', NEW.id,
      'tx_hash', NEW.transaction_hash,
      'user_op_hash', NEW.user_op_hash,
      'chain_id', NEW.chain_id,
      'token_address', NEW.token_address,
      'token_symbol', NEW.token_symbol,
      'token_decimals', NEW.token_decimals,
      'amount_raw', NEW.amount_raw,
      'amount_display', NEW.amount_display,
      'from_address', NEW.from_address,
      'to_address', NEW.to_address,
      'direction', NEW.direction,
      'type', NEW.type,
      'status', NEW.status,
      'deeplink', jsonb_build_object('screen', 'TransactionDetail', 'params', jsonb_build_object('transactionId', NEW.id))
    );

    INSERT INTO public.notifications (
      user_id, aa_wallet_id, category, title, body, icon, accent, related_tx_id, payload
    ) VALUES (
      NEW.user_id,
      NEW.aa_wallet_id,
      v_category,
      v_title,
      v_body,
      v_icon,
      v_accent,
      NEW.id,
      v_payload
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_emit_notification_from_wallet_tx() FROM PUBLIC;

DROP TRIGGER IF EXISTS emit_notification_on_wallet_tx_insert ON public.wallet_transactions;
CREATE TRIGGER emit_notification_on_wallet_tx_insert
  AFTER INSERT ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_emit_notification_from_wallet_tx();

DROP TRIGGER IF EXISTS emit_notification_on_wallet_tx_update ON public.wallet_transactions;
CREATE TRIGGER emit_notification_on_wallet_tx_update
  AFTER UPDATE OF status ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.fn_emit_notification_from_wallet_tx();
