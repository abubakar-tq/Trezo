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
 * - bytes32 rpIdHash (SHA-256 of relying party ID)
 * - Signature: (authenticatorData, clientDataJSON, challengeIndex, typeIndex, r, s)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Passkey from 'react-native-passkeys';
import { encodeAbiParameters, parseAbiParameters, sha256, toBytes } from 'viem';

const PASSKEY_STORAGE_KEY = 'trezo_passkey_'; // One passkey per device
const RP_NAME = (Constants?.expoConfig?.extra as any)?.passkeyRpName || 'Trezo Wallet';
const CONFIGURED_RP_ID = (Constants?.expoConfig?.extra as any)?.passkeyRpId || 'trezo.app';

/**
 * Get the Relying Party ID (RP_ID)
 * 
 * - RP ID must be a real web domain (no localhost/package names)
 * - Domain must host: 
 *   - /.well-known/assetlinks.json (Android)
 *   - /.well-known/apple-app-site-association (iOS)
 * - Configure via EXPO_PUBLIC_PASSKEY_RP_ID (default: trezo.app)
 * - Expo Go is not supported because it lacks the native credential APIs
 */
function getRpId(): string {
  // Expo Go does not include the native credential APIs required for passkeys
  if (Constants?.appOwnership === 'expo') {
    throw new Error('Passkeys are unavailable in Expo Go. Use a development or production build instead.');
  }

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
  rpIdHash: string;           // SHA-256(rpId) for contract (hex)
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
      console.log('🔐 [PasskeyService] Checking passkey support...');
      console.log('📱 [PasskeyService] Platform:', Platform.OS);
      
      const isSupported = await Passkey.isSupported();
      
      console.log('🔐 [PasskeyService] Device passkey support:', isSupported);
      
      // Determine supported authentication types based on platform
      let supportedTypes: string[] = [];
      if (isSupported) {
        if (Platform.OS === 'android') {
          supportedTypes = ['Passkey (Fingerprint/Face/PIN)'];
        } else if (Platform.OS === 'ios') {
          supportedTypes = ['Passkey (Face ID/Touch ID)'];
        } else {
          supportedTypes = ['Passkey'];
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
   * Create a REAL WebAuthn passkey (stored in secure enclave)
   * Returns public metadata only - private key never leaves device
   * 
   * Note: Replaces any existing passkey on this device
   */
  static async createPasskey(userId: string): Promise<PasskeyMetadata> {
    console.log('🔐 [PasskeyService] Creating WebAuthn passkey for user:', userId);
    console.log('📱 [PasskeyService] Platform:', Platform.OS);
    console.log('📱 [PasskeyService] __DEV__:', __DEV__);
    
    // Check if there's an existing passkey
    const existingPasskey = await this.getPasskey(userId);
    if (existingPasskey) {
      console.log('⚠️ [PasskeyService] Replacing existing passkey on this device');
    }
    
    // 1. Check if passkeys are supported
    const isSupported = await Passkey.isSupported();
    if (!isSupported) {
      throw new Error('Passkeys not supported on this device. Make sure you are using a development build (not Expo Go) and Google Play Services is installed.');
    }
    
    console.log('✅ [PasskeyService] Passkey support verified');
    
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
    
    console.log('📝 [PasskeyService] Registration options:', {
      rpId,
      platform: Platform.OS,
      userId: userId.slice(0, 8),
      userIdEncoded: userIdBase64Url.slice(0, 20) + '...',
      challenge: challenge.slice(0, 20) + '...',
    });
    
    console.log('🔍 [PasskeyService] Full registration options:', JSON.stringify({
      challenge: challenge.slice(0, 50),
      rp: registrationOptions.rp,
      user: { ...registrationOptions.user, id: registrationOptions.user.id.slice(0, 30) + '...' },
      pubKeyCredParams: registrationOptions.pubKeyCredParams,
      authenticatorSelection: registrationOptions.authenticatorSelection,
    }, null, 2));
    
    // 5. Create passkey (triggers Face ID/Touch ID)
    let result;
    try {
      console.log('🔐 [PasskeyService] Attempting to create passkey...');
      result = await Passkey.create(registrationOptions);
      console.log('✅ [PasskeyService] Passkey created in secure enclave');
    } catch (error: any) {
      console.error('❌ [PasskeyService] Passkey creation failed:', error);
      console.error('❌ [PasskeyService] Error type:', error.constructor?.name);
      console.error('❌ [PasskeyService] Error message:', error.message);
      
      // Provide specific troubleshooting for Android
      if (Platform.OS === 'android') {
        if (error.message?.includes('CreateCredentialNoCreateOptionException')) {
          throw new Error(
            'Android Passkey Setup Required:\n\n' +
            '1. Install Google Play Services on your device/emulator\n' +
            '2. Set up a Screen Lock: Settings > Security > Screen Lock (PIN/Pattern/Password)\n' +
            '3. Enroll Biometrics (optional): Settings > Security > Fingerprint\n' +
            '4. Make sure you\'re using a development build (not Expo Go)\n' +
            '5. For emulators: Use a Pixel device with Google APIs (not AOSP)\n\n' +
            'Original error: ' + error.message
          );
        }
        if (error.message?.includes('DataError')) {
          throw new Error(
            'Passkey request was rejected by Credential Manager (DataError).\n\n' +
            'This usually means the RP ID is not a real domain or the Digital Asset Links file is missing.\n' +
            'Set EXPO_PUBLIC_PASSKEY_RP_ID to your domain (e.g. trezo.app) and host /.well-known/assetlinks.json\n' +
            'that links the domain to your Android signing certificate.\n\n' +
            'Original error: ' + error.message
          );
        }
        if (error.message?.includes('SecurityException')) {
          throw new Error(
            'Security Exception: Make sure your app.config.ts has the correct package name (com.trezo.wallet) and you\'re using a development build.\n\n' +
            'Original error: ' + error.message
          );
        }
      }
      
      throw new Error(`Failed to create passkey: ${error.message}`);
    }
    
    if (!result) {
      throw new Error('Passkey creation returned null result');
    }
    
    // 6. Extract public key from attestation response
    const publicKey = this.extractPublicKey(result.response);
    
    // 7. Calculate rpIdHash (SHA-256 of RP ID)
    const rpIdHash = this.calculateRpIdHash(rpId);
    
    // 8. Convert credential ID to bytes32
    const credentialIdRaw = this.credentialIdToBytes32(result.id);
    
    // 9. Create metadata (PUBLIC DATA ONLY)
    const metadata: PasskeyMetadata = {
      credentialId: result.id,
      credentialIdRaw,
      publicKeyX: publicKey.x,
      publicKeyY: publicKey.y,
      rpId,
      rpIdHash,
      deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android Device',
      deviceType: Platform.OS as 'ios' | 'android',
      createdAt: new Date().toISOString(),
    };
    
    // 10. Save metadata to AsyncStorage (replaces old passkey if exists)
    await this.savePasskey(userId, metadata);
    
    console.log('💾 [PasskeyService] Passkey metadata saved to AsyncStorage');
    console.log('🔑 [PasskeyService] Public Key X:', publicKey.x.slice(0, 20) + '...');
    console.log('🔑 [PasskeyService] Public Key Y:', publicKey.y.slice(0, 20) + '...');
    console.log('🔑 [PasskeyService] RP ID Hash:', rpIdHash.slice(0, 20) + '...');
    
    return metadata;
  }
  
  /**
   * Sign a UserOperation hash with passkey (triggers biometric authentication)
   * Returns WebAuthn signature in contract-compatible format
   */
  static async signWithPasskey(
    userId: string,
    userOpHash: string
  ): Promise<PasskeySignature> {
    console.log('✍️ [PasskeyService] Signing with passkey');
    console.log('📝 [PasskeyService] UserOp hash:', userOpHash);
    
    // 1. Get passkey for this device
    const passkey = await this.getPasskey(userId);
    if (!passkey) {
      throw new Error('No passkey found on this device. Please create a passkey first.');
    }
    
    console.log('🔑 [PasskeyService] Using passkey:', passkey.credentialId);
    
    // 2. Prepare authentication challenge (userOpHash as base64url)
    const challengeBytes = toBytes(userOpHash as `0x${string}`);
    const challenge = this.base64UrlEncode(this.uint8ArrayToBase64(challengeBytes));
    
    // 3. Get RP ID for this platform
    const rpId = getRpId();
    
    // 4. Get authentication (triggers biometric)
    const authOptions = {
      challenge: challenge,
      rpId,
      timeout: 60000,
      userVerification: 'required' as const,
    };
    
    let authResult;
    try {
      console.log('🔐 [PasskeyService] Attempting biometric authentication...');
      authResult = await Passkey.get(authOptions);
      console.log('✅ [PasskeyService] Biometric authentication successful');
    } catch (error: any) {
      console.error('❌ [PasskeyService] Authentication failed:', error);
      console.error('❌ [PasskeyService] Error type:', error.constructor?.name);
      
      // Provide specific troubleshooting for Android
      if (Platform.OS === 'android') {
        if (error.message?.includes('GetCredentialException')) {
          throw new Error(
            'Authentication failed. Make sure:\n' +
            '1. You have created a passkey first\n' +
            '2. Biometric authentication is enabled on your device\n' +
            '3. You\'re using the same device that created the passkey\n\n' +
            'Original error: ' + error.message
          );
        }
      }
      
      throw new Error(`Failed to authenticate: ${error.message}`);
    }
    
    if (!authResult) {
      throw new Error('Authentication returned null result');
    }
    
    // 5. Extract signature components from WebAuthn response
    const signature = this.parseWebAuthnSignature(authResult.response, passkey.credentialIdRaw);
    
    console.log('✅ [PasskeyService] Signature created');
    console.log('📝 [PasskeyService] Signature r:', signature.r.slice(0, 20) + '...');
    console.log('📝 [PasskeyService] Signature s:', signature.s.slice(0, 20) + '...');
    
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
    
    console.log('📦 [PasskeyService] Encoded signature for contract:', encoded.slice(0, 50) + '...');
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
   * Delete passkey from this device
   * (removes from AsyncStorage, secure enclave cleanup is automatic)
   */
  static async deletePasskey(userId: string): Promise<void> {
    const key = PASSKEY_STORAGE_KEY + userId;
    await AsyncStorage.removeItem(key);
    
    console.log('🗑️ [PasskeyService] Passkey deleted from this device');
  }
  
  /**
   * Get passkey data for contract deployment (onInstall format)
   * Returns: abi.encode(bytes32 passkeyId, uint256 px, uint256 py, bytes32 rpIdHash)
   */
  static async getPasskeyDataForDeployment(userId: string): Promise<string> {
    const passkey = await this.getPasskey(userId);
    if (!passkey) {
      throw new Error('No passkey found on this device. Please create a passkey first.');
    }
    
    const encoded = encodeAbiParameters(
      parseAbiParameters('bytes32, uint256, uint256, bytes32'),
      [
        passkey.credentialIdRaw as `0x${string}`,
        BigInt(passkey.publicKeyX),
        BigInt(passkey.publicKeyY),
        passkey.rpIdHash as `0x${string}`,
      ]
    );
    
    console.log('📦 [PasskeyService] Encoded passkey data for deployment');
    return encoded;
  }
  
  // ==================== PRIVATE HELPER METHODS ====================
  
  /**
   * Save passkey metadata to AsyncStorage (replaces existing)
   */
  private static async savePasskey(userId: string, metadata: PasskeyMetadata): Promise<void> {
    const key = PASSKEY_STORAGE_KEY + userId;
    await AsyncStorage.setItem(key, JSON.stringify(metadata));
    
    console.log('💾 [PasskeyService] Passkey saved for device');
  }
  
  /**
   * Extract P-256 public key from WebAuthn attestation response
   * The response contains a publicKey field with the COSE public key
   */
  private static extractPublicKey(response: any): { x: string; y: string } {
    console.log('📝 [PasskeyService] Extracting public key from response...');
    console.log('📝 [PasskeyService] Response keys:', Object.keys(response));
    
    try {
      // react-native-passkeys returns the public key in response.publicKey
      if (response.publicKey) {
        console.log('✅ [PasskeyService] Found publicKey in response');
        
        // The publicKey should be a base64url-encoded COSE key
        // COSE P-256 key format:
        // - kty: 2 (EC2)
        // - alg: -7 (ES256)
        // - crv: 1 (P-256)
        // - x: 32 bytes (x coordinate)
        // - y: 32 bytes (y coordinate)
        
        const publicKeyBytes = this.base64UrlToUint8Array(response.publicKey);
        console.log('📝 [PasskeyService] Public key bytes length:', publicKeyBytes.length);
        
        // For COSE EC2 key, the structure is CBOR-encoded
        // We need to parse it to extract x and y coordinates
        const parsed = this.parseCOSEPublicKey(publicKeyBytes);
        
        console.log('✅ [PasskeyService] Extracted P-256 coordinates');
        console.log('🔑 [PasskeyService] X:', parsed.x.slice(0, 20) + '...');
        console.log('🔑 [PasskeyService] Y:', parsed.y.slice(0, 20) + '...');
        
        return parsed;
      }
      
      // Fallback: try to extract from attestationObject if available
      if (response.attestationObject) {
        console.log('⚠️ [PasskeyService] No publicKey field, trying attestationObject');
        // This would require full CBOR parsing of attestationObject
        throw new Error('attestationObject parsing not implemented yet');
      }
      
      throw new Error('No public key found in response');
    } catch (error) {
      console.error('❌ [PasskeyService] Failed to extract public key:', error);
      console.log('📝 [PasskeyService] Full response:', JSON.stringify(response, null, 2));
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
    
    console.log('📝 [PasskeyService] Parsing COSE key, length:', coseKey.length);
    
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
          console.log('🔑 [PasskeyService] Found x coordinate at offset', i);
        } else if (!yCoord) {
          yCoord = chunk;
          console.log('🔑 [PasskeyService] Found y coordinate at offset', i);
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
        console.log('✅ [PasskeyService] Extracted coordinates using fallback method');
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
   * Parse WebAuthn authentication response into contract signature format
   */
  private static parseWebAuthnSignature(response: any, passkeyIdRaw: string): PasskeySignature {
    console.log('📝 [PasskeyService] Parsing WebAuthn signature...');
    console.log('📝 [PasskeyService] Response keys:', Object.keys(response));
    
    try {
      // Extract authenticatorData (base64url)
      if (!response.authenticatorData) {
        throw new Error('Missing authenticatorData in response');
      }
      const authenticatorDataBytes = this.base64UrlToUint8Array(response.authenticatorData);
      const authenticatorData = this.uint8ArrayToHex(authenticatorDataBytes);
      
      console.log('✅ [PasskeyService] Authenticator data length:', authenticatorDataBytes.length);
      
      // Extract clientDataJSON (base64url)
      if (!response.clientDataJSON) {
        throw new Error('Missing clientDataJSON in response');
      }
      const clientDataBytes = this.base64UrlToUint8Array(response.clientDataJSON);
      const clientDataJSON = new TextDecoder().decode(clientDataBytes);
      
      console.log('✅ [PasskeyService] Client data JSON:', clientDataJSON);
      
      // Parse clientDataJSON to find challenge and type indices
      const clientData = JSON.parse(clientDataJSON);
      const challengeIndex = clientDataJSON.indexOf(clientData.challenge);
      const typeIndex = clientDataJSON.indexOf(clientData.type);
      
      console.log('📝 [PasskeyService] Challenge index:', challengeIndex);
      console.log('📝 [PasskeyService] Type index:', typeIndex);
      
      // Extract signature (DER-encoded P-256 signature)
      if (!response.signature) {
        throw new Error('Missing signature in response');
      }
      const signatureBytes = this.base64UrlToUint8Array(response.signature);
      
      console.log('✅ [PasskeyService] Signature length:', signatureBytes.length);
      
      // Parse DER-encoded signature to extract r and s
      const { r, s } = this.parseDERSignature(signatureBytes);
      
      console.log('✅ [PasskeyService] Signature r:', r.slice(0, 20) + '...');
      console.log('✅ [PasskeyService] Signature s:', s.slice(0, 20) + '...');
      
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
      console.log('📝 [PasskeyService] Full response:', JSON.stringify(response, null, 2));
      throw new Error(`Failed to parse signature: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Parse DER-encoded ECDSA signature to extract r and s values
   * DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
   */
  private static parseDERSignature(der: Uint8Array): { r: string; s: string } {
    console.log('📝 [PasskeyService] Parsing DER signature, length:', der.length);
    
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
    
    return {
      r: this.uint8ArrayToHex(rPadded),
      s: this.uint8ArrayToHex(sPadded),
    };
  }
  
  /**
   * Calculate SHA-256 hash of RP ID
   */
  private static calculateRpIdHash(rpId: string): string {
    const hash = sha256(toBytes(rpId));
    console.log('🔐 [PasskeyService] RP ID Hash calculated:', hash.slice(0, 20) + '...');
    return hash;
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
}

export default PasskeyService;
