import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const PIN_HASH_KEY = "trezo-app-pin-hash-v1";
const PIN_SALT_KEY = "trezo-app-pin-salt-v1";

export const APP_PIN_LENGTH = 6;

const generateSalt = async (): Promise<string> => {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const hashPin = async (pin: string, salt: string): Promise<string> => {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}::${pin}`,
  );
};

export type AppPinState = {
  hasInitialized: boolean;
  hasPin: boolean;
  pinHash: string | null;
  salt: string | null;
  initialize: () => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  removePin: () => Promise<void>;
};

export const useAppPinStore = create<AppPinState>((set, get) => ({
  hasInitialized: false,
  hasPin: false,
  pinHash: null,
  salt: null,

  initialize: async () => {
    if (get().hasInitialized) return;
    const [hash, salt] = await Promise.all([
      SecureStore.getItemAsync(PIN_HASH_KEY),
      SecureStore.getItemAsync(PIN_SALT_KEY),
    ]);
    set({
      hasInitialized: true,
      hasPin: Boolean(hash && salt),
      pinHash: hash,
      salt,
    });
  },

  setupPin: async (pin) => {
    if (pin.length !== APP_PIN_LENGTH || !/^\d+$/.test(pin)) {
      throw new Error(`PIN must be exactly ${APP_PIN_LENGTH} digits`);
    }
    const salt = await generateSalt();
    const hash = await hashPin(pin, salt);
    await Promise.all([
      SecureStore.setItemAsync(PIN_HASH_KEY, hash),
      SecureStore.setItemAsync(PIN_SALT_KEY, salt),
    ]);
    set({ hasPin: true, pinHash: hash, salt });
  },

  verifyPin: async (pin) => {
    const { pinHash, salt } = get();
    if (!pinHash || !salt) return false;
    const candidate = await hashPin(pin, salt);
    return candidate === pinHash;
  },

  removePin: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(PIN_HASH_KEY),
      SecureStore.deleteItemAsync(PIN_SALT_KEY),
    ]);
    set({ hasPin: false, pinHash: null, salt: null });
  },
}));
