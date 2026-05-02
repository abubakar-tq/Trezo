#!/usr/bin/env node
"use strict";

const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

const required = (key) => {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
};

const maybe = (key) => {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : null;
};

const log = (...args) => console.log("[supabase-sync-user]", ...args);

async function listAllUsers(client) {
  const users = [];
  let page = 1;
  const perPage = 200;

  for (;;) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const batch = data?.users ?? [];
    users.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }
  return users;
}

function mapUserScopedRows(rows, userId) {
  return rows.map((row) => ({ ...row, user_id: userId }));
}

async function selectOrEmpty(queryPromise, label) {
  const { data, error } = await queryPromise;
  if (error) {
    const message = String(error.message || "");
    if (message.includes("does not exist")) {
      log(`Skipping missing table for ${label}`);
      return [];
    }
    throw new Error(`${label}: ${error.message}`);
  }
  return data ?? [];
}

async function upsertRows(client, table, rows, onConflict = "id") {
  if (!rows.length) return 0;

  const payload = rows.map((row) => ({ ...row }));
  const { error } = await client.from(table).upsert(payload, { onConflict });
  if (error) {
    throw new Error(`upsert ${table}: ${error.message}`);
  }
  return rows.length;
}

async function main() {
  const remoteUrl = required("REMOTE_SUPABASE_URL");
  const remoteServiceKey = required("REMOTE_SUPABASE_SERVICE_ROLE_KEY");
  const localUrl = required("LOCAL_SUPABASE_URL");
  const localServiceKey = required("LOCAL_SUPABASE_SERVICE_ROLE_KEY");
  const syncEmail = maybe("SYNC_USER_EMAIL");
  const syncUserId = maybe("SYNC_USER_ID");

  if (!syncEmail && !syncUserId) {
    throw new Error("Set either SYNC_USER_EMAIL or SYNC_USER_ID.");
  }

  const remote = createClient(remoteUrl, remoteServiceKey, { auth: { persistSession: false } });
  const local = createClient(localUrl, localServiceKey, { auth: { persistSession: false } });

  log("Loading remote auth users...");
  const remoteUsers = await listAllUsers(remote);
  const remoteUser = remoteUsers.find((user) =>
    syncUserId ? user.id === syncUserId : user.email?.toLowerCase() === syncEmail.toLowerCase()
  );
  if (!remoteUser) {
    throw new Error(`Remote user not found (${syncUserId ?? syncEmail}).`);
  }

  log(`Remote user: ${remoteUser.email ?? remoteUser.id} (${remoteUser.id})`);

  log("Loading local auth users...");
  const localUsers = await listAllUsers(local);
  let localUser = localUsers.find((user) => user.email?.toLowerCase() === (remoteUser.email ?? "").toLowerCase());
  if (!localUser) {
    const password = "pass";
    const { data, error } = await local.auth.admin.createUser({
      email: remoteUser.email ?? undefined,
      password,
      email_confirm: true,
      user_metadata: remoteUser.user_metadata ?? {},
      app_metadata: remoteUser.app_metadata ?? {},
      phone: remoteUser.phone ?? undefined,
      phone_confirm: Boolean(remoteUser.phone_confirmed_at),
    });
    if (error) {
      throw new Error(`create local user: ${error.message}`);
    }
    localUser = data.user;
    log(`Created local user ${localUser.id} (${localUser.email ?? "no-email"})`);
  } else {
    log(`Using existing local user ${localUser.id} (${localUser.email ?? "no-email"})`);
  }

  const remoteUserId = remoteUser.id;
  const localUserId = localUser.id;

  const remoteProfiles = await selectOrEmpty(
    remote.from("profiles").select("*").eq("id", remoteUserId),
    "select profiles"
  );
  const localProfiles = remoteProfiles.map((row) => ({ ...row, id: localUserId }));
  const profilesCount = await upsertRows(local, "profiles", localProfiles);

  const remoteWallets = await selectOrEmpty(
    remote.from("aa_wallets").select("*").eq("user_id", remoteUserId),
    "select aa_wallets"
  );
  const wallets = mapUserScopedRows(remoteWallets, localUserId);
  const walletCount = await upsertRows(local, "aa_wallets", wallets);
  const walletIds = wallets.map((wallet) => wallet.id);

  const remotePasskeys = await selectOrEmpty(
    remote.from("passkeys").select("*").eq("user_id", remoteUserId),
    "select passkeys"
  );
  const passkeys = mapUserScopedRows(remotePasskeys, localUserId);
  const passkeyCount = await upsertRows(local, "passkeys", passkeys);

  let guardians = [];
  let deviceRows = [];
  let emailConfigs = [];
  let emailGuardians = [];
  let emailInstalls = [];

  if (walletIds.length > 0) {
    guardians = await selectOrEmpty(
      remote.from("guardians").select("*").in("aa_wallet_id", walletIds),
      "select guardians"
    );
    deviceRows = await selectOrEmpty(
      remote.from("wallet_devices").select("*").in("aa_wallet_id", walletIds),
      "select wallet_devices"
    );
    emailConfigs = await selectOrEmpty(
      remote.from("email_recovery_configs").select("*").in("aa_wallet_id", walletIds),
      "select email_recovery_configs"
    );
  }

  const guardianCount = await upsertRows(local, "guardians", guardians);
  const walletDeviceCount = await upsertRows(local, "wallet_devices", deviceRows);
  const emailConfigCount = await upsertRows(local, "email_recovery_configs", emailConfigs);

  const emailConfigIds = emailConfigs.map((config) => config.id);
  if (emailConfigIds.length > 0) {
    emailGuardians = await selectOrEmpty(
      remote.from("email_recovery_guardians").select("*").in("config_id", emailConfigIds),
      "select email_recovery_guardians"
    );
    emailInstalls = await selectOrEmpty(
      remote.from("email_recovery_chain_installs").select("*").in("config_id", emailConfigIds),
      "select email_recovery_chain_installs"
    );
  }
  const emailGuardianCount = await upsertRows(local, "email_recovery_guardians", emailGuardians);
  const emailInstallCount = await upsertRows(local, "email_recovery_chain_installs", emailInstalls);

  const remoteRecoveryRequests = await selectOrEmpty(
    remote.from("recovery_requests").select("*").eq("user_id", remoteUserId),
    "select recovery_requests"
  );
  const recoveryRequests = mapUserScopedRows(remoteRecoveryRequests, localUserId);
  const recoveryRequestCount = await upsertRows(local, "recovery_requests", recoveryRequests);
  const recoveryRequestIds = recoveryRequests.map((request) => request.id);

  let recoveryChainStatuses = [];
  let recoveryApprovals = [];
  if (recoveryRequestIds.length > 0) {
    recoveryChainStatuses = await selectOrEmpty(
      remote.from("recovery_chain_statuses").select("*").in("request_id", recoveryRequestIds),
      "select recovery_chain_statuses"
    );
    recoveryApprovals = await selectOrEmpty(
      remote.from("recovery_approvals").select("*").in("request_id", recoveryRequestIds),
      "select recovery_approvals"
    );
  }
  const recoveryChainStatusCount = await upsertRows(
    local,
    "recovery_chain_statuses",
    recoveryChainStatuses
  );
  const recoveryApprovalCount = await upsertRows(local, "recovery_approvals", recoveryApprovals);

  log("Sync complete.");
  log(
    JSON.stringify(
      {
        localUserId,
        profiles: profilesCount,
        wallets: walletCount,
        passkeys: passkeyCount,
        guardians: guardianCount,
        walletDevices: walletDeviceCount,
        emailConfigs: emailConfigCount,
        emailGuardians: emailGuardianCount,
        emailInstalls: emailInstallCount,
        recoveryRequests: recoveryRequestCount,
        recoveryChainStatuses: recoveryChainStatusCount,
        recoveryApprovals: recoveryApprovalCount,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[supabase-sync-user] failed:", error.message);
  process.exit(1);
});
