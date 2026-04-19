import * as LocalAuthentication from 'expo-local-authentication';

export const authenticateWithBiometrics = async (): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      console.log('No biometric hardware available');
      return true; // Fallback if no hardware
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      console.log('No biometrics enrolled');
      return true; // Fallback if not set up
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock your Trezo Wallet',
      fallbackLabel: 'Use Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    return result.success;
  } catch (error) {
    console.error('Biometric authentication error:', error);
    return true; // Fallback on error
  }
};
