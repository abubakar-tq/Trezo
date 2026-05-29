# Recovery Runbook

Operational guide for diagnosing and manually unblocking email-based Recovery Attempts on Trezo testnet.

## Terminology

- **Recovery Attempt** — one in-flight passkey-rotation request against a smart account. Backed by a row in `email_recovery_groups` (Supabase) and a slot in `EmailRecoveryManager.recoveryRequests[account]` (on-chain). See CONTEXT.md.
- **Relayer EOA** — `0x6a5a55046e7C5B16945d7178DCCc22aBF2cF7282`. Signs `cancelExpiredRecovery` calls. Also the `emailRecoveryKillSwitchAuthorizer` on Base Sepolia.
- **EmailRecovery module** (Base Sepolia) — `0xC4c29a16e929614d973fe7ad50e0Fb5Eb6c7753a`
- **Supabase project** — `jhjnybcscdwpbnztzozy.supabase.co`

---

## 1. When a Recovery Attempt is stuck — diagnostic checklist

Work through these in order. Each step tells you where the blockage is.

### Step 1 — Is the attempt in Supabase at all?

```bash
# Replace <ACCOUNT> with the smart account address (lowercase)
curl -s "https://jhjnybcscdwpbnztzozy.supabase.co/rest/v1/email_recovery_groups?smart_account_address=eq.<ACCOUNT>&deleted_at=is.null&executed_at=is.null&select=id,created_at,chain_ids" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
```

- **No rows** → group was never created or was already soft-deleted. Start fresh.
- **One row** → note the `id` (attemptId) and `chain_ids`. Proceed to step 2.
- **Multiple rows** → stale rows from previous attempts. Use the DevControls "Clear Stale Rows" card or manually `PATCH deleted_at` on the old ones.

### Step 2 — Did the guardian emails land at prove.email?

```bash
# Replace <REQUEST_ID> with the relayer_request_id from email_recovery_approvals
curl -s -X POST https://auth-base-sepolia-staging.prove.email/api/requestStatus \
  -H "Content-Type: application/json" \
  -d '{"request_id": "<REQUEST_ID>"}'
```

Expected progression: `pending` → `email_sent` → `email_received` → `proof_generated`.

- **`pending` after 5 min** → prove.email queue is backed up, or the initial `recoveryRequest` call failed silently. Use "Retry" on the guardian row in `RecoveryAttemptStatusScreen`, or call `resendRecoveryRequest` manually.
- **`failed`** → check the `error` field. Common causes: invalid `controller_eth_addr` (must be the EmailRecovery module address, not the smart account), DKIM failure on the guardian's email domain, or the ZK circuit rejected the proof.
- **`proof_generated`** → prove.email's relayer has already called `handleRecovery` on-chain. Proceed to step 3.

### Step 3 — Is the on-chain vote registered?

```bash
# eth_call to getRecoveryRequest — returns (executeAfter, executeBefore, currentWeight, recoveryDataHash)
cast call 0xC4c29a16e929614d973fe7ad50e0Fb5Eb6c7753a \
  "getRecoveryRequest(address)(uint256,uint256,uint256,bytes32)" \
  <ACCOUNT> \
  --rpc-url https://sepolia.base.org
```

- **All zeros** → no active request. Either `proof_generated` hasn't been submitted yet (prove.email's relayer may still be pending), or the submission reverted. Check eth_getLogs (step 4).
- **`executeBefore < now`** → slot is expired. Clear it: see section 3.
- **`executeAfter <= now < executeBefore`** → window is open, ready to execute. See section 2.
- **`executeAfter > now`** → delay still ticking. Wait, or check `executeAfter` value.

### Step 4 — Check on-chain events

```bash
# Look for RecoveryRequestStarted / RecoveryRequestComplete on Base Sepolia
cast logs \
  --address 0xC4c29a16e929614d973fe7ad50e0Fb5Eb6c7753a \
  --from-block <DEPLOYMENT_BLOCK_OR_RECENT> \
  --rpc-url https://sepolia.base.org \
  "RecoveryRequestStarted(address,address,uint256,bytes32)" \
  "RecoveryRequestComplete(address,uint256,uint256)"
```

Filter results to lines containing the smart account address. This confirms whether prove.email's relayer actually submitted `handleRecovery` on-chain.

---

## 2. Manual completion via prove.email /completeRequest

Use this when the Recovery Attempt reached `executable` phase but `completeRecovery` never fired (app was backgrounded, auto-execute didn't trigger, etc.).

You need: the `recovery_data` bytes from Supabase and the EmailRecovery module address.

```bash
# 1. Fetch recovery_data from Supabase
curl -s "https://jhjnybcscdwpbnztzozy.supabase.co/rest/v1/email_recovery_groups?id=eq.<ATTEMPT_ID>&select=recovery_data,smart_account_address" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"

# 2. Call prove.email's completeRequest endpoint
curl -s -X POST https://auth-base-sepolia-staging.prove.email/api/completeRequest \
  -H "Content-Type: application/json" \
  -d '{
    "account_eth_addr": "<SMART_ACCOUNT_ADDRESS>",
    "controller_eth_addr": "0xC4c29a16e929614d973fe7ad50e0Fb5Eb6c7753a",
    "complete_calldata": "<RECOVERY_DATA_HEX>"
  }'
```

Expected response: `{ "tx_hash": "0x…" }`. Verify on BaseScan Sepolia.

Alternatively use the **Force Complete** dev card in DevControls (requires `__DEV__` build).

---

## 3. Funding the relayer EOA

The relayer EOA (`0x6a5a55046e7C5B16945d7178DCCc22aBF2cF7282`) must have Base Sepolia ETH to call `cancelExpiredRecovery`. Each call costs ~sub-penny; 0.1 ETH covers thousands of calls.

**Check current balance:**

```bash
# Via the edge function (returns balance in wei):
curl -s -X POST https://jhjnybcscdwpbnztzozy.supabase.co/functions/v1/submit-recovery-operation \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"action":"whoami"}'
# → {"relayerAddress":"0x6a5a…","relayerBalanceWei":"100000000000000000"}

# Or via cast:
cast balance 0x6a5a55046e7C5B16945d7178DCCc22aBF2cF7282 --rpc-url https://sepolia.base.org
```

**Alarm threshold:** warn if balance < 0.001 ETH. The **Relayer Health** dev card in DevControls shows a red warning at this level.

**Faucets:**
- Coinbase Base Sepolia: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- QuickNode Base Sepolia: https://faucet.quicknode.com/base/sepolia
- Superchain: https://app.optimism.io/faucet (for OP chains including Base)

**Who to contact for refill:** whoever holds the `RECOVERY_RELAYER_PRIVATE_KEY` Supabase secret.

---

## 4. What to do if `cancel-expired-email-recovery` returns `{ status: "failed" }`

The edge function returns `failed` when the `cancelExpiredRecovery` on-chain call reverts or the RPC times out.

**Checklist:**

1. **Relayer balance** — run `whoami` (section 3). If `relayerBalanceWei` is 0 or very low, fund it first.

2. **Is the slot actually expired?** — run `getRecoveryRequest` (section 1, step 3). If `executeBefore > now`, the slot isn't expired yet; the mobile client should not have called cancel. If both zeros, it was already cleared by a concurrent call (idempotent; treat as success).

3. **Base Sepolia RPC health** — try `cast block-number --rpc-url https://sepolia.base.org`. If it fails, the public RPC endpoint is down. Wait and retry. You can set `RECOVERY_RPC_URL_84532` in Supabase secrets to a private RPC (Alchemy, Infura, QuickNode) to avoid public RPC outages.

4. **Kill switch** — if `EmailRecovery.killSwitchEnabled()` returns true, all write operations revert. Call `cast call 0xC4c29a16e929614d973fe7ad50e0Fb5Eb6c7753a "killSwitchEnabled()(bool)" --rpc-url https://sepolia.base.org`. If true, the `emailRecoveryKillSwitchAuthorizer` (same address as the relayer EOA) must call `toggleKillSwitch()` to re-enable.

5. **Retry manually via curl:**

```bash
curl -s -X POST https://jhjnybcscdwpbnztzozy.supabase.co/functions/v1/submit-recovery-operation \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "cancel-expired-email-recovery",
    "smartAccountAddress": "<ACCOUNT>",
    "chainId": 84532
  }'
# Expected on first real expired slot: { "status": "cleared", "txHash": "0x…" }
# Expected if nothing to clear:        { "status": "no-op" }
# Expected if not yet expired:         { "status": "skipped" }
```

---

## 5. Quick-reference table

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Banner missing, screen shows nothing | Supabase row not found or `deleted_at` set | Check step 1 |
| Status pill stuck on "Awaiting guardian reply" for >10 min | Guardian didn't receive email or prove.email queue | Step 2 — check `requestStatus` |
| `proof_generated` but pill still shows awaiting vote | On-chain `handleRecovery` hasn't landed yet | Wait ~2 min; check step 3 + 4 |
| Pill shows "Vote landed" but `executeAfter` is far future | Timelock delay is long (set during module install) | Wait it out |
| Pill shows "expired" | `executeBefore` elapsed before `completeRecovery` | Use cancel-expired (section 4), then start fresh |
| "Auto-execute failed" toast | `completeRecovery` reverted | Check section 2; use Force Complete dev card |
| `cancel-expired` returns `failed` | Gas, RPC, or kill switch | Section 4 checklist |
