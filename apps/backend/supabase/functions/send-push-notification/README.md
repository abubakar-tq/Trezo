# send-push-notification

Edge function that delivers Expo push notifications when rows land in
`public.notifications`.

## Wiring

This function is **not** invoked automatically by a SQL trigger — it expects to
be called from a Supabase Database Webhook. Set it up once per environment:

1. Deploy the function:
   ```bash
   supabase functions deploy send-push-notification
   ```

2. (Optional) Set a higher rate limit by adding an Expo access token:
   ```bash
   supabase secrets set EXPO_ACCESS_TOKEN=<token>
   ```

3. In the Supabase dashboard, **Database → Webhooks → Create a new hook**:
   - Table: `public.notifications`
   - Events: `INSERT`
   - Type: `Supabase Edge Functions`
   - Edge function: `send-push-notification`
   - HTTP headers: `Authorization: Bearer <SERVICE_ROLE_KEY>` (added automatically)

Alternatively, register the webhook via SQL using `supabase_functions.http_request`
or `pg_net` if dashboard access is unavailable.

## Payload contract

The function expects the standard Supabase Database Webhook envelope:

```json
{
  "type": "INSERT",
  "table": "notifications",
  "schema": "public",
  "record": {
    "id": "...",
    "user_id": "...",
    "category": "incoming_transfer",
    "title": "...",
    "body": "...",
    "payload": { ... }
  }
}
```

## Behavior

- Loads `notification_preferences` for the user and gates delivery per category
  (`tx_alerts`, `swap_alerts`, `security_alerts`).
- Loads enabled rows from `device_push_tokens` for the user.
- Posts to the Expo push endpoint in batches of 100.
- Tokens that come back with `DeviceNotRegistered` or `InvalidCredentials` are
  flipped to `enabled=false` so they stop receiving traffic.

## Local testing

```bash
supabase functions serve send-push-notification --no-verify-jwt
curl -X POST http://localhost:54321/functions/v1/send-push-notification \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","table":"notifications","schema":"public","record":{"id":"00000000-0000-0000-0000-000000000000","user_id":"<UUID>","category":"system","title":"Test","body":"Hello","payload":{}}}'
```
