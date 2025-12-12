# Supabase Migrations

This directory contains database migrations for the Trezo Wallet app.

## Migration Files

All migrations are in the `migrations/` directory and follow the naming pattern:
`YYYYMMDDHHMMSS_description.sql`

### Applied Migrations

1. **20241009000000_init_schema.sql** - Initial database schema
   - profiles, wallets, assets, transactions, notifications tables

2. **20241202000000_aa_wallet_tables.sql** - Account Abstraction support
   - aa_wallets, passkeys, guardians, aa_transactions tables

3. **20241212000000_contacts_table.sql** - Contact management
   - contacts table with JSONB addresses for multi-chain support

4. **20241212000001_storage_profiles_bucket.sql** - Storage bucket
   - profiles bucket for avatar uploads (Note: Create bucket via Dashboard first)

## Usage

### Via Supabase CLI (Recommended for new migrations)

```powershell
# Create new migration
npx supabase migration new description_here

# Apply migrations to remote
npx supabase db push

# Check migration status
npx supabase migration list
```

### Via Dashboard (For manual fixes)

1. Go to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
2. Copy migration SQL
3. Run in SQL Editor

## Storage Bucket Setup

The storage bucket must be created via Supabase Dashboard:

1. Go to Storage > Buckets
2. Click "New bucket"
3. Settings:
   - Name: `profiles`
   - Public: ✅ Enabled
4. Policies are applied via migration file

## Verification

Check database schema:
```powershell
npx tsx scripts/verify-schema.ts
```

Check storage bucket:
```powershell
npx tsx scripts/check-storage.ts
```
