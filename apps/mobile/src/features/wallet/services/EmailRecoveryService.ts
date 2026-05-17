import { getSupabaseClient } from "@lib/supabase";
import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import {
    ABIS,
    buildInstallRecoveryModuleUserOp,
    encodeEmailRecoveryInitData,
    getDeployment,
    getPublicClient,
    isExecutorModuleInstalled,
    submitConfiguredUserOp,
} from "@/src/integration/viem";
import { decode as atob, encode as btoa } from "base64-arraybuffer";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { keccak256, stringToHex, type Address, type Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

import type { ZkEmailRelayerAdapter } from "./ZkEmailRelayerAdapter";

export type EmailRecoveryInstallRequest = {
  smartAccountAddress: Address;
  guardians: readonly Address[];
  weights?: readonly (number | bigint)[];
  threshold: number | bigint;
  delay: number | bigint;
  expiry: number | bigint;
  passkeyId: Hex;
  chainId?: SupportedChainId;
  bundlerUrl?: string;
  paymasterUrl?: string;
  usePaymaster?: boolean;
  nonce?: bigint;
  nonceKey?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
};

export type EmailRecoveryInstallResponse = {
  userOp: UserOperation<"0.7">;
  userOpHash: Hex;
};

export type EmailRecoverySubmitRequest = {
  signedUserOp: UserOperation<"0.7">;
  chainId?: SupportedChainId;
  bundlerUrl?: string;
};

export type DerivedGuardianAddress = {
  email: string;
  accountSalt: Hex;
  guardianAddress: Address;
};

export type EmailRecoveryInstallStatus = "not_installed" | "pending" | "installed" | "failed";
export type EmailRecoverySecurityMode = "none" | "extra";

export type PersistEmailRecoveryMetadataRequest = {
  userId: string;
  smartAccountAddress: Address;
  chainId: SupportedChainId;
  guardianEmails: readonly string[];
  guardianWeights: readonly (number | bigint)[];
  threshold: number | bigint;
  delaySeconds: number | bigint;
  expirySeconds: number | bigint;
  securityMode?: EmailRecoverySecurityMode;
  installStatus: EmailRecoveryInstallStatus;
  installUserOpHash?: Hex;
  installedAt?: string;
};

export type EmailRecoveryConfigView = {
  id: string;
  threshold: number;
  delaySeconds: number;
  expirySeconds: number;
  securityMode: EmailRecoverySecurityMode;
  createdAt: string;
  updatedAt: string;
};

export type EmailRecoveryGuardianView = {
  id: string;
  emailHash: Hex;
  normalizedEmailEncrypted: string;
  maskedEmail: string;
  displayLabel: string | null;
  weight: number;
  resolvedEmail: string | null;
  isLocked: boolean;
  acceptanceStatus: "pending" | "acceptance_email_sent" | "accepted" | "failed";
};

export type EmailRecoveryChainInstallView = {
  chainId: number;
  installStatus: EmailRecoveryInstallStatus;
  installUserOpHash: Hex | null;
  installedAt: string | null;
  lastCheckedAt: string | null;
};

export type LoadEmailRecoveryMetadataRequest = {
  userId?: string;
  smartAccountAddress: Address;
};

export type LoadedEmailRecoveryMetadata = {
  config: EmailRecoveryConfigView;
  guardians: EmailRecoveryGuardianView[];
  installations: EmailRecoveryChainInstallView[];
};

const normalizeGuardianEmail = (email: string) => email.trim().toLowerCase();
const RECOVERY_VAULT_KEY_PREFIX = "trezo_recovery_vault_";
const GUARDIAN_ACCOUNT_CODE_PREFIX = "trezo_guardian_acct_code_";
const PLAINTEXT_PREFIX = "plain-v1:";

// BN254 scalar field modulus — the curve used by ZK Email's Poseidon proofs.
// accountCode must be a uniformly random scalar in [0, BN254_MODULUS).
const BN254_MODULUS =
  0x30644E72E131A029B85045B68181585D2833E84879B9709143E1F593F0000001n;

const bytesToHex = (bytes: Uint8Array): Hex => {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}` as Hex;
};

const bigIntToPaddedHex = (value: bigint): Hex => {
  const hex = value.toString(16).padStart(64, "0");
  return `0x${hex}` as Hex;
};

const guardianAccountCodeStorageKey = (smartAccountAddress: Address, email: string): string => {
  const emailKey = keccak256(stringToHex(normalizeGuardianEmail(email))).slice(2, 18);
  return `${GUARDIAN_ACCOUNT_CODE_PREFIX}${smartAccountAddress.toLowerCase()}_${emailKey}`;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
};

const hasSubtleCrypto = (): boolean => {
  return typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.subtle !== "undefined";
};

const xorWithKey = (input: Uint8Array, keyMaterial: Uint8Array): Uint8Array => {
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    out[i] = input[i] ^ keyMaterial[i % keyMaterial.length];
  }
  return out;
};

export class EmailRecoveryService {
  private static supabase = getSupabaseClient();

  static normalizeGuardianEmail(email: string): string {
    return normalizeGuardianEmail(email);
  }

  static maskEmail(email: string): string {
    const normalized = normalizeGuardianEmail(email);
    const [localPart, domain = ""] = normalized.split("@");
    const domainParts = domain.split(".");
    const domainName = domainParts[0] ?? "";
    const tld = domainParts.slice(1).join(".");

    const maskedLocal =
      localPart.length <= 1 ? "*" : `${localPart[0]}${"*".repeat(Math.max(localPart.length - 1, 1))}`;
    const maskedDomain =
      domainName.length <= 1
        ? "*"
        : `${domainName[0]}${"*".repeat(Math.max(domainName.length - 1, 1))}`;

    return tld ? `${maskedLocal}@${maskedDomain}.${tld}` : `${maskedLocal}@${maskedDomain}`;
  }

  /**
   * Generates or retrieves a local recovery vault key for this specific smart account.
   * This key remains strictly on-device in SecureStore.
   */
  private static async getOrCreateVaultKey(smartAccountAddress: Address): Promise<Uint8Array> {
    const keyName = `${RECOVERY_VAULT_KEY_PREFIX}${smartAccountAddress.toLowerCase()}`;
    const storedBase64 = await SecureStore.getItemAsync(keyName);

    if (storedBase64) {
      return new Uint8Array(atob(storedBase64));
    }

    const newKey = await Crypto.getRandomBytesAsync(32);
    await SecureStore.setItemAsync(keyName, btoa(toArrayBuffer(newKey)));
    return newKey;
  }

  static async getVaultKeyBase64(smartAccountAddress: Address): Promise<string | null> {
    const keyName = `${RECOVERY_VAULT_KEY_PREFIX}${smartAccountAddress.toLowerCase()}`;
    return await SecureStore.getItemAsync(keyName);
  }

  static async hasVaultKey(smartAccountAddress: Address): Promise<boolean> {
    const key = await this.getVaultKeyBase64(smartAccountAddress);
    return Boolean(key);
  }

  static async importVaultKeyBase64(
    smartAccountAddress: Address,
    vaultKeyBase64: string,
  ): Promise<void> {
    const trimmed = vaultKeyBase64.trim();
    if (!trimmed) throw new Error("Vault key is required.");

    let decoded: Uint8Array;
    try {
      decoded = new Uint8Array(atob(trimmed));
    } catch {
      throw new Error("Vault key format is invalid.");
    }

    if (decoded.length !== 32) {
      throw new Error("Vault key must decode to 32 bytes.");
    }

    const keyName = `${RECOVERY_VAULT_KEY_PREFIX}${smartAccountAddress.toLowerCase()}`;
    await SecureStore.setItemAsync(keyName, trimmed);
  }

  /**
   * accountCode is a per-(smartAccount, guardianEmail) secret used by the ZK Email
   * relayer to derive the guardian's EmailAuth proxy address (`account_salt =
   * Poseidon(accountCode, emailCommitment)`). It is required for the initial
   * acceptance email; after the guardian's on-chain `EmailAuth` proxy is deployed
   * via `handleAcceptance`, the relayer caches the pair and the mobile client
   * never needs the value again. Lifecycle: created when guardian is added →
   * stored in SecureStore on the originating device → deleted after the
   * `email_recovery_guardians.acceptance_status` reconciles to `accepted`.
   */
  private static async generateAccountCode(): Promise<Hex> {
    // Rejection sampling: draw 32 random bytes; accept iff scalar < BN254 modulus.
    // The rejection probability per draw is ~p/2^256 ≈ 1.9e-39, so one draw is
    // overwhelmingly enough — the loop is purely a correctness guarantee.
    while (true) {
      const bytes = await Crypto.getRandomBytesAsync(32);
      const scalar = BigInt(bytesToHex(bytes));
      if (scalar < BN254_MODULUS && scalar !== 0n) {
        return bigIntToPaddedHex(scalar);
      }
    }
  }

  static async getOrCreateGuardianAccountCode(
    smartAccountAddress: Address,
    guardianEmail: string,
  ): Promise<Hex> {
    const storageKey = guardianAccountCodeStorageKey(smartAccountAddress, guardianEmail);
    const existing = await SecureStore.getItemAsync(storageKey);
    if (existing) {
      return existing as Hex;
    }
    const fresh = await this.generateAccountCode();
    await SecureStore.setItemAsync(storageKey, fresh);
    return fresh;
  }

  static async getGuardianAccountCode(
    smartAccountAddress: Address,
    guardianEmail: string,
  ): Promise<Hex | null> {
    const storageKey = guardianAccountCodeStorageKey(smartAccountAddress, guardianEmail);
    const existing = await SecureStore.getItemAsync(storageKey);
    return (existing as Hex | null) ?? null;
  }

  static async clearGuardianAccountCode(
    smartAccountAddress: Address,
    guardianEmail: string,
  ): Promise<void> {
    const storageKey = guardianAccountCodeStorageKey(smartAccountAddress, guardianEmail);
    await SecureStore.deleteItemAsync(storageKey).catch(() => undefined);
  }

  /**
   * Encrypts a normalized email using AES-GCM with the local Vault Key.
   * Format: aes-gcm-v1:<iv_base64>:<ciphertext_base64>
   */
  private static async encryptEmailForStorage(
    normalizedEmail: string,
    smartAccountAddress: Address,
    securityMode: EmailRecoverySecurityMode,
  ): Promise<string> {
    if (securityMode === "none") {
      return `${PLAINTEXT_PREFIX}${normalizedEmail}`;
    }

    const key = await this.getOrCreateVaultKey(smartAccountAddress);
    const iv = await Crypto.getRandomBytesAsync(12);
    const data = new TextEncoder().encode(normalizedEmail);

    if (!hasSubtleCrypto()) {
      const keyMaterial = new Uint8Array(key.length + iv.length);
      keyMaterial.set(key, 0);
      keyMaterial.set(iv, key.length);
      const obfuscated = xorWithKey(data, keyMaterial);
      return `xor-v1:${btoa(toArrayBuffer(iv))}:${btoa(toArrayBuffer(obfuscated))}`;
    }

    // Using expo-crypto to perform encryption
    // Note: older versions of expo-crypto didn't support AES-GCM directly in a broad way,
    // but modern standard WebCrypto API is available in most environments or via polyfills.
    // For this implementation, we assume a standard WebCrypto compatible environment provided by Expo/React Native.
    const cryptoKey = await crypto.subtle.importKey("raw", toArrayBuffer(key), "AES-GCM", false, ["encrypt"]);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, cryptoKey, toArrayBuffer(data));

    const ivB64 = btoa(toArrayBuffer(iv));
    const cipherB64 = btoa(ciphertext);

    return `aes-gcm-v1:${ivB64}:${cipherB64}`;
  }

  /**
   * Decrypts an email using the local Vault Key.
   */
  static async decryptEmail(
    encryptedPayload: string,
    smartAccountAddress: Address,
  ): Promise<string | null> {
    if (encryptedPayload.startsWith(PLAINTEXT_PREFIX)) {
      return encryptedPayload.slice(PLAINTEXT_PREFIX.length);
    }

    const isAesPayload = encryptedPayload.startsWith("aes-gcm-v1:");
    const isXorPayload = encryptedPayload.startsWith("xor-v1:");
    if (!isAesPayload && !isXorPayload) {
      return null;
    }

    try {
      const [, ivB64, cipherB64] = encryptedPayload.split(":");
      const iv = new Uint8Array(atob(ivB64!));
      const ciphertext = new Uint8Array(atob(cipherB64!));
      const key = await this.getOrCreateVaultKey(smartAccountAddress);

      if (isXorPayload || !hasSubtleCrypto()) {
        const keyMaterial = new Uint8Array(key.length + iv.length);
        keyMaterial.set(key, 0);
        keyMaterial.set(iv, key.length);
        const plainBytes = xorWithKey(ciphertext, keyMaterial);
        return new TextDecoder().decode(plainBytes);
      }

      const cryptoKey = await crypto.subtle.importKey("raw", toArrayBuffer(key), "AES-GCM", false, ["decrypt"]);
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, cryptoKey, toArrayBuffer(ciphertext));

      return new TextDecoder().decode(decrypted);
    } catch (e) {
      console.error("Failed to decrypt email:", e);
      return null;
    }
  }

  static async persistMetadata(request: PersistEmailRecoveryMetadataRequest): Promise<string | null> {
    const lowerAddress = request.smartAccountAddress.toLowerCase();
    const securityMode: EmailRecoverySecurityMode = request.securityMode ?? "none";

    // 1. Upsert config (Group level)
    const { data: existingConfig, error: existingConfigError } = await this.supabase
      .from("email_recovery_configs")
      .select("id")
      .eq("smart_account_address", lowerAddress)
      .eq("recovery_type", "email")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (existingConfigError) throw existingConfigError;

    const threshold = Number(request.threshold);
    const delaySeconds = Number(request.delaySeconds);
    const expirySeconds = Number(request.expirySeconds);

    let configId: string;
    if (!existingConfig) {
      const { data: insertedConfig, error: insertConfigError } = await this.supabase
        .from("email_recovery_configs")
        .insert({
          user_id: request.userId,
          smart_account_address: lowerAddress,
          recovery_type: "email",
          threshold,
          delay_seconds: delaySeconds,
          expiry_seconds: expirySeconds,
          security_mode: securityMode,
          is_active: true,
        })
        .select("id")
        .single();

      if (insertConfigError) throw insertConfigError;
      configId = insertedConfig.id;
    } else {
      configId = existingConfig.id;
      const { error: updateConfigError } = await this.supabase
        .from("email_recovery_configs")
        .update({
          threshold,
          delay_seconds: delaySeconds,
          expiry_seconds: expirySeconds,
          security_mode: securityMode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", configId);

      if (updateConfigError) throw updateConfigError;
    }

    // 2. Sync Guardians (Refresh all)
    const guardianRows = await Promise.all(
      request.guardianEmails.map(async (email, index) => {
        const normalized = normalizeGuardianEmail(email);
        const emailHash = keccak256(stringToHex(normalized));
        const encrypted = await this.encryptEmailForStorage(
          normalized,
          request.smartAccountAddress,
          securityMode,
        );

        return {
          config_id: configId,
          normalized_email_encrypted: encrypted,
          email_hash: emailHash,
          masked_email: this.maskEmail(normalized),
          weight: Math.max(Number(request.guardianWeights[index] ?? 1), 1),
        };
      }),
    );

    // Hard refresh guardians for simplicity (replace logic)
    await this.supabase.from("email_recovery_guardians").delete().eq("config_id", configId);
    const { error: insertGuardiansError } = await this.supabase
      .from("email_recovery_guardians")
      .insert(guardianRows);

    if (insertGuardiansError) throw insertGuardiansError;

    // 3. Update Chain Install status
    const { error: upsertInstallError } = await this.supabase
      .from("email_recovery_chain_installs")
      .upsert(
        {
          config_id: configId,
          chain_id: Number(request.chainId),
          install_status: request.installStatus,
          install_user_op_hash: request.installUserOpHash,
          installed_at: request.installedAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "config_id,chain_id" },
      );

    if (upsertInstallError) throw upsertInstallError;

    return configId;
  }

  static async loadMetadata(
    request: LoadEmailRecoveryMetadataRequest,
  ): Promise<LoadedEmailRecoveryMetadata | null> {
    const lowerAddress = request.smartAccountAddress.toLowerCase();

    const { data: config, error: configError } = await this.supabase
      .from("email_recovery_configs")
      .select(
        `
        id,
        threshold,
        delay_seconds,
        expiry_seconds,
        security_mode,
        created_at,
        updated_at,
        email_recovery_guardians (
          id,
          email_hash,
          normalized_email_encrypted,
          masked_email,
          display_label,
          weight,
          acceptance_status
        ),
        email_recovery_chain_installs (
          chain_id,
          install_status,
          install_user_op_hash,
          installed_at,
          last_checked_at
        )
      `,
      )
      .eq("smart_account_address", lowerAddress)
      .eq("is_active", true)
      .maybeSingle();

    if (configError) throw configError;
    if (!config) return null;

    const securityMode = (config.security_mode ?? "none") as EmailRecoverySecurityMode;
    const hasVaultKey = await this.hasVaultKey(request.smartAccountAddress);

    const guardians = await Promise.all(
      (config.email_recovery_guardians as any[]).map(async (g) => {
        const encryptedPayload = String(g.normalized_email_encrypted ?? "");
        let resolvedEmail: string | null = null;
        let isLocked = false;

        if (encryptedPayload.startsWith(PLAINTEXT_PREFIX)) {
          resolvedEmail = encryptedPayload.slice(PLAINTEXT_PREFIX.length);
        } else if (securityMode === "extra") {
          if (hasVaultKey) {
            resolvedEmail = await this.decryptEmail(
              encryptedPayload,
              request.smartAccountAddress,
            );
            isLocked = !resolvedEmail;
          } else {
            isLocked = true;
          }
        }

        return {
          id: g.id,
          emailHash: g.email_hash,
          normalizedEmailEncrypted: encryptedPayload,
          maskedEmail: g.masked_email,
          displayLabel: g.display_label,
          weight: g.weight,
          resolvedEmail,
          isLocked,
          acceptanceStatus: (g.acceptance_status ?? "pending") as EmailRecoveryGuardianView["acceptanceStatus"],
        } satisfies EmailRecoveryGuardianView;
      }),
    );

    const installations = (config.email_recovery_chain_installs as any[]).map((i) => ({
      chainId: i.chain_id,
      installStatus: i.install_status,
      installUserOpHash: i.install_user_op_hash,
      installedAt: i.installed_at,
      lastCheckedAt: i.last_checked_at,
    }));

    return {
      config: {
        id: config.id,
        threshold: config.threshold,
        delaySeconds: config.delay_seconds,
        expirySeconds: config.expiry_seconds,
        securityMode,
        createdAt: config.created_at,
        updatedAt: config.updated_at,
      },
      guardians,
      installations,
    };
  }

  static async syncCurrentChainInstallStatus(params: {
    configId: string;
    chainId: SupportedChainId;
    installStatus: EmailRecoveryInstallStatus;
    installedAt?: string;
  }): Promise<void> {
    const nowIso = new Date().toISOString();
    const { error } = await this.supabase
      .from("email_recovery_chain_installs")
      .update({
        install_status: params.installStatus,
        installed_at: params.installStatus === "installed" ? params.installedAt ?? nowIso : null,
        last_checked_at: nowIso,
      })
      .eq("config_id", params.configId)
      .eq("chain_id", Number(params.chainId));

    if (error) throw error;
  }


  /**
   * Derives the on-chain EmailAuth guardian address for each guardian email by
   * calling the relayer's `getAccountSalt(accountCode, email)` endpoint to obtain
   * the canonical Poseidon-derived salt, then reading `computeEmailAuthAddress`
   * on the EmailRecovery module. accountCodes are generated and persisted
   * per-(smartAccount, email) on first call so subsequent calls (e.g., re-deriving
   * on chain switch) return the same guardian address.
   *
   * `adapter` must be a relayer adapter whose `getAccountSalt` matches the
   * formula used by the relayer that will later send acceptance emails — using
   * the mock relayer here pins the wallet to the mock for the lifetime of the
   * guardian (its salt formula differs from the production relayer's).
   */
  static async deriveGuardianAddresses(
    smartAccountAddress: Address,
    guardianEmails: readonly string[],
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
    adapter?: ZkEmailRelayerAdapter,
  ): Promise<DerivedGuardianAddress[]> {
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      throw new Error(`No Email Recovery module configured for chain ${chainId}`);
    }
    if (!adapter) {
      throw new Error(
        "Relayer adapter is required to derive guardian addresses. "
          + "Pass EmailRecoveryGroupService.createRelayer() or compatible.",
      );
    }

    const publicClient = getPublicClient(chainId);
    return Promise.all(
      guardianEmails.map(async (email) => {
        const normalizedEmail = normalizeGuardianEmail(email);
        if (!normalizedEmail) {
          throw new Error("Guardian email is required to derive the EmailAuth guardian address");
        }

        const accountCode = await this.getOrCreateGuardianAccountCode(
          smartAccountAddress,
          normalizedEmail,
        );

        const accountSalt = await adapter.getAccountSalt(accountCode, normalizedEmail);
        if (!accountSalt) {
          throw new Error(
            `Relayer did not return an account salt for guardian ${this.maskEmail(normalizedEmail)}`,
          );
        }

        const guardianAddress = await publicClient.readContract({
          address: deployment.emailRecovery as Address,
          abi: ABIS.emailRecovery,
          functionName: "computeEmailAuthAddress",
          args: [smartAccountAddress, accountSalt],
        });

        return {
          email: normalizedEmail,
          accountSalt,
          guardianAddress: guardianAddress as Address,
        } satisfies DerivedGuardianAddress;
      }),
    );
  }

  static encodeInitData(
    guardians: readonly Address[],
    weights: readonly (number | bigint)[],
    threshold: number | bigint,
    delay: number | bigint,
    expiry: number | bigint,
  ): Hex {
    return encodeEmailRecoveryInitData(guardians, weights, threshold, delay, expiry);
  }

  static async buildInstallModuleUserOp(
    params: EmailRecoveryInstallRequest,
  ): Promise<EmailRecoveryInstallResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl()
      : params.paymasterUrl;
    const weights = params.weights ?? params.guardians.map(() => 1n);
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      throw new Error(`No Email Recovery module configured for chain ${chainId}`);
    }
    const initData = encodeEmailRecoveryInitData(
      params.guardians,
      weights,
      params.threshold,
      params.delay,
      params.expiry,
    );

    const { userOp, userOpHash } = await buildInstallRecoveryModuleUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      moduleAddress: deployment.emailRecovery as Address,
      initData,
      passkeyId: params.passkeyId,
      nonce: params.nonce,
      nonceKey: params.nonceKey,
      usePaymaster: params.usePaymaster,
      paymasterUrl,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      callGasLimit: params.callGasLimit,
      verificationGasLimit: params.verificationGasLimit ?? 1_200_000n,
      preVerificationGas: params.preVerificationGas ?? 120_000n,
      operationLabel: "buildInstallEmailRecoveryUserOp",
    });

    return { userOp, userOpHash };
  }

  static async submitInstallModuleUserOp(params: EmailRecoverySubmitRequest): Promise<Hex> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    if (!params.signedUserOp.signature || params.signedUserOp.signature === "0x") {
      throw new Error("Signed UserOperation must include a signature before submission");
    }
    return submitConfiguredUserOp(params.signedUserOp, chainId, bundlerUrl);
  }

  static async isModuleInstalled(
    smartAccountAddress: Address,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<boolean> {
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      throw new Error(`No Email Recovery module configured for chain ${chainId}`);
    }
    return isExecutorModuleInstalled({
      chainId,
      smartAccountAddress,
      moduleAddress: deployment.emailRecovery as Address,
    });
  }

  static async checkGuardianAcceptanceStatus(
    smartAccountAddress: Address,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<{ allAccepted: boolean; acceptedWeight: bigint; threshold: bigint }> {
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      throw new Error(`No Email Recovery module configured for chain ${chainId}`);
    }

    const publicClient = getPublicClient(chainId);
    const emailRecoveryAddr = deployment.emailRecovery as Address;

    const guardianConfig = await publicClient.readContract({
      address: emailRecoveryAddr,
      abi: [
        {
          name: "getGuardianConfig",
          type: "function",
          stateMutability: "view",
          inputs: [{ name: "account", type: "address" }],
          outputs: [
            { name: "guardians", type: "address[]" },
            { name: "weights", type: "uint256[]" },
            { name: "threshold", type: "uint256" },
            { name: "delay", type: "uint256" },
            { name: "expiry", type: "uint256" },
            { name: "currentWeight", type: "uint256" },
          ],
        },
      ],
      functionName: "getGuardianConfig",
      args: [smartAccountAddress],
    }) as [Address[], bigint[], bigint, bigint, bigint, bigint];

    const [, , threshold, , , currentWeight] = guardianConfig;
    const allAccepted = currentWeight >= threshold;

    return { allAccepted, acceptedWeight: currentWeight, threshold };
  }

  /**
   * After the EmailRecovery module is installed on-chain, walk every guardian
   * whose `acceptance_status` is still `pending` and trigger a relayer
   * acceptance email. The relayer parses the guardian's reply, generates a ZK
   * proof of the DKIM-signed response, and auto-submits `handleAcceptance` on
   * the EmailRecovery module — incrementing on-chain `acceptedWeight` for the
   * matching guardian. Locally we transition each row to
   * `acceptance_email_sent` and persist the relayer's `request_id` so polling
   * can fetch status.
   *
   * The `command` passed to the relayer must match the on-chain acceptance
   * template at `templateIdx=0` registered by the deployed command handler —
   * for `EmailRecoveryCommandHandler.sol` that's "Accept guardian request for
   * {ethAddr}".
   */
  static async sendGuardianAcceptanceEmails(params: {
    smartAccountAddress: Address;
    configId: string;
    adapter: ZkEmailRelayerAdapter;
    acceptanceTemplateIdx?: number;
  }): Promise<{ sent: number; skipped: number; failed: number }> {
    const templateIdx = params.acceptanceTemplateIdx ?? 0;
    const command = `Accept guardian request for ${params.smartAccountAddress}`;

    const { data: pending, error } = await this.supabase
      .from("email_recovery_guardians")
      .select("id, normalized_email_encrypted, masked_email, acceptance_status")
      .eq("config_id", params.configId)
      .eq("acceptance_status", "pending");

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return { sent: 0, skipped: 0, failed: 0 };
    }

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of pending as Array<{
      id: string;
      normalized_email_encrypted: string;
      masked_email: string;
      acceptance_status: string;
    }>) {
      const email = await this.decryptEmail(
        row.normalized_email_encrypted,
        params.smartAccountAddress,
      );
      if (!email) {
        // Vault key unavailable — can't send. Skip silently, surface via UI.
        skipped += 1;
        continue;
      }

      try {
        const accountCode = await this.getOrCreateGuardianAccountCode(
          params.smartAccountAddress,
          email,
        );

        const deployment = getDeployment(DEFAULT_CHAIN_ID);
        const controllerEthAddr = deployment?.emailRecovery as Address | undefined;
        if (!controllerEthAddr) {
          throw new Error("EmailRecovery module address not configured for chain");
        }

        const ref = await params.adapter.sendAcceptanceRequest({
          controllerEthAddr,
          guardianEmailAddr: email,
          accountCode,
          templateIdx,
          command,
        });

        await this.supabase
          .from("email_recovery_guardians")
          .update({
            acceptance_status: "acceptance_email_sent",
            acceptance_relayer_request_id: ref.requestId,
            acceptance_checked_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        sent += 1;
      } catch (err) {
        console.warn("[EmailRecovery] sendAcceptanceEmail failed for", row.masked_email, err);
        await this.supabase
          .from("email_recovery_guardians")
          .update({
            acceptance_status: "failed",
            acceptance_checked_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        failed += 1;
      }
    }

    return { sent, skipped, failed };
  }

  /**
   * Polls the relayer for status updates on every guardian whose
   * acceptance_status is `acceptance_email_sent`, then cross-references the
   * on-chain `getGuardianConfig.guardians` list to confirm acceptance. When a
   * guardian's on-chain `EmailAuth` proxy is found in the on-chain set, mark
   * them `accepted`, stamp `accepted_at`, and clear their local accountCode
   * (no longer needed for the relayer cache to work).
   *
   * Returns the count of newly-accepted guardians so the UI can chirp.
   */
  static async pollGuardianAcceptanceStatuses(params: {
    smartAccountAddress: Address;
    configId: string;
    adapter: ZkEmailRelayerAdapter;
    chainId?: SupportedChainId;
  }): Promise<{ newlyAccepted: number; stillPending: number; failed: number }> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      return { newlyAccepted: 0, stillPending: 0, failed: 0 };
    }

    const { data: pending, error } = await this.supabase
      .from("email_recovery_guardians")
      .select(
        "id, normalized_email_encrypted, masked_email, acceptance_status, acceptance_relayer_request_id",
      )
      .eq("config_id", params.configId)
      .in("acceptance_status", ["acceptance_email_sent", "pending"]);

    if (error) throw error;
    if (!pending || pending.length === 0) {
      return { newlyAccepted: 0, stillPending: 0, failed: 0 };
    }

    const publicClient = getPublicClient(chainId);
    const guardianConfig = (await publicClient.readContract({
      address: deployment.emailRecovery as Address,
      abi: ABIS.emailRecovery,
      functionName: "getGuardianConfig",
      args: [params.smartAccountAddress],
    })) as [Address[], bigint[], bigint, bigint, bigint, bigint];

    const onChainGuardians = new Set(
      guardianConfig[0].map((addr: Address) => addr.toLowerCase()),
    );

    let newlyAccepted = 0;
    let stillPending = 0;
    let failed = 0;

    for (const row of pending as Array<{
      id: string;
      normalized_email_encrypted: string;
      masked_email: string;
      acceptance_status: string;
      acceptance_relayer_request_id: string | null;
    }>) {
      const email = await this.decryptEmail(
        row.normalized_email_encrypted,
        params.smartAccountAddress,
      );
      if (!email) {
        // Vault key missing — defer until imported.
        stillPending += 1;
        continue;
      }

      const accountCode = await this.getGuardianAccountCode(
        params.smartAccountAddress,
        email,
      );

      let derivedAddress: Address | null = null;
      if (accountCode) {
        try {
          const salt = await params.adapter.getAccountSalt(accountCode, email);
          if (salt) {
            derivedAddress = (await publicClient.readContract({
              address: deployment.emailRecovery as Address,
              abi: ABIS.emailRecovery,
              functionName: "computeEmailAuthAddress",
              args: [params.smartAccountAddress, salt],
            })) as Address;
          }
        } catch (err) {
          console.warn("[EmailRecovery] poll derivedAddress failed", row.masked_email, err);
        }
      }

      const isAcceptedOnChain = Boolean(
        derivedAddress && onChainGuardians.has(derivedAddress.toLowerCase()),
      );

      if (isAcceptedOnChain) {
        await this.supabase
          .from("email_recovery_guardians")
          .update({
            acceptance_status: "accepted",
            accepted_at: new Date().toISOString(),
            acceptance_checked_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        // Keep accountCode in SecureStore even after acceptance — it's needed
        // later to derive this guardian's on-chain EmailAuth address during
        // removeGuardian (and for re-acceptance if a re-invite is ever
        // needed). Cost: ~32 bytes per guardian; security: device passkey is
        // the real authorization, accountCode alone unlocks nothing.
        newlyAccepted += 1;
        continue;
      }

      // Otherwise, refresh the relayer status (informational, doesn't drive
      // the on-chain truth — that's what the derived-address check above is
      // for).
      if (row.acceptance_relayer_request_id) {
        try {
          const status = await params.adapter.getRequestStatus(
            row.acceptance_relayer_request_id,
          );
          if (status.status === "failed") {
            await this.supabase
              .from("email_recovery_guardians")
              .update({
                acceptance_status: "failed",
                acceptance_checked_at: new Date().toISOString(),
              })
              .eq("id", row.id);
            failed += 1;
            continue;
          }
        } catch (err) {
          console.warn("[EmailRecovery] poll requestStatus failed", row.masked_email, err);
        }
      }

      stillPending += 1;
    }

    return { newlyAccepted, stillPending, failed };
  }

  /**
   * Builds a UserOp that calls `removeGuardian(account, guardian)` on the
   * EmailRecovery module. Used by the Profile screen "Delete Guardian" button
   * to remove an accepted (or stuck-pending) guardian on-chain. Also cleans up
   * the local accountCode for that guardian so re-adding the same email
   * generates a fresh code.
   *
   * Note: this is the OFF-CHAIN scheduler side. The actual on-chain
   * `removeGuardian` call has no timelock for accepted guardians in the
   * current EmailRecovery module (`emailRecoveryMinimumDelay = 0` on Base
   * Sepolia), so the call is immediate. Callers must still pass a signed
   * UserOp through the bundler.
   */
  static async buildRemoveGuardianUserOp(params: {
    smartAccountAddress: Address;
    guardianAddress: Address;
    passkeyId: Hex;
    chainId?: SupportedChainId;
    bundlerUrl?: string;
    paymasterUrl?: string;
    usePaymaster?: boolean;
  }): Promise<EmailRecoveryInstallResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      throw new Error(`No Email Recovery module configured for chain ${chainId}`);
    }

    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl(chainId);
    const usePaymaster = params.usePaymaster ?? true;
    const paymasterUrl = usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl(chainId)
      : undefined;

    const { encodeFunctionData } = await import("viem");
    const callData = encodeFunctionData({
      abi: ABIS.emailRecovery,
      functionName: "removeGuardian",
      args: [params.smartAccountAddress, params.guardianAddress],
    });

    // EmailRecovery.removeGuardian is invoked via SmartAccount.execute so
    // msg.sender on the module is the account itself — same wrapping pattern
    // the install flow uses, just with the removeGuardian calldata.
    const { buildSmartAccountExecutionUserOp } = await import(
      "@/src/integration/viem/userOps"
    );
    const { userOp, userOpHash } = await buildSmartAccountExecutionUserOp({
      smartAccountAddress: params.smartAccountAddress,
      target: deployment.emailRecovery as Address,
      value: 0n,
      data: callData,
      chainId,
      bundlerUrl,
      paymasterUrl,
      usePaymaster,
      passkeyId: params.passkeyId,
      operationLabel: "EmailRecovery.removeGuardian",
    });

    return { userOp, userOpHash };
  }

  /**
   * After on-chain removeGuardian succeeds, scrub the off-chain state:
   * - Mark the Supabase guardian row as removed (acceptance_status='failed' +
   *   a removed_at column would be nicer but the current schema doesn't have
   *   one — using 'failed' with a comment is acceptable for V1).
   * - Clear the local accountCode for this guardian (so re-adding the same
   *   email starts fresh).
   */
  static async cleanupRemovedGuardian(params: {
    smartAccountAddress: Address;
    guardianRowId: string;
    guardianEmail: string;
  }): Promise<void> {
    await this.clearGuardianAccountCode(params.smartAccountAddress, params.guardianEmail);
    await this.supabase
      .from("email_recovery_guardians")
      .delete()
      .eq("id", params.guardianRowId);
  }

}
