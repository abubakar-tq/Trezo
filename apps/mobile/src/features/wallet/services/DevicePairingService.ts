import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { Address } from "viem";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import {
  getPasskeyOnchainState,
  isContractDeployed,
} from "@/src/integration/viem";
import type { SupportedChainId } from "@/src/integration/chains";
import { getSupabaseClient } from "@/src/lib/supabase";

export type PairingStatus =
  | "created"
  | "passkey_submitted"
  | "approved"
  | "rejected"
  | "expired"
  | "failed";

export type DeviceStatus = "active" | "pending_removal" | "removed";

export type DevicePairingRequest = {
  id: string;
  user_id: string;
  wallet_address: string;
  chain_id: number;
  pairing_secret_hash: string;
  status: PairingStatus;
  new_device_name: string | null;
  new_device_platform: string | null;
  new_passkey_id: string | null;
  new_credential_id: string | null;
  new_public_key_x: string | null;
  new_public_key_y: string | null;
  expires_at: string;
  created_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  operation_hash: string | null;
  error: string | null;
};

export type WalletDevice = {
  id: string;
  user_id: string;
  wallet_address: string;
  chain_id: number;
  passkey_id: string;
  credential_id: string | null;
  device_name: string | null;
  platform: string | null;
  status: DeviceStatus;
  added_at: string;
  last_used_at: string | null;
  removed_at: string | null;
  removal_execute_after: string | null;
};

export type PairingDeepLinkParams = {
  requestId: string;
  secret: string;
};

const PAIRING_TTL_MS = 10 * 60 * 1000;
const PENDING_DEEPLINK_KEY = "trezo_pair_device_pending_link_v1";

const nowIso = () => new Date().toISOString();

const normalizeHex = (value: string) => (value.startsWith("0x") ? value : `0x${value}`);

const isExpired = (expiresAt: string) => new Date(expiresAt).getTime() <= Date.now();

const normalizeWalletAddress = (value: string) => value.trim().toLowerCase();
const toIsoFromUnixSeconds = (value: bigint) => new Date(Number(value) * 1000).toISOString();

const sha256 = async (input: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input, {
    encoding: Crypto.CryptoEncoding.HEX,
  });

export class DevicePairingService {
  static async createPairingRequest(params: {
    userId: string;
    walletAddress: string;
    chainId: number;
  }): Promise<{ request: DevicePairingRequest; secret: string; deepLink: string }> {
    const supabase = getSupabaseClient();
    await this.pruneExpiredRequests(params.userId);
    const random = await Crypto.getRandomBytesAsync(32);
    const secret = Array.from(random)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const secretHash = await sha256(secret);
    const expiresAt = new Date(Date.now() + PAIRING_TTL_MS).toISOString();

    const { data, error } = await supabase
      .from("device_pairing_requests")
      .insert({
        user_id: params.userId,
        wallet_address: normalizeWalletAddress(params.walletAddress),
        chain_id: params.chainId,
        pairing_secret_hash: secretHash,
        status: "created",
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to create pairing request: ${error?.message ?? "Unknown error"}`);
    }

    const request = data as DevicePairingRequest;
    const deepLink = `trezo://pair-device?requestId=${encodeURIComponent(request.id)}&secret=${encodeURIComponent(secret)}`;

    return { request, secret, deepLink };
  }

  static parsePairingDeepLink(url: string): PairingDeepLinkParams | null {
    try {
      const parsed = new URL(url);
      const hostPath = `${parsed.host}${parsed.pathname}`.replace(/^\/+/, "");
      if (hostPath !== "pair-device") return null;

      const requestId = parsed.searchParams.get("requestId");
      const secret = parsed.searchParams.get("secret");
      if (!requestId || !secret) return null;

      return { requestId, secret };
    } catch {
      return null;
    }
  }

  static async stashPendingDeepLink(params: PairingDeepLinkParams): Promise<void> {
    await AsyncStorage.setItem(PENDING_DEEPLINK_KEY, JSON.stringify(params));
  }

  static async getPendingDeepLink(): Promise<PairingDeepLinkParams | null> {
    const json = await AsyncStorage.getItem(PENDING_DEEPLINK_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json) as PairingDeepLinkParams;
    } catch {
      return null;
    }
  }

  static async consumePendingDeepLink(): Promise<PairingDeepLinkParams | null> {
    const parsed = await this.getPendingDeepLink();
    if (!parsed) return null;
    await AsyncStorage.removeItem(PENDING_DEEPLINK_KEY);
    return parsed;
  }

  static async getPairingRequestForUser(params: {
    requestId: string;
    secret: string;
    userId: string;
  }): Promise<DevicePairingRequest> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("device_pairing_requests")
      .select("*")
      .eq("id", params.requestId)
      .single();

    if (error || !data) {
      throw new Error("Pairing request not found");
    }

    const request = data as DevicePairingRequest;
    if (request.user_id !== params.userId) {
      throw new Error("This pairing request belongs to a different account");
    }

    const secretHash = await sha256(params.secret);
    if (secretHash !== request.pairing_secret_hash) {
      throw new Error("Invalid pairing secret");
    }

    if (isExpired(request.expires_at)) {
      await this.markExpired(request.id);
      throw new Error("Pairing request has expired");
    }

    return request;
  }

  static async submitNewDevicePasskey(params: {
    requestId: string;
    secret: string;
    userId: string;
    passkeyId: string;
    credentialId: string;
    publicKeyX: string;
    publicKeyY: string;
    deviceName?: string;
    platform?: string;
  }): Promise<DevicePairingRequest> {
    const request = await this.getPairingRequestForUser({
      requestId: params.requestId,
      secret: params.secret,
      userId: params.userId,
    });

    if (request.status !== "created" && request.status !== "passkey_submitted") {
      throw new Error(`Cannot submit passkey while request is ${request.status}`);
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("device_pairing_requests")
      .update({
        status: "passkey_submitted",
        new_passkey_id: normalizeHex(params.passkeyId),
        new_credential_id: params.credentialId,
        new_public_key_x: normalizeHex(params.publicKeyX),
        new_public_key_y: normalizeHex(params.publicKeyY),
        new_device_name: params.deviceName ?? request.new_device_name,
        new_device_platform: params.platform ?? request.new_device_platform,
      })
      .eq("id", request.id)
      .eq("user_id", request.user_id)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to submit passkey payload: ${error?.message ?? "Unknown error"}`);
    }

    return data as DevicePairingRequest;
  }

  static async listPendingApprovals(userId: string): Promise<DevicePairingRequest[]> {
    await this.pruneExpiredRequests(userId);
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("device_pairing_requests")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["created", "passkey_submitted"])
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load pairing requests: ${error.message}`);
    }

    const requests = (data ?? []) as DevicePairingRequest[];
    return requests;
  }

  static async ensureLocalDeviceSynced(params: {
    userId: string;
    walletAddress: string;
    chainId: number;
  }): Promise<void> {
    const localPasskey = await PasskeyService.getPasskey(params.userId);
    if (!localPasskey?.credentialIdRaw) {
      return;
    }

    const currentDeviceLabel = PasskeyService.getCurrentDeviceLabel();
    const normalizedWalletAddress = normalizeWalletAddress(params.walletAddress);
    const normalizedPasskeyId = normalizeHex(localPasskey.credentialIdRaw);
    const supabase = getSupabaseClient();

    try {
      const chainId = params.chainId as SupportedChainId;
      const walletAddress = normalizedWalletAddress as Address;
      const walletDeployed = await isContractDeployed(chainId, walletAddress);

      if (walletDeployed) {
        const onchainState = await getPasskeyOnchainState({
          chainId,
          smartAccountAddress: walletAddress,
          passkeyId: normalizedPasskeyId as `0x${string}`,
        });

        if (!onchainState.exists) {
          await supabase
            .from("wallet_devices")
            .delete()
            .eq("user_id", params.userId)
            .eq("wallet_address", normalizedWalletAddress)
            .eq("chain_id", params.chainId)
            .eq("passkey_id", normalizedPasskeyId);
          return;
        }

        const pendingRemoval =
          onchainState.executeAfter > 0n && !onchainState.cancelled;
        const status: DeviceStatus = pendingRemoval ? "pending_removal" : "active";
        const removalExecuteAfter = pendingRemoval
          ? toIsoFromUnixSeconds(onchainState.executeAfter)
          : null;

        const { error } = await supabase.from("wallet_devices").upsert(
          {
            user_id: params.userId,
            wallet_address: normalizedWalletAddress,
            chain_id: params.chainId,
            passkey_id: normalizedPasskeyId,
            credential_id: localPasskey.credentialId,
            device_name: currentDeviceLabel,
            platform: localPasskey.deviceType,
            status,
            added_at: localPasskey.createdAt ?? nowIso(),
            last_used_at: nowIso(),
            removed_at: null,
            removal_execute_after: removalExecuteAfter,
          },
          {
            onConflict: "wallet_address,chain_id,passkey_id",
          },
        );

        if (error) {
          throw new Error(`Failed to sync current device: ${error.message}`);
        }

        return;
      }
    } catch (error) {
      console.warn("[DevicePairing] Failed to verify local passkey on-chain before syncing device", error);
    }

    const { error } = await supabase.from("wallet_devices").upsert(
      {
        user_id: params.userId,
        wallet_address: normalizedWalletAddress,
        chain_id: params.chainId,
        passkey_id: normalizedPasskeyId,
        credential_id: localPasskey.credentialId,
        device_name: currentDeviceLabel,
        platform: localPasskey.deviceType,
        status: "active",
        added_at: localPasskey.createdAt ?? nowIso(),
        last_used_at: nowIso(),
        removed_at: null,
        removal_execute_after: null,
      },
      {
        onConflict: "wallet_address,chain_id,passkey_id",
      },
    );

    if (error) {
      throw new Error(`Failed to sync current device: ${error.message}`);
    }
  }

  static async getPairingRequestById(requestId: string, userId: string): Promise<DevicePairingRequest> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("device_pairing_requests")
      .select("*")
      .eq("id", requestId)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw new Error("Pairing request not found");
    }

    return data as DevicePairingRequest;
  }

  static async markRejected(requestId: string, userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("device_pairing_requests")
      .update({
        status: "rejected",
        rejected_at: nowIso(),
      })
      .eq("id", requestId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to reject pairing request: ${error.message}`);
    }
  }

  static async markFailed(requestId: string, userId: string, reason: string, operationHash?: string): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("device_pairing_requests")
      .update({
        status: "failed",
        error: reason,
        operation_hash: operationHash ?? null,
      })
      .eq("id", requestId)
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Failed to mark request as failed: ${error.message}`);
    }
  }

  static async markApprovedAfterReceipt(params: {
    requestId: string;
    userId: string;
    operationHash: string;
    walletAddress: string;
    chainId: number;
    passkeyId: string;
    credentialId?: string | null;
    deviceName?: string | null;
    platform?: string | null;
  }): Promise<void> {
    const supabase = getSupabaseClient();

    const { error: updateError } = await supabase
      .from("device_pairing_requests")
      .update({
        status: "approved",
        approved_at: nowIso(),
        operation_hash: params.operationHash,
        error: null,
      })
      .eq("id", params.requestId)
      .eq("user_id", params.userId);

    if (updateError) {
      throw new Error(`Failed to mark request as approved: ${updateError.message}`);
    }

    const { error: deviceError } = await supabase
      .from("wallet_devices")
      .upsert(
        {
          user_id: params.userId,
          wallet_address: normalizeWalletAddress(params.walletAddress),
          chain_id: params.chainId,
          passkey_id: normalizeHex(params.passkeyId),
          credential_id: params.credentialId ?? null,
          device_name: params.deviceName ?? null,
          platform: params.platform ?? null,
          status: "active",
          added_at: nowIso(),
          removed_at: null,
          removal_execute_after: null,
          last_used_at: nowIso(),
        },
        {
          onConflict: "wallet_address,chain_id,passkey_id",
        },
      );

    if (deviceError) {
      throw new Error(`Failed to upsert wallet device: ${deviceError.message}`);
    }
  }

  static async syncDeviceRemovalState(params: {
    userId: string;
    walletAddress: string;
    chainId: number;
    passkeyId: string;
    status: DeviceStatus;
    removalExecuteAfter?: string | null;
  }): Promise<void> {
    const supabase = getSupabaseClient();
    const payload: Record<string, string | null> = {
      status: params.status,
      removal_execute_after: params.removalExecuteAfter ?? null,
    };

    if (params.status === "active") {
      payload.removed_at = null;
      payload.last_used_at = nowIso();
    }
    if (params.status === "pending_removal") {
      payload.removed_at = null;
      payload.last_used_at = nowIso();
    }
    if (params.status === "removed") {
      payload.removed_at = nowIso();
      payload.last_used_at = nowIso();
    }

    const { error } = await supabase
      .from("wallet_devices")
      .update(payload)
      .eq("user_id", params.userId)
      .eq("wallet_address", normalizeWalletAddress(params.walletAddress))
      .eq("chain_id", params.chainId)
      .eq("passkey_id", normalizeHex(params.passkeyId));

    if (error) {
      throw new Error(`Failed syncing wallet device status: ${error.message}`);
    }
  }

  static async listWalletDevices(params: {
    userId: string;
    walletAddress: string;
    chainId: number;
  }): Promise<WalletDevice[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("wallet_devices")
      .select("*")
      .eq("user_id", params.userId)
      .eq("wallet_address", normalizeWalletAddress(params.walletAddress))
      .eq("chain_id", params.chainId)
      .order("added_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to load wallet devices: ${error.message}`);
    }

    return (data ?? []) as WalletDevice[];
  }

  static async syncWalletDevicesFromChain(params: {
    userId: string;
    walletAddress: string;
    chainId: number;
  }): Promise<WalletDevice[]> {
    const normalizedWalletAddress = normalizeWalletAddress(params.walletAddress);
    const devices = await this.listWalletDevices({
      ...params,
      walletAddress: normalizedWalletAddress,
    });

    if (devices.length === 0) {
      return devices;
    }

    const chainId = params.chainId as SupportedChainId;
    let isWalletDeployedOnChain = true;
    try {
      isWalletDeployedOnChain = await isContractDeployed(
        chainId,
        normalizedWalletAddress as Address,
      );
    } catch (error) {
      console.warn("[DevicePairing] Failed to verify wallet deployment before syncing devices", error);
      return devices;
    }

    if (!isWalletDeployedOnChain) {
      return devices;
    }

    const syncedDevices = await Promise.all(
      devices.map(async (device) => {
        try {
          const onchainState = await getPasskeyOnchainState({
            chainId,
            smartAccountAddress: normalizedWalletAddress as Address,
            passkeyId: normalizeHex(device.passkey_id) as `0x${string}`,
          });

          let status: DeviceStatus = "removed";
          let removalExecuteAfter: string | null = null;

          if (onchainState.exists) {
            const pendingRemoval =
              onchainState.executeAfter > 0n && !onchainState.cancelled;
            status = pendingRemoval ? "pending_removal" : "active";
            removalExecuteAfter = pendingRemoval
              ? toIsoFromUnixSeconds(onchainState.executeAfter)
              : null;
          }

          if (
            status !== device.status ||
            (removalExecuteAfter ?? null) !== (device.removal_execute_after ?? null)
          ) {
            await this.syncDeviceRemovalState({
              userId: params.userId,
              walletAddress: normalizedWalletAddress,
              chainId: params.chainId,
              passkeyId: device.passkey_id,
              status,
              removalExecuteAfter,
            });

            return {
              ...device,
              status,
              removal_execute_after: removalExecuteAfter,
              removed_at: status === "removed" ? nowIso() : null,
            };
          }

          return device;
        } catch (error) {
          console.warn(
            `[DevicePairing] Failed to sync passkey ${device.passkey_id} from chain`,
            error,
          );
          return device;
        }
      }),
    );

    return syncedDevices;
  }

  private static async markExpired(requestId: string): Promise<void> {
    const supabase = getSupabaseClient();
    await supabase
      .from("device_pairing_requests")
      .update({ status: "expired" })
      .eq("id", requestId)
      .in("status", ["created", "passkey_submitted"]);
  }

  private static async pruneExpiredRequests(userId: string): Promise<void> {
    const supabase = getSupabaseClient();
    const now = nowIso();

    await supabase
      .from("device_pairing_requests")
      .update({ status: "expired" })
      .eq("user_id", userId)
      .in("status", ["created", "passkey_submitted"])
      .lte("expires_at", now);

    await supabase
      .from("device_pairing_requests")
      .delete()
      .eq("user_id", userId)
      .eq("status", "expired")
      .lte("expires_at", now);
  }
}

export default DevicePairingService;
