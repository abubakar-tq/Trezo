import Constants from 'expo-constants';
import * as LocalAuthentication from 'expo-local-authentication';
// Conditionally import passkeys only if available and not in Expo Go
let Passkey: any = null;

// Check if we're in Expo Go - if so, skip passkeys entirely
const isExpoGo = Constants?.appOwnership === 'expo';

if (!isExpoGo) {
  try {
    Passkey = require('react-native-passkeys').default;
  } catch (e) {
    console.warn('react-native-passkeys not available, using fallback authentication');
  }
} else {
  console.log('Running in Expo Go, using biometric authentication only');
}

// Mock Backend URLs (Replace with your actual backend)
const BACKEND_URL = 'https://api.trezo.wallet'; 

export interface PasskeyRegistrationResult {
  id: string;
  rawId: string;
  response: any;
  type: string;
}

export const PasskeyService = {
  /**
   * Checks if the device supports Passkeys or fallback authentication
   */
  isSupported: async (): Promise<boolean> => {
    // Check for passkeys first (development builds)
    if (Passkey) {
      try {
        const passkeySupported = await Passkey.isSupported();
        if (passkeySupported) return true;
      } catch (e) {
        console.warn('Passkey check failed:', e);
      }
    }

    // Fallback to biometric/local authentication (Expo Go)
    try {
      const localAuthSupported = await LocalAuthentication.hasHardwareAsync();
      const localAuthEnrolled = await LocalAuthentication.isEnrolledAsync();
      return localAuthSupported && localAuthEnrolled;
    } catch (e) {
      console.warn('Local authentication check failed:', e);
      return false;
    }
  },

  /**
   * Registers a new Passkey
   * @param username The user's identifier (email or username)
   */
  register: async (username: string): Promise<PasskeyRegistrationResult> => {
    const supported = await PasskeyService.isSupported();
    if (!supported) {
      throw new Error('Authentication is not supported on this device');
    }

    // Try passkeys first (development builds)
    if (Passkey) {
      try {
        // 1. Get Challenge from Backend (Mocked for now)
        const challenge = 'random-challenge-string-from-server';
        const userId = 'user-id-from-server';

        const registrationOptions = {
          challenge: challenge,
          rp: {
            name: 'Trezo Wallet',
            id: 'trezo.wallet', // Must match your domain/bundle ID
          },
          user: {
            id: userId,
            name: username,
            displayName: username,
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' as const }, // ES256
            { alg: -257, type: 'public-key' as const }, // RS256
          ],
          timeout: 60000,
          attestation: 'direct',
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            requireResidentKey: true,
            userVerification: 'required',
          },
        };

        // 2. Prompt User to Create Passkey
        const result = await Passkey.create(registrationOptions);
        console.log('Passkey Created:', result);
        return result as PasskeyRegistrationResult;
      } catch (passkeyError) {
        console.warn('Passkey registration failed, trying fallback:', passkeyError);
      }
    }

    // Fallback to biometric authentication (Expo Go)
    try {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to create your wallet',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (authResult.success) {
        // Mock successful registration for Expo Go
        return {
          id: `biometric-${Date.now()}`,
          rawId: `biometric-${Date.now()}`,
          response: { authenticatorData: 'biometric-auth' },
          type: 'biometric'
        };
      } else {
        throw new Error('Biometric authentication failed');
      }
    } catch (error) {
      console.error('Authentication Failed:', error);
      throw error;
    }
  },

  /**
   * Authenticates using an existing Passkey
   */
  authenticate: async (): Promise<any> => {
    const supported = await PasskeyService.isSupported();
    if (!supported) {
      throw new Error('Authentication is not supported on this device');
    }

    // Try passkeys first (development builds)
    if (Passkey) {
      try {
        // 1. Get Challenge from Backend
        const challenge = 'random-login-challenge';

        const authOptions = {
          challenge: challenge,
          rpId: 'trezo.wallet',
          timeout: 60000,
          userVerification: 'required' as const,
        };

        // 2. Prompt User to Sign In
        const result = await Passkey.get(authOptions);
        console.log('Passkey Authenticated:', result);
        return result;
      } catch (passkeyError) {
        console.warn('Passkey authentication failed, trying fallback:', passkeyError);
      }
    }

    // Fallback to biometric authentication (Expo Go)
    try {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access your wallet',
        fallbackLabel: 'Use PIN',
        disableDeviceFallback: false,
      });

      if (authResult.success) {
        // Mock successful authentication for Expo Go
        return {
          id: `biometric-auth-${Date.now()}`,
          rawId: `biometric-auth-${Date.now()}`,
          response: { authenticatorData: 'biometric-auth' },
          type: 'biometric'
        };
      } else {
        throw new Error('Biometric authentication failed');
      }
    } catch (error) {
      console.error('Authentication Failed:', error);
      throw error;
    }
  }
};
