// NODE_OPTIONS="--require ./test/setup.cjs" npx tsx src/features/dex/components/__tests__/BridgeDestPicker.test.tsx
// (from apps/mobile directory)
// Tests the pure helper functions that BridgeDestPicker exports.
import { validateRecipientAddress, shortenAddress } from "../BridgeDestPicker";

// shortenAddress
console.assert(
  shortenAddress("0x1234567890abcdef1234567890abcdef12345678") === "0x1234…5678",
  "should shorten an address",
);
console.assert(shortenAddress(null) === "", "null should return empty string");

// validateRecipientAddress — valid
console.assert(
  validateRecipientAddress("0x1234567890abcdef1234567890abcdef12345678") === null,
  "valid address should return null error",
);

// validateRecipientAddress — too short
console.assert(
  validateRecipientAddress("0x1234") !== null,
  "short address should return error",
);

// validateRecipientAddress — no 0x prefix
console.assert(
  validateRecipientAddress("1234567890abcdef1234567890abcdef12345678") !== null,
  "missing 0x prefix should return error",
);

// validateRecipientAddress — empty
console.assert(
  validateRecipientAddress("") !== null,
  "empty string should return error",
);

console.log("BridgeDestPicker helper tests passed");
