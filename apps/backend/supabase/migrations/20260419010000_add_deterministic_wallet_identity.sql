alter table public.aa_wallets
  add column if not exists wallet_identity text,
  add column if not exists wallet_index integer not null default 0,
  add column if not exists deployment_mode text not null default 'chain-specific'
    check (deployment_mode in ('portable', 'chain-specific'));

create unique index if not exists aa_wallets_wallet_identity_chain_idx
  on public.aa_wallets(user_id, wallet_identity, wallet_index, chain_id)
  where wallet_identity is not null;

comment on column public.aa_wallets.wallet_identity is
  'Immutable Trezo walletId used for deterministic cross-chain address derivation.';
comment on column public.aa_wallets.wallet_index is
  'Stable wallet index inside a user wallet identity family.';
comment on column public.aa_wallets.deployment_mode is
  'Deterministic deployment mode: portable or chain-specific.';
