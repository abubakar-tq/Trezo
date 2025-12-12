-- ============================================================================
-- CLEANUP DUPLICATE STORAGE POLICIES
-- Run this in Supabase SQL Editor to remove old duplicate policies
-- ============================================================================

-- Drop all old policies (the ones with "their own" in the name)
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

-- Verify only the correct policies remain
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND policyname LIKE '%avatar%'
ORDER BY cmd, policyname;
