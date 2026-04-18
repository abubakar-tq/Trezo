-- Create storage bucket for profile avatars
-- Run this in Supabase Dashboard > SQL Editor

-- Create storage bucket with file type and size restrictions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profiles',
  'profiles',
  true,
  2097152, -- 2MB in bytes
  ARRAY['image/*'] -- Allow all image types
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/*'];

-- Drop existing policies if they exist (to allow recreation)
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.filename(name))::text LIKE CONCAT(auth.uid()::text, '-%')
);

-- Allow authenticated users to update their own avatars
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.filename(name))::text LIKE CONCAT(auth.uid()::text, '-%')
)
WITH CHECK (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
  AND (storage.filename(name))::text LIKE CONCAT(auth.uid()::text, '-%')
);

-- Allow authenticated users to delete their own avatars
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profiles'
  AND (storage.foldername(name))[1] = 'avatars'
);

-- Allow public read access to all avatars
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profiles');
