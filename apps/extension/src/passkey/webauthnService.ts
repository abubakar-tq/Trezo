import { SHARED_CONFIG } from "../core/config";
import { bufToBase64Url, credentialIdToBytes32, extractP256PublicKey, parseWebAuthnAssertion, encodeSignatureForContract, type PasskeySignature } from "./encode";

export interface PasskeyMetadata {
  credentialId: string; credentialIdRaw: string;
  publicKeyX: string; publicKeyY: string; rpId: string;
  deviceName: string; deviceType: "extension"; createdAt: string;
}

const STORAGE_KEY = "trezo_passkey_v1";

const utf8ToBytes = (s: string) => new TextEncoder().encode(s);
const hexToBytes = (hex: string) => {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
};
const randomChallenge = () => crypto.getRandomValues(new Uint8Array(32));

export const WebAuthnService = {
  async getStored(): Promise<PasskeyMetadata | null> {
    const out = await chrome.storage.local.get(STORAGE_KEY);
    return (out[STORAGE_KEY] as PasskeyMetadata) ?? null;
  },

  async create(userId: string): Promise<PasskeyMetadata> {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: "Trezo Wallet", id: SHARED_CONFIG.rpId },
        user: { id: utf8ToBytes(userId), name: userId, displayName: `Trezo ${userId.slice(0, 8)}` },
        pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256 / P-256
        timeout: 60_000,
        attestation: "none",
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          residentKey: "preferred",
          userVerification: "required",
        },
      },
    })) as PublicKeyCredential;

    const att = cred.response as AuthenticatorAttestationResponse;
    const pub = att.getPublicKey();
    if (!pub) throw new Error("Authenticator did not return a public key");
    const { x, y } = extractP256PublicKey(pub);
    const credentialId = bufToBase64Url(cred.rawId);
    const meta: PasskeyMetadata = {
      credentialId,
      credentialIdRaw: credentialIdToBytes32(credentialId),
      publicKeyX: x, publicKeyY: y,
      rpId: SHARED_CONFIG.rpId,
      deviceName: "Chrome Extension",
      deviceType: "extension",
      createdAt: new Date().toISOString(),
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: meta });
    return meta;
  },

  async getOrCreate(userId: string): Promise<PasskeyMetadata> {
    const existing = await this.getStored();
    if (existing) return existing;
    return this.create(userId);
  },

  async sign(challengeHex: string): Promise<PasskeySignature> {
    const meta = await this.getStored();
    if (!meta) throw new Error("No passkey on this device. Pair the extension first.");
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: hexToBytes(challengeHex),
        rpId: meta.rpId,
        timeout: 60_000,
        userVerification: "required",
        allowCredentials: [{ type: "public-key", id: base64UrlToRaw(meta.credentialId).buffer as ArrayBuffer }],
      },
    })) as PublicKeyCredential;
    const resp = assertion.response as AuthenticatorAssertionResponse;
    return parseWebAuthnAssertion(resp, meta.credentialIdRaw);
  },

  async clear(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY);
  },

  encodeForContract: encodeSignatureForContract,
};

function base64UrlToRaw(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
