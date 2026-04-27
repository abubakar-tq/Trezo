# Supabase Local Runtime (Infra + Coding Laptop)

This setup is designed for your workflow:
- **Infra laptop** runs Docker + Anvil + Pimlico + local Supabase.
- **Coding laptop** runs Expo app and points to infra services over LAN.

## 1) Keep Production Keys, Use Override Keys

Mobile now supports local override variables:
- `EXPO_PUBLIC_SUPABASE_OVERRIDE_URL`
- `EXPO_PUBLIC_SUPABASE_OVERRIDE_ANON_KEY`

If override vars are set, app uses them; otherwise it uses your original:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

So you do **not** need to overwrite production values.

## 2) Infra Laptop One-Time Setup

1. Recovery function secrets:

```bash
cp apps/backend/supabase/functions/.env.local.example apps/backend/supabase/functions/.env.local
```

Edit `apps/backend/supabase/functions/.env.local`:
- `RECOVERY_RELAYER_PRIVATE_KEY` (funded on Anvil)
- `RECOVERY_RPC_URL_31337=http://<INFRA_IP>:8545` (or host.docker.internal if needed)

2. Optional production-to-local user data sync config:

```bash
cp apps/backend/supabase/.env.sync.example apps/backend/supabase/.env.sync.local
```

Edit `apps/backend/supabase/.env.sync.local`:
- `REMOTE_SUPABASE_URL`
- `REMOTE_SUPABASE_SERVICE_ROLE_KEY`
- `SYNC_USER_EMAIL` (or `SYNC_USER_ID`)

## 3) Daily Infra Startup (Single Command)

On infra laptop:

```bash
npm run infra:up
```

What this does:
1. Starts local Supabase Docker stack.
2. If `.env.sync.local` exists, syncs essential user data from remote into local.
3. Starts `supabase functions serve` in background with local secrets.

Logs/PID:
- log: `apps/backend/supabase/.temp/functions-serve.log`
- pid: `apps/backend/supabase/.temp/functions-serve.pid`

Shutdown:

```bash
npm run infra:down
```

## 4) Export Mobile Env for Coding Laptop

On infra laptop:

```bash
npm run infra:mobile-env -- 192.168.100.68
```

This generates:
- `apps/backend/supabase/.temp/mobile-remote.env`

Copy those lines into `apps/mobile/.env` on coding laptop.

## 5) Coding Laptop Setup

In `apps/mobile/.env`, keep production values as-is, and add overrides from exported file:

```env
EXPO_PUBLIC_SUPABASE_OVERRIDE_URL=http://<INFRA_IP>:54321
EXPO_PUBLIC_SUPABASE_OVERRIDE_ANON_KEY=<infra-local-anon-key>
EXPO_PUBLIC_ANVIL_RPC_URL=http://<INFRA_IP>:8545
EXPO_PUBLIC_LAPTOP_IP=<INFRA_IP>
```

Then run Expo normally on coding laptop.

## 6) Data Sync Details

`npm run infra:up` can sync essential rows for one user from production to local:
- `profiles`
- `aa_wallets`
- `passkeys`
- `guardians`
- `wallet_devices`
- `email_recovery_configs`
- `email_recovery_guardians`
- `email_recovery_chain_installs`
- `recovery_requests`
- `recovery_chain_statuses`
- `recovery_approvals`

Script:
- `scripts/supabase-sync-user.js`

Manual run (if needed):

```bash
REMOTE_SUPABASE_URL=... \
REMOTE_SUPABASE_SERVICE_ROLE_KEY=... \
SYNC_USER_EMAIL=you@example.com \
LOCAL_SUPABASE_URL=http://127.0.0.1:54321 \
LOCAL_SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key> \
npm run supabase:sync-user
```

## 7) Troubleshooting

- If `schedule/execute` fails:
  - confirm Anvil is reachable from infra laptop/docker (`http://<INFRA_IP>:8545`)
  - confirm `RECOVERY_RELAYER_PRIVATE_KEY` is funded
  - check function log file above
- If coding laptop can’t connect:
  - open firewall ports on infra laptop (`54321`, `8545`, plus Pimlico ports)
  - ensure both machines are on same LAN
- If you need local-only workflow on one machine:
  - use existing commands `supabase:local:*` in root `package.json`.
