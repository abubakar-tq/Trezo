import { supabase } from "../auth/supabaseClient";

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

const normalizeHex = (value: string) => (value.startsWith("0x") ? value : `0x${value}`);

const isExpired = (expiresAt: string) => new Date(expiresAt).getTime() <= Date.now();

const sha256 = async (input: string): Promise<string> => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

export class DevicePairingService {
  static async getPairingRequestForUser(params: {
    requestId: string;
    secret: string;
    userId: string;
  }): Promise<DevicePairingRequest> {
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

  static async pollUntilApproved(params: {
    requestId: string;
    secret: string;
    userId: string;
    timeoutMs?: number;
  }): Promise<DevicePairingRequest> {
    const deadline = Date.now() + (params.timeoutMs ?? 180_000);
    while (Date.now() < deadline) {
      const req = await this.getPairingRequestForUser(params);
      if (req.status === "approved") return req;
      if (["rejected", "expired", "failed"].includes(req.status)) throw new Error(`Pairing ${req.status}`);
      await new Promise((r) => setTimeout(r, 4000));
    }
    throw new Error("Pairing timed out waiting for approval");
  }

  private static async markExpired(requestId: string): Promise<void> {
    await supabase
      .from("device_pairing_requests")
      .update({ status: "expired" })
      .eq("id", requestId)
      .in("status", ["created", "passkey_submitted"]);
  }
}

export default DevicePairingService;
