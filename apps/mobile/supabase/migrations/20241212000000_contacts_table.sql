-- Contacts Table Migration
-- Stores user contacts with multi-chain addresses
-- Migration: 20241212000000_contacts_table.sql

-- =====================================================
-- Contacts Table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Contact information
  name TEXT NOT NULL,
  memo TEXT,
  avatar_url TEXT,
  tags TEXT[], -- e.g., ['guardian', 'friend', 'business']
  
  -- Multi-chain addresses stored as JSONB
  -- Format: [{"chain_id": 1, "address": "0x...", "label": "Ethereum"}, ...]
  addresses JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- Metadata
  is_favorite BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT contacts_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT contacts_addresses_not_empty CHECK (jsonb_array_length(addresses) > 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON public.contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_name_idx ON public.contacts(user_id, name);
CREATE INDEX IF NOT EXISTS contacts_tags_idx ON public.contacts USING GIN(tags);
CREATE INDEX IF NOT EXISTS contacts_addresses_idx ON public.contacts USING GIN(addresses);
CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON public.contacts(user_id, created_at DESC);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own contacts"
  ON public.contacts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own contacts"
  ON public.contacts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contacts"
  ON public.contacts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contacts"
  ON public.contacts FOR DELETE
  USING (auth.uid() = user_id);

-- =====================================================
-- Functions and Triggers
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for contacts
DROP TRIGGER IF EXISTS update_contacts_updated_at_trigger ON public.contacts;
CREATE TRIGGER update_contacts_updated_at_trigger
  BEFORE UPDATE ON public.contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to search contacts by address
CREATE OR REPLACE FUNCTION search_contacts_by_address(
  search_address TEXT,
  user_uuid UUID
)
RETURNS SETOF public.contacts AS $$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM public.contacts c
  WHERE c.user_id = user_uuid
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(c.addresses) AS addr
      WHERE addr->>'address' ILIKE '%' || search_address || '%'
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get contacts by tag
CREATE OR REPLACE FUNCTION get_contacts_by_tag(
  tag_name TEXT,
  user_uuid UUID
)
RETURNS SETOF public.contacts AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.contacts
  WHERE user_id = user_uuid
    AND tags @> ARRAY[tag_name]::TEXT[]
  ORDER BY name ASC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for Documentation
-- =====================================================
COMMENT ON TABLE public.contacts IS 'Stores user contacts with multi-chain blockchain addresses';
COMMENT ON COLUMN public.contacts.addresses IS 'JSONB array of address objects: [{"chain_id": 1, "address": "0x...", "label": "Ethereum"}]';
COMMENT ON COLUMN public.contacts.tags IS 'Array of tag strings for categorization (e.g., guardian, friend, business)';
COMMENT ON COLUMN public.contacts.is_favorite IS 'Flag to mark favorite contacts for quick access';
