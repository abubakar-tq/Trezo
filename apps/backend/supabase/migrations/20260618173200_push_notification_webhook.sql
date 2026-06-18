-- ==============================================================================
-- Database Webhook: Trigger Push Notifications
-- ==============================================================================
-- This trigger fires whenever a new row is inserted into the notifications table.
-- It calls the 'send-push-notification' Edge Function to deliver the push to FCM/APNs.
-- ==============================================================================

-- Drop the trigger if it already exists to allow for safe re-runs
DROP TRIGGER IF EXISTS "trigger-push-notification" ON "public"."notifications";

-- Create the Database Webhook using Supabase's native HTTP request extension
CREATE TRIGGER "trigger-push-notification"
  AFTER INSERT ON "public"."notifications"
  FOR EACH ROW
  EXECUTE FUNCTION "supabase_functions"."http_request"(
    'https://jhjnybcscdwpbnztzozy.supabase.co/functions/v1/send-push-notification',
    'POST',
    '{"Content-Type":"application/json"}',
    '{}',
    '5000'
  );
