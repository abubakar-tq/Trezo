-- ==============================================================================
-- Database Webhook: S3 Storage Cleanup on User Deletion
-- ==============================================================================
-- This trigger fires the exact millisecond a user is deleted from auth.users.
-- It securely calls our 'cleanup-user-storage' Edge Function to physically 
-- scrub the ghost files from the AWS S3 storage buckets.
-- ==============================================================================

-- Drop the trigger if it already exists to allow for safe re-runs
DROP TRIGGER IF EXISTS "on_auth_user_deleted" ON "auth"."users";

-- Create the Database Webhook using Supabase's native HTTP request extension
CREATE TRIGGER "on_auth_user_deleted"
  AFTER DELETE ON "auth"."users"
  FOR EACH ROW
  EXECUTE FUNCTION "supabase_functions"."http_request"(
    'https://jhjnybcscdwpbnztzozy.supabase.co/functions/v1/cleanup-user-storage',
    'POST',
    '{"Content-Type":"application/json"}',
    '{}',
    '5000'
  );
