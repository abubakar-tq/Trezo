import { encodeAbiParameters, parseAbiParameters } from "viem";

const P256_N = 0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const P256_HALF_N = P256_N / 2n;

export interface PasskeySignature {
  passkeyId: string; authenticatorData: string; clientDataJSON: string;
  challengeIndex: number; typeIndex: number; r: string; s: string;
}

// ---- byte helpers ----
export const bufToBase64Url = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
};
const base64UrlToBytes = (b64url: string): Uint8Array => {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const bytesToHex = (b: Uint8Array): string =>
  "0x" + Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

// ---- DER signature parse with low-s (verbatim logic from PasskeyService.parseDERSignature) ----
function parseDERSignature(der: Uint8Array): { r: string; s: string } {
  if (der[0] !== 0x30) throw new Error("Invalid DER: missing sequence");
  let off = 2;
  if (der[off] !== 0x02) throw new Error("Invalid DER: missing r");
  off++;
  const rLen = der[off]; off++;
  let r = der.slice(off, off + rLen); off += rLen;
  if (r[0] === 0x00 && r.length === 33) r = r.slice(1);
  if (der[off] !== 0x02) throw new Error("Invalid DER: missing s");
  off++;
  const sLen = der[off]; off++;
  let s = der.slice(off, off + sLen);
  if (s[0] === 0x00 && s.length === 33) s = s.slice(1);
  const rPad = new Uint8Array(32); rPad.set(r, 32 - r.length);
  const sPad = new Uint8Array(32); sPad.set(s, 32 - s.length);
  let sBig = BigInt(bytesToHex(sPad));
  if (sBig > P256_HALF_N) sBig = P256_N - sBig; // normalize to low-s
  return { r: bytesToHex(rPad), s: `0x${sBig.toString(16).padStart(64, "0")}` };
}

// credentialId (base64url) -> bytes32 (right zero-padded)
export const credentialIdToBytes32 = (credentialId: string): string => {
  const decoded = base64UrlToBytes(credentialId);
  const padded = new Uint8Array(32);
  padded.set(decoded.slice(0, Math.min(decoded.length, 32)));
  return bytesToHex(padded);
};

// Browser AuthenticatorAssertionResponse -> contract signature
export function parseWebAuthnAssertion(
  resp: AuthenticatorAssertionResponse,
  passkeyIdRaw: string,
): PasskeySignature {
  const authenticatorData = bytesToHex(new Uint8Array(resp.authenticatorData));
  const clientDataJSON = new TextDecoder().decode(resp.clientDataJSON);
  const challengeIndex = clientDataJSON.indexOf('"challenge"');
  const typeIndex = clientDataJSON.indexOf('"type"');
  const { r, s } = parseDERSignature(new Uint8Array(resp.signature));
  return { passkeyId: passkeyIdRaw, authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s };
}

export function encodeSignatureForContract(sig: PasskeySignature): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters("bytes32, bytes, string, uint256, uint256, uint256, uint256"),
    [
      sig.passkeyId as `0x${string}`,
      sig.authenticatorData as `0x${string}`,
      sig.clientDataJSON,
      BigInt(sig.challengeIndex),
      BigInt(sig.typeIndex),
      BigInt(sig.r),
      BigInt(sig.s),
    ],
  ) as `0x${string}`;
}

// COSE/SPKI public-key parse (port of normalizePublicKey/parseSpkiOrRaw from PasskeyService).
export function extractP256PublicKey(spkiOrRaw: ArrayBuffer): { x: string; y: string } {
  const k = new Uint8Array(spkiOrRaw);
  if (k.length === 65 && k[0] === 0x04) return { x: bytesToHex(k.slice(1, 33)), y: bytesToHex(k.slice(33, 65)) };
  if (k.length === 64) return { x: bytesToHex(k.slice(0, 32)), y: bytesToHex(k.slice(32, 64)) };
  if (k.length > 70 && k[0] === 0x30) {
    for (let i = 0; i < k.length; i++) {
      if (k[i] === 0x04 && i + 65 <= k.length) {
        const p = k.slice(i + 1, i + 65);
        return { x: bytesToHex(p.slice(0, 32)), y: bytesToHex(p.slice(32, 64)) };
      }
    }
  }
  throw new Error("Unsupported public key format");
}
