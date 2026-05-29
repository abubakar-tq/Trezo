-- Correct the owner_address column comment on aa_wallets.
--
-- The original schema described this column as "EOA address that controls
-- this smart wallet" (init_schema_consolidated.sql). That description is
-- wrong: Trezo smart accounts are validator-based, not owner-based, and
-- the value actually written by DeployAccountScreen / WalletSyncService
-- is the WebAuthn credential ID padded to bytes32, not an Ethereum EOA.
--
-- This migration only updates the documentation; the column type, name,
-- index, and stored values are unchanged. A future migration may rename
-- the column to passkey_credential_id, but that's a wider refactor that
-- needs the client code to update its mapping in lockstep.

COMMENT ON COLUMN public.aa_wallets.owner_address IS
  'WebAuthn credential ID (bytes32 hex) - identifies the passkey controlling this wallet. NOT an EOA address. The on-chain authoritative copy lives in PasskeyValidator''s stored passkeyId; this column is a denormalized cache for cross-chain wallet discovery.';
