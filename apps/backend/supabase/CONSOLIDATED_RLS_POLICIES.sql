-- =====================================================
-- CONSOLIDATED ROW LEVEL SECURITY (RLS) POLICIES
-- For Trezo Wallet Database
-- Last Updated: 2025-12-12
-- =====================================================
-- This file consolidates all RLS policies across the database
-- for easier management and future reference.
-- 
-- Usage: Apply these policies after running migrations
-- Command: psql -d your_db < CONSOLIDATED_RLS_POLICIES.sql
-- =====================================================

-- =====================================================
-- PROFILES TABLE POLICIES
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: View own profile
CREATE POLICY "Profiles are viewable by owner" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Profiles: Insert own profile
CREATE POLICY "Profiles are insertable by owner" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Profiles: Update own profile
CREATE POLICY "Profiles are updatable by owner" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- WALLETS TABLE POLICIES
-- =====================================================
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Wallets: Full management by owner
CREATE POLICY "Wallets are manageable by owner" ON public.wallets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- CONTACTS TABLE POLICIES
-- =====================================================
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Contacts: View own contacts
CREATE POLICY "Users can view their own contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() = user_id);

-- Contacts: Create own contacts
CREATE POLICY "Users can create their own contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Contacts: Update own contacts
CREATE POLICY "Users can update their own contacts"
  ON public.contacts FOR UPDATE
  USING (auth.uid() = user_id);

-- Contacts: Delete own contacts
CREATE POLICY "Users can delete their own contacts"
  ON public.contacts FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- AA WALLETS TABLE POLICIES
-- =====================================================
ALTER TABLE public.aa_wallets ENABLE ROW LEVEL SECURITY;

-- AA Wallets: View own wallets
CREATE POLICY "Users can view their own AA wallets"
  ON public.aa_wallets FOR SELECT
  USING (auth.uid() = user_id);

-- AA Wallets: Create own wallets
CREATE POLICY "Users can create their own AA wallets"
  ON public.aa_wallets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- AA Wallets: Update own wallets
CREATE POLICY "Users can update their own AA wallets"
  ON public.aa_wallets FOR UPDATE
  USING (auth.uid() = user_id);

-- AA Wallets: Delete own wallets
CREATE POLICY "Users can delete their own AA wallets"
  ON public.aa_wallets FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- PASSKEYS TABLE POLICIES
-- =====================================================
ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;

-- Passkeys: View own passkeys
CREATE POLICY "Users can view their own passkeys"
  ON public.passkeys FOR SELECT
  USING (auth.uid() = user_id);

-- Passkeys: Create own passkeys
CREATE POLICY "Users can create their own passkeys"
  ON public.passkeys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Passkeys: Update own passkeys
CREATE POLICY "Users can update their own passkeys"
  ON public.passkeys FOR UPDATE
  USING (auth.uid() = user_id);

-- Passkeys: Delete own passkeys
CREATE POLICY "Users can delete their own passkeys"
  ON public.passkeys FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- GUARDIANS TABLE POLICIES
-- =====================================================
ALTER TABLE public.guardians ENABLE ROW LEVEL SECURITY;

-- Guardians: View guardians for own wallets
CREATE POLICY "Users can view guardians for their wallets"
  ON public.guardians FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = guardians.aa_wallet_id
        AND aa_wallets.user_id = auth.uid()
    )
  );

-- Guardians: Add guardians to own wallets
CREATE POLICY "Users can add guardians to their wallets"
  ON public.guardians FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = guardians.aa_wallet_id
        AND aa_wallets.user_id = auth.uid()
    )
  );

-- Guardians: Update guardians for own wallets
CREATE POLICY "Users can update guardians for their wallets"
  ON public.guardians FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = guardians.aa_wallet_id
        AND aa_wallets.user_id = auth.uid()
    )
  );

-- Guardians: Delete guardians from own wallets
CREATE POLICY "Users can delete guardians from their wallets"
  ON public.guardians FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = guardians.aa_wallet_id
        AND aa_wallets.user_id = auth.uid()
    )
  );

-- =====================================================
-- TRANSACTIONS TABLE POLICIES
-- =====================================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transactions: View transactions for own wallets
CREATE POLICY "Users can view transactions for their wallets"
  ON public.transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = transactions.aa_wallet_id
        AND aa_wallets.user_id = auth.uid()
    )
  );

-- Transactions: Create transactions for own wallets
CREATE POLICY "Users can create transactions for their wallets"
  ON public.transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.aa_wallets
      WHERE aa_wallets.id = transactions.aa_wallet_id
        AND aa_wallets.user_id = auth.uid()
    )
  );

-- =====================================================
-- STORAGE BUCKET POLICIES
-- =====================================================
-- Storage bucket: profiles
-- Assuming bucket 'profiles' exists for avatar storage

-- Users can upload their own avatar
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profiles'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own avatar
CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profiles'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profiles'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anyone can view avatars (public read)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'profiles');

-- =====================================================
-- NOTES
-- =====================================================
-- 
-- Policy Naming Convention:
-- - Use descriptive names that explain what the policy does
-- - Format: "Entity can action [condition]"
-- 
-- Testing Policies:
-- 1. Test with authenticated users
-- 2. Test with unauthenticated users
-- 3. Test cross-user access attempts
-- 4. Verify all CRUD operations work correctly
-- 
-- Maintenance:
-- - Review policies quarterly for security
-- - Update this file when adding new tables
-- - Document any policy changes in migration files
-- 
-- =====================================================
