import React, { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { SigninIcon } from '@/assets/components'; // Using SigninIcon as placeholder
import { PasskeyService as WalletPasskeyService } from '@/src/features/wallet/services/PasskeyService';
import { AuthGradientButton, AuthScaffold } from '@features/auth/components';
import { useUserStore } from '@store/useUserStore';
import { useAppTheme } from '@theme';

const PasskeyRegistrationScreen = () => {
  const { theme } = useAppTheme();
  const user = useUserStore((state) => state.user);
  const [loading, setLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);

  // Check passkey support on mount
  React.useEffect(() => {
    WalletPasskeyService.checkBiometricCapabilities()
      .then((capabilities) => setPasskeySupported(capabilities.hasHardware && capabilities.isEnrolled))
      .catch(() => setPasskeySupported(false));
  }, []);

  const handleCreatePasskey = async () => {
    setLoading(true);
    try {
      const capabilities = await WalletPasskeyService.checkBiometricCapabilities();
      if (!capabilities.hasHardware || !capabilities.isEnrolled) {
        Alert.alert(
          'Not Available', 
          'Passkeys require a development build and device credential support. You can skip this step and test other features.',
          [{ text: 'OK' }]
        );
        return;
      }

      const userId = user?.id ?? user?.email;
      if (!userId) {
        Alert.alert('Sign in required', 'Please sign in before creating a passkey.', [{ text: 'OK' }]);
        return;
      }
      
      await WalletPasskeyService.createPasskey(userId);
      
      Alert.alert('Success', 'Passkey created successfully!', [
        { 
          text: 'Continue'
        }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create passkey. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    Alert.alert('Passkey skipped', 'You can create a passkey later from your wallet settings.', [{ text: 'OK' }]);
  };

  return (
    <AuthScaffold
      title="Secure Your Wallet"
      subtitle="Create a Passkey for faster, more secure access without passwords."
      icon={<SigninIcon />} 
    >
      <View style={styles.content}>
        <View style={styles.infoContainer}>
          {passkeySupported === false && (
            <View style={[styles.warningBox, { backgroundColor: theme.colors.warning + '20', borderColor: theme.colors.warning }]}>
              <Text style={[styles.warningText, { color: theme.colors.warning }]}>
                {'Running in Expo Go - Passkeys unavailable. Use "Skip" to test other features.'}
              </Text>
            </View>
          )}
          <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
            {"Passkeys use your device's biometrics (FaceID/TouchID) to secure your account. They are safer than passwords and cannot be phished."}
          </Text>
        </View>

        <View style={styles.actions}>
          <AuthGradientButton
            label={loading ? "Creating Passkey..." : "Create Passkey"}
            onPress={handleCreatePasskey}
            disabled={loading || passkeySupported === false}
          />
          
          <View style={{ marginTop: 16 }}>
             <AuthGradientButton
                label="Skip for now"
                onPress={handleSkip}
             />
          </View>
        </View>
      </View>
    </AuthScaffold>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  infoContainer: {
    marginBottom: 32,
  },
  warningBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '600',
  },
  infoText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
});

export default PasskeyRegistrationScreen;
