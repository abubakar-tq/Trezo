// Viem + React Native polyfills.
// Keep this imported before any viem clients are created.
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// Buffer is not always present in Hermes.
// Only assign if it isn't already there to avoid clobbering.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Buffer } = require("buffer");
  const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: unknown };
  if (typeof globalWithBuffer.Buffer === "undefined") {
    globalWithBuffer.Buffer = Buffer;
  }
} catch {
  // If buffer isn't available, we leave it undefined and let viem throw a clear error.
}
