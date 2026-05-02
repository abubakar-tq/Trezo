# Supabase Migrations

Database migrations for the Trezo mobile app. Use these to provision auth tables, AA wallet tables, and storage policies.

## Migration Files

All migrations live in `migrations/` and use the pattern `YYYYMMDDHHMMSS_description.sql`.

Applied migrations:
1. **20241009000000_init_schema.sql** — Profiles, wallets, assets, transactions, notifications
2. **20241202000000_aa_wallet_tables.sql** — AA wallets, passkeys, guardians, aa_transactions
3. **20241212000000_contacts_table.sql** — Contacts with multi-chain addresses
4. **20241212000001_storage_profiles_bucket.sql** — `profiles` storage bucket policies (create bucket manually first)

## How to Use

```bash
# Create a new migration
npx supabase migration new your_description

# Apply migrations to your project (uses config.toml)
npx supabase db push

# List applied/pending migrations
npx supabase migration list
```

## Local Edge Functions

For local recovery development, start the full Supabase stack and edge
functions with:

```bash
./scripts/infra-up.sh
```

That script will:
- start the local Supabase stack
- optionally sync user data from a remote project
- read local Supabase credentials from `supabase status`
- generate `apps/backend/supabase/.temp/functions-runtime.env`
- start `supabase functions serve` in the background

Only custom function secrets need to live in
`apps/backend/supabase/functions/.env.local`, such as
`RECOVERY_RELAYER_PRIVATE_KEY`.

Logs:

```bash
tail -f apps/backend/supabase/.temp/functions-serve.log
```

### Storage Bucket Setup
Create the `profiles` bucket in the Supabase dashboard before applying migrations:
1. Storage → Buckets → New bucket  
2. Name: `profiles`, Public: enabled  
3. Run migrations to attach policies.

### Notes
- CLI commands read `config.toml`; update it with your project ref before running.
- Keep database credentials out of git—use environment variables when invoking the CLI.
