import { Wallet } from 'ethers';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PRIVATE_KEY_STORAGE_KEY = 'trezo_wallet_signer_key';

/**
 * Securely generates or retrieves the local EOA Signer.
 * This signer controls the Smart Account.
 */
export const getOrGenerateSigner = async (): Promise<Wallet> => {
  try {
    // 1. Try to retrieve existing key
    let privateKey = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);

    // 2. If no key, generate a new one
    if (!privateKey) {
      console.log('Generating new signer key...');
      const randomBytes = await Crypto.getRandomBytesAsync(32);
      const wallet = new Wallet(Buffer.from(randomBytes).toString('hex'));
      privateKey = wallet.privateKey;
      
      // 3. Store securely
      await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_KEY, privateKey, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }

    return new Wallet(privateKey);
  } catch (error) {
    console.error('Error managing signer key:', error);
    throw new Error('Failed to load wallet signer');
  }
};

/**
 * Checks if a signer key already exists on device.
 */
export const hasSigner = async (): Promise<boolean> => {
  const key = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);
  return !!key;
};

/**
 * Wipes the signer key (for logout/reset).
 * WARNING: This loses access to the Smart Account unless backed up!
 */
export const clearSigner = async () => {
  await SecureStore.deleteItemAsync(PRIVATE_KEY_STORAGE_KEY);
};
