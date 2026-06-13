-- Drop legacy unused Web2 wallet tables
-- Replaced by Account Abstraction tables (aa_wallets, aa_transactions, wallet_transactions)

DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.assets;
DROP TABLE IF EXISTS public.wallets CASCADE;
