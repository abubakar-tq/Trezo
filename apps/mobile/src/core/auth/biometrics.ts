import * as LocalAuthentication from 'expo-local-authentication';

export const authenticateWithBiometrics = async (): Promise<boolean> => {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) {
      console.log('No biometric hardware available');
      return false;
    }

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!isEnrolled) {
      console.log('No biometrics enrolled');
      return false;
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
    return false;
  }
};
