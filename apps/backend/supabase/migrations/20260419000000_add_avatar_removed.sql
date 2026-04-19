-- Add avatar_removed and avatar_deleted_at columns to profiles table
-- This allows us to track explicit user intent to delete their avatar,
-- independent of Supabase OAuth metadata repopulation behavior.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS avatar_removed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS avatar_deleted_at TIMESTAMPTZ;

-- Create index for query performance
CREATE INDEX IF NOT EXISTS idx_profiles_avatar_removed 
ON public.profiles(id, avatar_removed);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.avatar_removed IS 'Tracks explicit user intent to remove avatar. TRUE means user deliberately deleted avatar (show nothing). FALSE means either never set or using OAuth fallback.';
COMMENT ON COLUMN public.profiles.avatar_deleted_at IS 'Timestamp when avatar was explicitly removed by user.';
