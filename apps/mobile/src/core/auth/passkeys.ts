import Passkey from 'react-native-passkeys';

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
   * Checks if the device supports Passkeys
   */
  isSupported: async (): Promise<boolean> => {
    try {
      // Check if running in Expo Go (will throw error)
      return await Passkey.isSupported();
    } catch (error) {
      // Running in Expo Go or passkeys unavailable
      console.log('Passkeys not available (Expo Go or unsupported device)');
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
      throw new Error('Passkeys are not supported on this device (use development build)');
    }

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
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      timeout: 60000,
      attestation: 'direct',
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        requireResidentKey: true,
        userVerification: 'required',
      },
    };

    try {
      // 2. Prompt User to Create Passkey
      const result = await Passkey.create(registrationOptions);
      console.log('Passkey Created:', result);
      return result;
    } catch (error) {
      console.error('Passkey Registration Failed:', error);
      throw error;
    }
  },

  /**
   * Authenticates using an existing Passkey
   */
  authenticate: async (): Promise<any> => {
    const supported = await PasskeyService.isSupported();
    if (!supported) {
      throw new Error('Passkeys are not supported on this device (use development build)');
    }

    // 1. Get Challenge from Backend
    const challenge = 'random-login-challenge';

    const authOptions = {
      challenge: challenge,
      rpId: 'trezo.wallet',
      timeout: 60000,
      userVerification: 'required',
    };

    try {
      // 2. Prompt User to Sign In
      const result = await Passkey.get(authOptions);
      console.log('Passkey Authenticated:', result);
      return result;
    } catch (error) {
      console.error('Passkey Authentication Failed:', error);
      throw error;
    }
  }
};
