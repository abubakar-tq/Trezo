/**
 * Real WebAuthn Passkey Service
 * 
 * Implements FIDO2/WebAuthn standard passkeys for ERC-4337 AA wallet
 * - Private keys stored in device secure enclave (never exposed)
 * - Public metadata stored in AsyncStorage (searchable)
 * - P-256 signatures compatible with PasskeyValidator.sol contract
 * 
 * Contract Requirements (PasskeyValidator.sol):
 * - bytes32 passkeyId (credential ID)
 * - uint256 px, py (P-256 public key coordinates)
 * - Signature: (authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { encodeAbiParameters, parseAbiParameters, toBytes } from 'viem';
import type { Address } from 'viem';
import { getDeployment, getPublicClient } from '@/src/integration/viem';
import { ABIS } from '@/src/integration/viem/abis';
import type { SupportedChainId } from '@/src/integration/chains';
// Conditionally import passkeys only if available and not in Expo Go
let Passkey: any = null;

const debugLog = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};

// Check if we're in Expo Go - if so, skip passkeys entirely
const isExpoGo = Constants?.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    Passkey = require('react-native-passkeys');
  } catch (e) {
    console.warn('react-native-passkeys not available, using fallback authentication');
  }
} else {
  debugLog('Running in Expo Go, using biometric authentication only');
}

const PASSKEY_STORAGE_KEY = 'trezo_passkey_'; // One passkey per device
const RP_NAME = (Constants?.expoConfig?.extra as any)?.passkeyRpName || 'Trezo Wallet';
const CONFIGURED_RP_ID = (Constants?.expoConfig?.extra as any)?.passkeyRpId || 'abubakar-tq.github.io';
const P256_N =
  0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551n;
const P256_HALF_N = P256_N / 2n;

/**
 * Get the Relying Party ID (RP_ID)
 *
 * - RP ID must be a real web domain (no localhost/package names)
 * - Domain must host:
 *   - /.well-known/assetlinks.json (Android)
 *   - /.well-known/apple-app-site-association (iOS)
 * - Configure via EXPO_PUBLIC_PASSKEY_RP_ID (default: abubakar-tq.github.io)
 */
function getRpId(): string {
  const rpId = String(CONFIGURED_RP_ID).trim().toLowerCase();

  // Android/iOS require a real domain that is linked via Digital Asset Links / AASA
  if (!rpId || rpId === 'localhost' || rpId === 'exp.host') {
    throw new Error(
      'Passkey RP ID is not configured. Set EXPO_PUBLIC_PASSKEY_RP_ID to a real domain (e.g. trezo.app) and ' +
      'host .well-known/assetlinks.json (Android) and apple-app-site-association (iOS) for that domain.'
    );
  }

  if (!rpId.includes('.')) {
    throw new Error('Invalid RP ID. It must be a domain such as trezo.app.');
  }

  return rpId;
}

const titleCaseWords = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const normalizeDeviceLabel = (value: string | null | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^unknown$/i.test(trimmed)) return null;
  if (/^generic$/i.test(trimmed)) return null;
  return trimmed;
};

const getCurrentDeviceName = () => {
  const namedByExpo = normalizeDeviceLabel(Constants.deviceName ?? null);
  if (namedByExpo) {
    return namedByExpo;
  }

  const constants = (Platform.constants ?? {}) as Record<string, unknown>;

  if (Platform.OS === 'android') {
    const brand = normalizeDeviceLabel(typeof constants.Brand === 'string' ? constants.Brand : null);
    const model = normalizeDeviceLabel(typeof constants.Model === 'string' ? constants.Model : null);
    if (brand && model) {
      return `${titleCaseWords(brand)} ${model}`;
    }
    if (model) {
      return model;
    }
    return 'Android Device';
  }

  if (Platform.OS === 'ios') {
    const model = normalizeDeviceLabel(typeof constants.model === 'string' ? constants.model : null);
    if (model) {
      return model;
    }

    const interfaceIdiom = typeof constants.interfaceIdiom === 'string' ? constants.interfaceIdiom : null;
    if (interfaceIdiom === 'pad') {
      return 'iPad';
    }
    return 'iPhone';
  }

  return 'Mobile Device';
};
/**
 * Public passkey metadata stored in AsyncStorage
 * ONE passkey per device - stored in secure enclave
 * If device loses passkey, user creates new one (replaces old)
 */
export interface PasskeyMetadata {
  credentialId: string;       // WebAuthn credential ID (base64url)
  credentialIdRaw: string;    // Raw bytes32 for contract (hex)
  publicKeyX: string;         // P-256 public key X coordinate (hex)
  publicKeyY: string;         // P-256 public key Y coordinate (hex)
  rpId: string;               // Relying party ID (e.g., "trezo.app")
  deviceName: string;         // Device identifier
  deviceType: 'ios' | 'android';
  createdAt: string;          // ISO timestamp
}

/**
 * WebAuthn signature format for PasskeyValidator.sol
 */
export interface PasskeySignature {
  passkeyId: string;          // bytes32
  authenticatorData: string;  // bytes
  clientDataJSON: string;     // string
  challengeIndex: number;     // uint256
  typeIndex: number;          // uint256
  r: string;                  // uint256 (signature r)
  s: string;                  // uint256 (signature s)
}

export interface BiometricCapabilities {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: string[];
}

export class PasskeyService {
  static getCurrentDeviceLabel(): string {
    return getCurrentDeviceName();
  }
  
  // ==================== BASE64 UTILITIES ====================
  
  /**
   * Convert base64 to Uint8Array
   */
  private static base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
  
  /**
   * Convert base64url to Uint8Array
   */
  private static base64UrlToUint8Array(base64url: string): Uint8Array {
    if (typeof base64url !== 'string') {
      throw new Error(`Expected base64url string, received ${typeof base64url}`);
    }
    // Convert base64url to base64
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    return this.base64ToUint8Array(base64 + padding);
  }
  
  /**
   * Convert Uint8Array to hex string
   */
  private static uint8ArrayToHex(bytes: Uint8Array): string {
    return '0x' + Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
  
  /**
   * Convert Uint8Array to base64
   */
  private static uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  /**
   * Convert string to Uint8Array (UTF-8)
   */
  private static stringToUint8Array(str: string): Uint8Array {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }
  
  /**
   * Check if two Uint8Arrays are equal
   */
  private static uint8ArrayEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private static hexToUint8Array(value: string): Uint8Array {
    const normalized = value.startsWith('0x') ? value.slice(2) : value;
    const padded = normalized.length % 2 === 0 ? normalized : `0${normalized}`;
    const bytes = new Uint8Array(padded.length / 2);

    for (let i = 0; i < padded.length; i += 2) {
      bytes[i / 2] = parseInt(padded.slice(i, i + 2), 16);
    }

    return bytes;
  }

  private static leftPadTo32Bytes(value: Uint8Array): Uint8Array {
    if (value.length === 32) return value;
    if (value.length > 32) {
      return value.slice(value.length - 32);
    }

    const padded = new Uint8Array(32);
    padded.set(value, 32 - value.length);
    return padded;
  }

  private static coordinateStringToUint8Array(value: string): Uint8Array {
    const normalized = value.trim();
    if (normalized.startsWith('0x') || /^[0-9a-fA-F]+$/.test(normalized)) {
      return this.hexToUint8Array(normalized);
    }
    return this.base64UrlToUint8Array(normalized);
  }

  // ==================== PUBLIC API ====================
  
  /**
   * Check if device supports passkeys
   * 
   * Android (Pixel 7): Supports passkeys with fingerprint, face unlock, or PIN
   * iOS: Supports passkeys with Face ID or Touch ID
   * 
   * Note: This will work on Android Studio emulator/device if:
   * - Device has biometric authentication enrolled (Settings > Security > Fingerprint)
   * - App is NOT running in Expo Go (use development build or standalone build)
   */
  static async checkBiometricCapabilities(): Promise<BiometricCapabilities> {
    try {
      debugLog('🔐 [PasskeyService] Checking passkey support...');
      debugLog('📱 [PasskeyService] Platform:', Platform.OS);

      // Check for passkeys first (development builds)
      let isSupported = false;
      if (Passkey) {
        try {
          isSupported = await Passkey.isSupported();
          debugLog('🔐 [PasskeyService] Device passkey support:', isSupported);
        } catch (e) {
          console.warn('Passkey support check failed:', e);
        }
      }

      // Fallback to biometric authentication (Expo Go)
      if (!isSupported) {
        try {
          const hasHardware = await LocalAuthentication.hasHardwareAsync();
          const isEnrolled = await LocalAuthentication.isEnrolledAsync();
          isSupported = hasHardware && isEnrolled;
          debugLog('🔐 [PasskeyService] Fallback biometric support:', isSupported);
        } catch (e) {
          console.warn('Biometric support check failed:', e);
        }
      }

      // Determine supported authentication types based on platform
      let supportedTypes: string[] = [];
      if (isSupported) {
        if (Platform.OS === 'android') {
          supportedTypes = Passkey ? ['Passkey (Fingerprint/Face/PIN)'] : ['Biometric (Fingerprint/Face/PIN)'];
        } else if (Platform.OS === 'ios') {
          supportedTypes = Passkey ? ['Passkey (Face ID/Touch ID)'] : ['Biometric (Face ID/Touch ID)'];
        } else {
          supportedTypes = Passkey ? ['Passkey'] : ['Biometric'];
        }
      }

      return {
        hasHardware: isSupported,
        isEnrolled: isSupported, // WebAuthn handles enrollment internally
        supportedTypes,
      };
    } catch (error) {
      console.error('❌ [PasskeyService] Error checking capabilities:', error);
      console.error('❌ [PasskeyService] Error details:', error instanceof Error ? error.message : String(error));
      
      return {
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
      };
    }
  }
  
  /**
   * Create a REAL WebAuthn passkey (stored in secure enclave).
   * Returns public metadata only - private key never leaves device.
   *
   * The smart-account address is derived from this passkey's public key, so
   * creating a new passkey CHANGES the wallet address and orphans any wallet
   * bound to the previous passkey. Therefore this method REFUSES to overwrite
   * an existing passkey unless `options.allowReplace` is explicitly set.
   *
   * - Deploy / address-prediction paths must use {@link getOrCreatePasskey},
   *   which reuses the stored passkey and keeps the address stable.
   * - Recovery / add-device / pairing flows that intentionally bind a NEW
   *   passkey pass `{ allowReplace: true }`.
   */
  static async createPasskey(
    userId: string,
    options?: { allowReplace?: boolean },
  ): Promise<PasskeyMetadata> {
    debugLog('🔐 [PasskeyService] Creating WebAuthn passkey for user:', userId);
    debugLog('📱 [PasskeyService] Platform:', Platform.OS);
    debugLog('📱 [PasskeyService] __DEV__:', __DEV__);

    // The AA address depends on the passkey public key. Silently overwriting an
    // existing passkey would change the derived address and strand the wallet it
    // was deployed under, so refuse unless the caller opts in explicitly.
    const existingPasskey = await this.getPasskey(userId);
    if (existingPasskey && !options?.allowReplace) {
      throw new Error(
        'A passkey already exists on this device. Creating a new one would change ' +
          'the smart-account address and orphan the existing wallet. Use ' +
          'PasskeyService.getOrCreatePasskey() to reuse it, or call with ' +
          '{ allowReplace: true } to intentionally rotate (recovery / add-device).',
      );
    }
    if (existingPasskey) {
      debugLog('⚠️ [PasskeyService] Replacing existing passkey on this device (allowReplace=true)');
    }
    
    // 1. Verify passkey support — biometric-only fallback is NOT acceptable
    //    because it cannot produce contract-valid P-256 signatures, which
    //    would silently brick the smart account.
    if (!Passkey) {
      throw new Error(
        'Passkeys are not available in this build. Use a development build or release APK — not Expo Go.',
      );
    }

    let isSupported = false;
    try {
      isSupported = await Passkey.isSupported();
      debugLog('✅ [PasskeyService] Passkey support verified');
    } catch (e) {
      console.warn('Passkey support check failed:', e);
    }

    if (!isSupported) {
      throw new Error('Passkeys are not supported on this device.');
    }
    
    // 2. Generate challenge (in production, get from server)
    const challenge = this.generateChallenge();
    
    // 3. Get RP ID for this platform
    const rpId = getRpId();
    
    // 4. Create passkey registration options
    // Encode user ID properly: string -> UTF-8 bytes -> base64url
    const userIdBytes = this.stringToUint8Array(userId);
    const userIdBase64 = this.uint8ArrayToBase64(userIdBytes);
    const userIdBase64Url = this.base64UrlEncode(userIdBase64);
    
    const registrationOptions: any = {
      challenge: challenge,
      rp: {
        name: RP_NAME,
        id: rpId, // Now using the configured RP ID with assetlinks.json
      },
      user: {
        id: userIdBase64Url,
        name: userId,
        displayName: `Trezo User ${userId.slice(0, 8)}`,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' as const }, // ES256 (P-256) - REQUIRED for PasskeyValidator
      ],
      timeout: 60000,
      attestation: 'none' as const,
      authenticatorSelection: {
        authenticatorAttachment: 'platform' as const,
        requireResidentKey: false, // Changed to false - allows local-only passkeys without Google account
        residentKey: 'preferred' as const, // Prefer resident key if available, but don't require it
        userVerification: 'required' as const,
      },
    };
    
    debugLog('📝 [PasskeyService] Registration options:', {
      rpId,
      platform: Platform.OS,
      userId: userId.slice(0, 8),
      userIdEncoded: userIdBase64Url.slice(0, 20) + '...',
      challenge: challenge.slice(0, 20) + '...',
    });
    
    debugLog('🔍 [PasskeyService] Full registration options:', JSON.stringify({
      challenge: challenge.slice(0, 50),
      rp: registrationOptions.rp,
      user: { ...registrationOptions.user, id: registrationOptions.user.id.slice(0, 30) + '...' },
      pubKeyCredParams: registrationOptions.pubKeyCredParams,
      authenticatorSelection: registrationOptions.authenticatorSelection,
    }, null, 2));
    
    // 5. Create passkey via WebAuthn — must succeed; no fallback path exists
    //    because only a real P-256 keypair can sign for PasskeyValidator.sol.
    let result;
    try {
      debugLog('🔐 [PasskeyService] Attempting to create passkey...');
      result = await Passkey.create(registrationOptions);
      debugLog('✅ [PasskeyService] Passkey created in secure enclave');
    } catch (passkeyError: any) {
      const message = passkeyError?.message ?? String(passkeyError);
      console.error('❌ [PasskeyService] Passkey creation failed:', passkeyError);
      // "folsom activity" appears on Samsung devices when Samsung Pass is the
      // default credential provider and fails internally. Surface the hint.
      if (Platform.OS === 'android' && /folsom|NotAllowedError/i.test(message)) {
        throw new Error(
          'Passkey creation failed. On Samsung devices, open Settings → General management → ' +
            'Passwords, passkeys and autofill services → Preferred service, and set it to Google. ' +
            `Underlying error: ${message}`,
        );
      }
      throw new Error(`Passkey creation failed: ${message}`);
    }

    if (!result) {
      throw new Error('Passkey creation returned null result');
    }

    // 6. Extract public key from attestation response
    const publicKey = this.extractPublicKey(result.response);

    // 7. Convert credential ID to bytes32
    const credentialIdRaw = this.credentialIdToBytes32(result.id);

    // 8. Create metadata (PUBLIC DATA ONLY)
    const metadata: PasskeyMetadata = {
      credentialId: result.id,
      credentialIdRaw,
      publicKeyX: publicKey.x,
      publicKeyY: publicKey.y,
      rpId,
      deviceName: this.getCurrentDeviceLabel(),
      deviceType: Platform.OS as 'ios' | 'android',
      createdAt: new Date().toISOString(),
    };

    // 9. Save metadata to AsyncStorage (replaces old passkey if exists)
    await this.savePasskey(userId, metadata);

    debugLog('💾 [PasskeyService] Passkey metadata saved to AsyncStorage');
    debugLog('🔑 [PasskeyService] Public Key X:', publicKey.x.slice(0, 20) + '...');
    debugLog('🔑 [PasskeyService] Public Key Y:', publicKey.y.slice(0, 20) + '...');

    return metadata;
  }
  
  /**
   * Return this device's existing passkey, or create one if none is stored.
   *
   * This is the ONLY safe accessor for deploy / address-prediction paths. The
   * AA address is derived from the passkey public key, so reusing the stored
   * passkey keeps the counterfactual address stable across chains and across
   * deploy retries. It NEVER overwrites an existing passkey.
   */
  static async getOrCreatePasskey(userId: string): Promise<PasskeyMetadata> {
    const existing = await this.getPasskey(userId);
    if (existing) {
      debugLog('🔁 [PasskeyService] Reusing existing passkey (address-stable)');
      return existing;
    }
    debugLog('🆕 [PasskeyService] No passkey on device — creating first one');
    return this.createPasskey(userId);
  }

  /**
   * Sign a UserOperation hash with passkey (triggers biometric authentication)
   * Returns WebAuthn signature in contract-compatible format
   */
  static async signWithPasskey(
    userId: string,
    userOpHash: string,
    opts?: { smartAccountAddress?: Address; chainId?: SupportedChainId },
  ): Promise<PasskeySignature> {
    debugLog('✍️ [PasskeyService] Signing with passkey');
    debugLog('📝 [PasskeyService] UserOp hash:', userOpHash);
    
    // 1. Get passkey for this device
    const passkey = await this.getPasskey(userId);
    if (!passkey) {
      throw new Error('No passkey found on this device. Please create a passkey first.');
    }
    
    debugLog('🔑 [PasskeyService] Using passkey:', passkey.credentialId);
    
    // 2. Prepare authentication challenge (userOpHash as base64url)
    const challengeBytes = toBytes(userOpHash as `0x${string}`);
    const challenge = this.base64UrlEncode(this.uint8ArrayToBase64(challengeBytes));
    
    // 3. RP ID MUST equal the rpId the credential was registered under.
    const rpId = passkey.rpId || getRpId();

    // 4. Restrict the picker to the wallet's ON-CHAIN registered credential(s)
    //    when we know the wallet + chain. A wallet's RP can accumulate several
    //    passkeys on a device (re-provisioning, multiple accounts); listing them
    //    all forces the user to guess which can sign. Feeding the registered ids
    //    as allowCredentials makes Android surface only keys that actually sign
    //    for THIS wallet. If we can't read them (not deployed / RPC error) we
    //    fall back to the discoverable flow (no allowCredentials).
    let allowCredentials: Array<{ id: string; type: 'public-key' }> | undefined;
    if (opts?.smartAccountAddress && opts?.chainId) {
      try {
        const registered = await this.getRegisteredCredentialIds(opts.chainId, opts.smartAccountAddress);
        if (registered.length > 0) {
          allowCredentials = registered.map((id) => ({ id, type: 'public-key' as const }));
          debugLog(`🔐 [PasskeyService] Restricting picker to ${registered.length} registered passkey(s):`, registered);
        }
      } catch (e) {
        debugLog('⚠️ [PasskeyService] Could not read on-chain passkeys:', String(e));
      }
    }

    // Fallback: restrict to THIS wallet's own stored passkey so the OS shows only
    // it — never the full list of every passkey on the device. Covers deploy /
    // pre-registration signing (no on-chain passkeys yet) and single-passkey wallets.
    if (!allowCredentials) {
      allowCredentials = [{ id: passkey.credentialId, type: 'public-key' as const }];
      debugLog('🔐 [PasskeyService] Restricting picker to stored passkey:', passkey.credentialId);
    }

    // 5. Get authentication (triggers biometric). With allowCredentials the OS
    //    shows only the wallet's registered keys; otherwise the discoverable flow
    //    lists the device's platform passkeys.
    const authOptions: {
      challenge: string;
      rpId: string;
      timeout: number;
      userVerification: 'required';
      allowCredentials?: Array<{ id: string; type: 'public-key' }>;
    } = {
      challenge: challenge,
      rpId,
      timeout: 60000,
      userVerification: 'required' as const,
      ...(allowCredentials ? { allowCredentials } : {}),
    };

    // Authenticate via WebAuthn — no biometric fallback. A mock signature
    // cannot satisfy the on-chain PasskeyValidator, so we must fail loudly
    // and let the caller surface the real reason to the user.
    if (!Passkey) {
      throw new Error(
        'Passkeys are not available in this build. Use a development build or release APK — not Expo Go.',
      );
    }

    let authResult;
    try {
      debugLog('🔐 [PasskeyService] Attempting passkey authentication...');
      authResult = await Passkey.get(authOptions);
      debugLog('✅ [PasskeyService] Passkey authentication successful');
    } catch (passkeyError: any) {
      const message = passkeyError?.message ?? String(passkeyError);
      console.error('❌ [PasskeyService] Passkey authentication failed:', passkeyError);
      if (Platform.OS === 'android' && /folsom|NotAllowedError/i.test(message)) {
        throw new Error(
          'Passkey signing failed. On Samsung devices, open Settings → General management → ' +
            'Passwords, passkeys and autofill services → Preferred service, and set it to Google. ' +
            `Underlying error: ${message}`,
        );
      }
      throw new Error(`Passkey signing failed: ${message}`);
    }

    if (!authResult) {
      throw new Error('Authentication returned null result');
    }

    // Sign with WHICHEVER registered passkey the user actually authenticated with.
    // A wallet can have several on-chain passkeys (multi-device / recovery), so we
    // must bind the signature to the credential that ACTUALLY signed — not a single
    // hardcoded stored id. The on-chain PasskeyValidator looks the key up by this
    // passkeyId and is the source of truth: an unregistered credential is rejected
    // on submission. For a normal single-passkey wallet the returned id equals the
    // stored one, so behaviour is unchanged.
    const signingId = authResult.id ?? passkey.credentialId;
    const signingIdRaw = authResult.id
      ? this.credentialIdToBytes32(authResult.id)
      : passkey.credentialIdRaw;

    if (signingId !== passkey.credentialId) {
      debugLog(
        `⚠️ [PasskeyService] Signing with a different registered passkey than the locally stored ` +
          `one (returned ${String(signingId).slice(0, 12)}…, stored ${String(passkey.credentialId).slice(0, 12)}…). ` +
          `On-chain validator verifies the returned credential.`,
      );
    } else {
      debugLog('🔎 [PasskeyService] Signing credential matches stored id');
    }

    // 5. Extract signature components, binding passkeyId to the credential that signed.
    const signature = this.parseWebAuthnSignature(authResult.response, signingIdRaw);
    
    debugLog('✅ [PasskeyService] Signature created');
    debugLog('📝 [PasskeyService] Signature r:', signature.r.slice(0, 20) + '...');
    debugLog('📝 [PasskeyService] Signature s:', signature.s.slice(0, 20) + '...');
    
    return signature;
  }
  
  /**
   * Encode signature for PasskeyValidator.sol contract
   * Format: abi.encode(bytes32 passkeyId, bytes authenticatorData, string clientDataJSON, 
   *                    uint256 challengeIndex, uint256 typeIndex, uint256 r, uint256 s)
   */
  static encodeSignatureForContract(signature: PasskeySignature): string {
    const encoded = encodeAbiParameters(
      parseAbiParameters('bytes32, bytes, string, uint256, uint256, uint256, uint256'),
      [
        signature.passkeyId as `0x${string}`,
        signature.authenticatorData as `0x${string}`,
        signature.clientDataJSON,
        BigInt(signature.challengeIndex),
        BigInt(signature.typeIndex),
        BigInt(signature.r),
        BigInt(signature.s),
      ]
    );
    
    debugLog('📦 [PasskeyService] Encoded signature for contract:', encoded.slice(0, 50) + '...');
    return encoded;
  }
  
  /**
   * Get passkey for this device
   */
  static async getPasskey(userId: string): Promise<PasskeyMetadata | null> {
    const key = PASSKEY_STORAGE_KEY + userId;
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : null;
  }
  
  /**
   * Check if this device has a passkey
   */
  static async hasPasskey(userId: string): Promise<boolean> {
    const passkey = await this.getPasskey(userId);
    return passkey !== null;
  }
  
  /**
   * RESCUE: Overwrite the local AsyncStorage passkey metadata with values
   * known to match a passkey already registered on-chain. Used when the
   * local SecureStore got out-of-sync with the on-chain validator (e.g. an
   * aborted recovery flow created a new local passkey that's not registered).
   *
   * Caller is responsible for reading credentialIdRaw + px + py from the
   * on-chain PasskeyValidator and passing them in.
   *
   * NOTE: this does NOT re-create the WebAuthn private key on the device.
   * It assumes the original credential (matching credentialIdRaw) is still
   * in the device's WebAuthn keystore — which is true if the user hasn't
   * uninstalled the app or wiped the keystore. WebAuthn will find it on
   * the next signWithPasskey call.
   */
  static async restorePasskeyFromOnChainValues(params: {
    userId: string;
    credentialIdRaw: string; // 0x... 32-byte hex (right-padded with zeros if shorter)
    publicKeyX: string; // 0x... 32-byte hex
    publicKeyY: string; // 0x... 32-byte hex
    rpId: string;
  }): Promise<PasskeyMetadata> {
    // Trim trailing zero bytes from credentialIdRaw to recover the original
    // WebAuthn credential ID (typical iOS/Android is 16 bytes).
    const rawHex = params.credentialIdRaw.startsWith('0x')
      ? params.credentialIdRaw.slice(2)
      : params.credentialIdRaw;
    const rawBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      rawBytes[i] = parseInt(rawHex.slice(i * 2, i * 2 + 2), 16);
    }
    let realLength = 32;
    while (realLength > 0 && rawBytes[realLength - 1] === 0) realLength -= 1;
    if (realLength === 0) {
      throw new Error('credentialIdRaw is all zeros — cannot reconstruct credentialId.');
    }
    const trimmed = rawBytes.slice(0, realLength);
    const base64 = this.uint8ArrayToBase64(trimmed);
    const credentialId = this.base64UrlEncode(base64);

    const metadata: PasskeyMetadata = {
      credentialId,
      credentialIdRaw: params.credentialIdRaw.startsWith('0x')
        ? params.credentialIdRaw
        : `0x${params.credentialIdRaw}`,
      publicKeyX: params.publicKeyX.startsWith('0x')
        ? params.publicKeyX
        : `0x${params.publicKeyX}`,
      publicKeyY: params.publicKeyY.startsWith('0x')
        ? params.publicKeyY
        : `0x${params.publicKeyY}`,
      rpId: params.rpId,
      deviceName: this.getCurrentDeviceLabel(),
      deviceType: Platform.OS as 'ios' | 'android',
      createdAt: new Date().toISOString(),
    };

    await this.savePasskey(params.userId, metadata);
    debugLog('🚑 [PasskeyService] Restored passkey metadata from on-chain values', {
      credentialId,
      credentialIdRaw: metadata.credentialIdRaw,
    });
    return metadata;
  }

  /**
   * Delete passkey from this device
   * (removes from AsyncStorage, secure enclave cleanup is automatic)
   */
  static async deletePasskey(userId: string): Promise<void> {
    const key = PASSKEY_STORAGE_KEY + userId;
    await AsyncStorage.removeItem(key);
    
    debugLog('🗑️ [PasskeyService] Passkey deleted from this device');
  }
  
  /**
   * Get passkey data for contract deployment (onInstall format)
   * Returns: abi.encode(bytes32 passkeyId, uint256 px, uint256 py)
   */
  static async getPasskeyDataForDeployment(userId: string): Promise<string> {
    const passkey = await this.getPasskey(userId);
    if (!passkey) {
      throw new Error('No passkey found on this device. Please create a passkey first.');
    }
    
    const encoded = encodeAbiParameters(
      parseAbiParameters('bytes32, uint256, uint256'),
      [
        passkey.credentialIdRaw as `0x${string}`,
        BigInt(passkey.publicKeyX),
        BigInt(passkey.publicKeyY),
      ]
    );
    
    debugLog('📦 [PasskeyService] Encoded passkey data for deployment');
    return encoded;
  }

  // ==================== PRIVATE HELPER METHODS ====================
  
  /**
   * Save passkey metadata to AsyncStorage (replaces existing)
   */
  private static async savePasskey(userId: string, metadata: PasskeyMetadata): Promise<void> {
    const key = PASSKEY_STORAGE_KEY + userId;
    await AsyncStorage.setItem(key, JSON.stringify(metadata));
    
    debugLog('💾 [PasskeyService] Passkey saved for device');
  }
  
  /**
   * Extract P-256 public key from WebAuthn attestation response
   * The response contains a publicKey field with the COSE public key
   */
  private static extractPublicKey(response: any): { x: string; y: string } {
    debugLog('📝 [PasskeyService] Extracting public key from response...');
    debugLog('📝 [PasskeyService] Response keys:', Object.keys(response));
    
    try {
      const publicKeyValue = response.publicKey ?? response.getPublicKey?.();

      if (publicKeyValue) {
        debugLog('✅ [PasskeyService] Found publicKey in response');

        if (
          typeof publicKeyValue === 'object' &&
          typeof publicKeyValue.x === 'string' &&
          typeof publicKeyValue.y === 'string'
        ) {
          const xBytes = this.leftPadTo32Bytes(this.coordinateStringToUint8Array(publicKeyValue.x));
          const yBytes = this.leftPadTo32Bytes(this.coordinateStringToUint8Array(publicKeyValue.y));
          return {
            x: this.uint8ArrayToHex(xBytes),
            y: this.uint8ArrayToHex(yBytes),
          };
        }

        const publicKeyBytes =
          publicKeyValue instanceof Uint8Array
            ? publicKeyValue
            : publicKeyValue instanceof ArrayBuffer
              ? new Uint8Array(publicKeyValue)
              : this.base64UrlToUint8Array(publicKeyValue);
        debugLog('📝 [PasskeyService] Public key bytes length:', publicKeyBytes.length);
        
        const parsed = this.normalizePublicKey(publicKeyBytes);
        
        debugLog('✅ [PasskeyService] Extracted P-256 coordinates');
        debugLog('🔑 [PasskeyService] X:', parsed.x.slice(0, 20) + '...');
        debugLog('🔑 [PasskeyService] Y:', parsed.y.slice(0, 20) + '...');
        
        return parsed;
      }
      
      // Fallback: try to extract from attestationObject if available
      if (response.attestationObject) {
        debugLog('⚠️ [PasskeyService] No publicKey field, trying attestationObject');
        // This would require full CBOR parsing of attestationObject
        throw new Error('attestationObject parsing not implemented yet');
      }
      
      throw new Error('No public key found in response');
    } catch (error) {
      console.error('❌ [PasskeyService] Failed to extract public key:', error);
      debugLog('📝 [PasskeyService] Full response:', JSON.stringify(response, null, 2));
      throw new Error(`Failed to extract public key: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Parse COSE public key to extract P-256 coordinates
   * COSE format is CBOR-encoded, but for P-256 we can extract x and y
   */
  private static parseCOSEPublicKey(coseKey: Uint8Array): { x: string; y: string } {
    // Simple CBOR parser for COSE P-256 key
    // COSE P-256 key is typically 65-77 bytes
    // Contains: kty, alg, crv, x(32 bytes), y(32 bytes)

    debugLog('📝 [PasskeyService] Parsing COSE key, length:', coseKey.length);
    
    // Look for 32-byte sequences that are likely x and y coordinates
    // In COSE format, x and y are typically marked with specific CBOR tags
    // -2: x coordinate (32 bytes)
    // -3: y coordinate (32 bytes)
    
    let xCoord: Uint8Array | null = null;
    let yCoord: Uint8Array | null = null;
    
    // Scan for 32-byte chunks (x and y are 32 bytes each for P-256)
    for (let i = 0; i < coseKey.length - 32; i++) {
      // Look for CBOR byte string marker (0x58 0x20 = byte string of 32 bytes)
      if (coseKey[i] === 0x58 && coseKey[i + 1] === 0x20) {
        const chunk = coseKey.slice(i + 2, i + 34);
        if (!xCoord) {
          xCoord = chunk;
          debugLog('🔑 [PasskeyService] Found x coordinate at offset', i);
        } else if (!yCoord) {
          yCoord = chunk;
          debugLog('🔑 [PasskeyService] Found y coordinate at offset', i);
          break;
        }
      }
    }
    
    if (!xCoord || !yCoord) {
      // Fallback: if structured parsing fails, try to find two 32-byte sequences
      console.warn('⚠️ [PasskeyService] CBOR parsing failed, trying fallback extraction');
      
      // Look for any two distinct 32-byte sequences
      const candidates: Uint8Array[] = [];
      for (let i = 0; i <= coseKey.length - 32; i++) {
        const chunk = coseKey.slice(i, i + 32);
        // Check if this looks like a coordinate (not all zeros or all 0xff)
        const isValid = chunk.some(b => b !== 0 && b !== 0xff);
        if (isValid && !candidates.some(c => this.uint8ArrayEquals(c, chunk))) {
          candidates.push(chunk);
          if (candidates.length === 2) break;
        }
      }
      
      if (candidates.length >= 2) {
        xCoord = candidates[0];
        yCoord = candidates[1];
        debugLog('✅ [PasskeyService] Extracted coordinates using fallback method');
      } else {
        throw new Error('Could not extract x and y coordinates from COSE key');
      }
    }
    
    return {
      x: this.uint8ArrayToHex(xCoord),
      y: this.uint8ArrayToHex(yCoord),
    };
  }

  /**
   * Parse SPKI (DER) or raw uncompressed public key into x/y.
   */
  private static parseSpkiOrRaw(keyBytes: Uint8Array): { x: string; y: string } | null {
    // Native passkey libraries often expose 64 raw bytes: x(32) || y(32)
    if (keyBytes.length === 64) {
      const x = keyBytes.slice(0, 32);
      const y = keyBytes.slice(32, 64);
      return { x: this.uint8ArrayToHex(x), y: this.uint8ArrayToHex(y) };
    }

    // Raw uncompressed: 0x04 || x(32) || y(32)
    if (keyBytes.length === 65 && keyBytes[0] === 0x04) {
      const x = keyBytes.slice(1, 33);
      const y = keyBytes.slice(33, 65);
      return { x: this.uint8ArrayToHex(x), y: this.uint8ArrayToHex(y) };
    }

    // SPKI DER: ... 03 42 00 04 <x||y>
    if (keyBytes.length > 70 && keyBytes[0] === 0x30) {
      for (let i = 0; i < keyBytes.length; i++) {
        if (keyBytes[i] === 0x04 && i + 65 <= keyBytes.length) {
          const possible = keyBytes.slice(i + 1, i + 65);
          if (possible.length === 64) {
            const x = possible.slice(0, 32);
            const y = possible.slice(32, 64);
            return { x: this.uint8ArrayToHex(x), y: this.uint8ArrayToHex(y) };
          }
        }
      }
    }

    return null;
  }
  
  /**
   * Parse WebAuthn authentication response into contract signature format
   */
  private static parseWebAuthnSignature(response: any, passkeyIdRaw: string): PasskeySignature {
    debugLog('📝 [PasskeyService] Parsing WebAuthn signature...');
    debugLog('📝 [PasskeyService] Response keys:', Object.keys(response));

    try {
      // Extract authenticatorData (base64url)
      if (!response.authenticatorData) {
        throw new Error('Missing authenticatorData in response');
      }
      const authenticatorDataBytes = this.base64UrlToUint8Array(response.authenticatorData);
      const authenticatorData = this.uint8ArrayToHex(authenticatorDataBytes);
      
      debugLog('✅ [PasskeyService] Authenticator data length:', authenticatorDataBytes.length);
      
      // Extract clientDataJSON (base64url)
      if (!response.clientDataJSON) {
        throw new Error('Missing clientDataJSON in response');
      }
      const clientDataBytes = this.base64UrlToUint8Array(response.clientDataJSON);
      const clientDataJSON = new TextDecoder().decode(clientDataBytes);
      
      debugLog('✅ [PasskeyService] Client data JSON:', clientDataJSON);
      
      // Parse clientDataJSON to find challenge and type indices
      // Solidity expects: index of '"challenge":"' and '"type":"' patterns (where the key starts)
      const clientData = JSON.parse(clientDataJSON);
      
      // Find the index of the pattern '"challenge":"' (where "challenge" key starts)
      const challengeIndex = clientDataJSON.indexOf('"challenge"');
      
      // Find the index of the pattern '"type":"' (where "type" key starts)
      const typeIndex = clientDataJSON.indexOf('"type"');
      
      debugLog('📝 [PasskeyService] Challenge index:', challengeIndex);
      debugLog('📝 [PasskeyService] Type index:', typeIndex);
      debugLog('📝 [PasskeyService] Challenge pattern check:', clientDataJSON.substring(challengeIndex, challengeIndex + 25));
      debugLog('📝 [PasskeyService] Type pattern check:', clientDataJSON.substring(typeIndex, typeIndex + 20));
      
      // Extract signature (DER-encoded P-256 signature)
      if (!response.signature) {
        throw new Error('Missing signature in response');
      }
      const signatureBytes = this.base64UrlToUint8Array(response.signature);
      
      debugLog('✅ [PasskeyService] Signature length:', signatureBytes.length);
      
      // Parse DER-encoded signature to extract r and s
      const { r, s } = this.parseDERSignature(signatureBytes);
      
      debugLog('✅ [PasskeyService] Signature r:', r.slice(0, 20) + '...');
      debugLog('✅ [PasskeyService] Signature s:', s.slice(0, 20) + '...');
      
      return {
        passkeyId: passkeyIdRaw,
        authenticatorData,
        clientDataJSON,
        challengeIndex,
        typeIndex,
        r,
        s,
      };
    } catch (error) {
      console.error('❌ [PasskeyService] Failed to parse signature:', error);
      debugLog('📝 [PasskeyService] Full response:', JSON.stringify(response, null, 2));
      throw new Error(`Failed to parse signature: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Normalize a public key to raw x/y from whatever format the platform returns.
   * Accepts SPKI (DER) or raw uncompressed (0x04 || x || y).
   */
  private static normalizePublicKey(publicKey: Uint8Array): { x: string; y: string } {
    const spki = this.parseSpkiOrRaw(publicKey);
    if (spki) return spki;
    return this.parseCOSEPublicKey(publicKey); // fallback
  }
  
  /**
   * Parse DER-encoded ECDSA signature to extract r and s values
   * DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
   */
  private static parseDERSignature(der: Uint8Array): { r: string; s: string } {
    debugLog('📝 [PasskeyService] Parsing DER signature, length:', der.length);
    
    if (der[0] !== 0x30) {
      throw new Error('Invalid DER signature: missing sequence marker');
    }
    
    let offset = 2; // Skip sequence marker and length
    
    // Parse r value
    if (der[offset] !== 0x02) {
      throw new Error('Invalid DER signature: missing r integer marker');
    }
    offset++;
    
    const rLength = der[offset];
    offset++;
    
    let rBytes = der.slice(offset, offset + rLength);
    offset += rLength;
    
    // Remove leading zero if present (DER encoding adds it for positive numbers)
    if (rBytes[0] === 0x00 && rBytes.length === 33) {
      rBytes = rBytes.slice(1);
    }
    
    // Parse s value
    if (der[offset] !== 0x02) {
      throw new Error('Invalid DER signature: missing s integer marker');
    }
    offset++;
    
    const sLength = der[offset];
    offset++;
    
    let sBytes = der.slice(offset, offset + sLength);
    
    // Remove leading zero if present
    if (sBytes[0] === 0x00 && sBytes.length === 33) {
      sBytes = sBytes.slice(1);
    }
    
    // Pad to 32 bytes if needed
    const rPadded = new Uint8Array(32);
    const sPadded = new Uint8Array(32);
    rPadded.set(rBytes, 32 - rBytes.length);
    sPadded.set(sBytes, 32 - sBytes.length);
    
    const rHex = this.uint8ArrayToHex(rPadded);
    let sBigInt = BigInt(this.uint8ArrayToHex(sPadded));

    // webauthn-sol rejects high-s signatures to avoid malleability, so normalize
    // the authenticator's DER signature into canonical low-s form before sending.
    if (sBigInt > P256_HALF_N) {
      sBigInt = P256_N - sBigInt;
      debugLog('📝 [PasskeyService] Normalized high-s signature to low-s');
    }

    return {
      r: rHex,
      s: `0x${sBigInt.toString(16).padStart(64, '0')}`,
    };
  }
  
  /**
   * Convert credential ID to bytes32
   */
  private static credentialIdToBytes32(credentialId: string): string {
    // Credential ID is base64url-encoded, decode and convert to bytes32
    const decoded = this.base64UrlToUint8Array(credentialId);
    
    // If less than 32 bytes, pad with zeros; if more, take first 32 bytes
    const padded = new Uint8Array(32);
    const copyLength = Math.min(decoded.length, 32);
    padded.set(decoded.slice(0, copyLength));
    
    return this.uint8ArrayToHex(padded);
  }

  /**
   * Read the credential IDs (base64url) currently registered on-chain for a
   * wallet in the PasskeyValidator. Used to restrict the WebAuthn picker to the
   * keys that can actually sign for this wallet. Returns [] if the wallet has no
   * validator deployment or the read fails.
   */
  private static async getRegisteredCredentialIds(
    chainId: SupportedChainId,
    smartAccountAddress: Address,
  ): Promise<string[]> {
    const deployment = getDeployment(chainId);
    const validator = deployment?.passkeyValidator as Address | undefined;
    if (!validator) return [];

    const client = getPublicClient(chainId);
    const count = (await client.readContract({
      address: validator,
      abi: ABIS.passkeyValidator,
      functionName: 'passkeyCount',
      args: [smartAccountAddress],
    })) as bigint;

    const ids: string[] = [];
    for (let i = 0n; i < count; i += 1n) {
      const raw = (await client.readContract({
        address: validator,
        abi: ABIS.passkeyValidator,
        functionName: 'passkeyAt',
        args: [smartAccountAddress, i],
      })) as string;
      const id = this.bytes32ToCredentialId(raw);
      if (id) ids.push(id);
    }
    return ids;
  }

  /**
   * Inverse of credentialIdToBytes32: a right-zero-padded bytes32 PasskeyId back
   * to its base64url WebAuthn credential ID (trailing zero bytes trimmed).
   */
  private static bytes32ToCredentialId(raw: string): string {
    const hex = raw.startsWith('0x') ? raw.slice(2) : raw;
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i += 1) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    let len = 32;
    while (len > 0 && bytes[len - 1] === 0) len -= 1;
    if (len === 0) return '';
    return this.base64UrlEncode(this.uint8ArrayToBase64(bytes.slice(0, len)));
  }

  /**
   * Generate random challenge for WebAuthn
   */
  private static generateChallenge(): string {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const base64 = this.uint8ArrayToBase64(randomBytes);
    return this.base64UrlEncode(base64);
  }
  
  /**
   * Base64URL encode (WebAuthn standard)
   */
  private static base64UrlEncode(str: string): string {
    return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  static async fetchCloudPasskeys(userId: string): Promise<Array<{
    credentialId: string;
    credentialIdRaw: string;
    deviceName: string;
    deviceType: string;
    publicKeyX: string;
    publicKeyY: string;
    createdAt: string;
  }>> {
    try {
      const { getSupabaseClient } = require('@lib/supabase') as typeof import('@lib/supabase');
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('passkeys')
        .select('credential_id, credential_id_raw, device_name, device_type, public_key_x, public_key_y, created_at')
        .eq('user_id', userId);

      if (error) {
        if (error.code === '42703') {
          const { data: legacyData, error: legacyError } = await client
            .from('passkeys')
            .select('credential_id, device_name, device_type, created_at')
            .eq('user_id', userId);

          if (legacyError) {
            console.warn('Failed to fetch cloud passkeys:', legacyError);
            return [];
          }

          return (legacyData ?? []).map((row: Record<string, unknown>) => ({
            credentialId: row.credential_id as string,
            credentialIdRaw: row.credential_id as string,
            deviceName: (row.device_name as string) || 'Unknown Device',
            deviceType: (row.device_type as string) || 'unknown',
            publicKeyX: '',
            publicKeyY: '',
            createdAt: row.created_at as string,
          }));
        }
        console.warn('Failed to fetch cloud passkeys:', error);
        return [];
      }

      return (data ?? []).map((row: Record<string, unknown>) => ({
        credentialId: row.credential_id as string,
        credentialIdRaw: row.credential_id_raw as string,
        deviceName: (row.device_name as string) || 'Unknown Device',
        deviceType: (row.device_type as string) || 'unknown',
        publicKeyX: row.public_key_x as string,
        publicKeyY: row.public_key_y as string,
        createdAt: row.created_at as string,
      }));
    } catch (err) {
      console.warn('Failed to fetch cloud passkeys:', err);
      return [];
    }
  }

  /**
   * Delete a passkey row from Supabase by credential_id.
   * Idempotent — succeeds silently if no row matches.
   */
  static async deleteCloudPasskey(userId: string, credentialId: string): Promise<void> {
    try {
      const { getSupabaseClient } = require('@lib/supabase') as typeof import('@lib/supabase');
      const client = getSupabaseClient();
      const { error } = await client
        .from('passkeys')
        .delete()
        .eq('user_id', userId)
        .eq('credential_id', credentialId);
      if (error) {
        console.warn('Failed to delete cloud passkey:', error);
      }
    } catch (err) {
      console.warn('Failed to delete cloud passkey:', err);
    }
  }

  static async syncPasskeyToCloud(
    userId: string,
    walletId: string | null | undefined,
    passkey: {
      credentialId: string;
      credentialIdRaw: string;
      publicKeyX: string;
      publicKeyY: string;
      deviceName?: string;
      deviceType?: string;
      createdAt: string;
      rpId: string;
    },
  ): Promise<void> {
    // aa_wallet_id is a UUID FK — only set it when walletId is a valid UUID.
    // Hex bytes32 wallet IDs (from deriveDefaultWalletId) must not be passed here.
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const aaWalletId = walletId && UUID_RE.test(walletId) ? walletId : undefined;

    try {
      const { getSupabaseClient } = require('@lib/supabase') as typeof import('@lib/supabase');
      const client = getSupabaseClient();
      const { error } = await client.from('passkeys').upsert(
        {
          user_id: userId,
          ...(aaWalletId !== undefined && { aa_wallet_id: aaWalletId }),
          credential_id: passkey.credentialId,
          credential_id_raw: passkey.credentialIdRaw,
          public_key: JSON.stringify({
            x: passkey.publicKeyX,
            y: passkey.publicKeyY,
          }),
          public_key_x: passkey.publicKeyX,
          public_key_y: passkey.publicKeyY,
          device_name: passkey.deviceName ?? 'Unknown Device',
          device_type: passkey.deviceType ?? 'unknown',
          created_at: passkey.createdAt,
          rp_id: passkey.rpId,
        },
        { onConflict: 'credential_id' },
      );

      if (error) {
        console.warn('Failed to sync passkey to cloud:', error);
      }
    } catch (err) {
      console.warn('Failed to sync passkey to cloud:', err);
    }
  }
}

export default PasskeyService;
