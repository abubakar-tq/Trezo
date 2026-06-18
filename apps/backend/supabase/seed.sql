-- ==========================================
-- Trezo Local Development Seed Data
-- ==========================================

-- 1. Create a dummy test user for local auth
-- (This creates a user that can log in to the local Supabase dashboard / app)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'test@trezo.app',
    -- password is 'password123'
    crypt('password123', gen_salt('bf')),
    now(),
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- Create the identity mapping for the dummy user
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    jsonb_build_object('sub', '11111111-1111-1111-1111-111111111111', 'email', 'test@trezo.app'),
    'email',
    now(),
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- 2. Create a public profile/wallet for the dummy user
-- (Assuming public.wallets exists based on old stub)
-- INSERT INTO public.wallets (id, user_id, name, type)
-- VALUES (
--     gen_random_uuid(), 
--     '11111111-1111-1111-1111-111111111111', 
--     'Local Dev Wallet', 
--     'crypto'
-- ) ON CONFLICT DO NOTHING;
