let storage: any;
try {
  const { MMKV } = require('react-native-mmkv');
  storage = new MMKV();
} catch (e) {
  console.warn('[StorageService] MMKV not available, using in-memory fallback');
  // Simple in-memory fallback for development/Expo Go
  const fallback = new Map();
  storage = {
    set: (k: string, v: string) => fallback.set(k, v),
    getString: (k: string) => fallback.get(k),
    delete: (k: string) => fallback.delete(k),
    clearAll: () => fallback.clear(),
  };
}

export { storage };

export const StorageKeys = {
  TOP_ASSETS: 'market.top_assets',
  ASSET_HISTORY: (id: string, interval: string) => `market.history.${id}.${interval}`,
  LAST_FETCH: 'market.last_fetch',
};

class StorageService {
  set(key: string, value: any) {
    try {
      storage.set(key, JSON.stringify(value));
    } catch (e) {
      console.error('Storage set error:', e);
    }
  }

  get<T>(key: string): T | null {
    try {
      const value = storage.getString(key);
      return value ? JSON.parse(value) : null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  }

  delete(key: string) {
    storage.delete(key);
  }

  clearAll() {
    storage.clearAll();
  }
}

export const storageService = new StorageService();
