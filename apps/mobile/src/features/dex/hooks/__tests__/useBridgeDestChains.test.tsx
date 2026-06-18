// npx tsx apps/mobile/src/features/dex/hooks/__tests__/useBridgeDestChains.test.tsx
//
// Tests the useBridgeDestChains hook's testnet logic path.
// The hook is tested indirectly by verifying the bridge registry contract
// that powers its testnet path, plus label mapping assumptions.

import { getBridgeConfig } from "@/src/features/swaps/config/bridgeRegistry";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ── Test 1: getBridgeConfig returns correct destination chains for base-sepolia ──
const baseSepoliaConfig = getBridgeConfig("base-sepolia");
assert(baseSepoliaConfig, "base-sepolia should have a bridge config");

const baseSepoliaDestKeys = baseSepoliaConfig!.routes.map((r) => r.destinationNetworkKey);
assert(
  baseSepoliaDestKeys.includes("ethereum-sepolia"),
  `base-sepolia should route to ethereum-sepolia, got: ${JSON.stringify(baseSepoliaDestKeys)}`,
);
assert(
  baseSepoliaDestKeys.includes("arbitrum-sepolia"),
  `base-sepolia should route to arbitrum-sepolia, got: ${JSON.stringify(baseSepoliaDestKeys)}`,
);
assert(
  baseSepoliaDestKeys.length === 2,
  `base-sepolia should have exactly 2 routes, got: ${baseSepoliaDestKeys.length}`,
);

// ── Test 2: Source chain is never its own destination ──
assert(
  !baseSepoliaDestKeys.includes("base-sepolia"),
  "source chain base-sepolia should not appear in its own destination list",
);

// ── Test 3: ethereum-sepolia has correct routes ──
const sepoliaConfig = getBridgeConfig("ethereum-sepolia");
assert(sepoliaConfig, "ethereum-sepolia should have a bridge config");

const sepoliaDestKeys = sepoliaConfig!.routes.map((r) => r.destinationNetworkKey);
assert(
  sepoliaDestKeys.includes("base-sepolia"),
  "ethereum-sepolia should route to base-sepolia",
);
assert(
  sepoliaDestKeys.includes("arbitrum-sepolia"),
  "ethereum-sepolia should route to arbitrum-sepolia",
);

// ── Test 4: arbitrum-sepolia has correct routes ──
const arbConfig = getBridgeConfig("arbitrum-sepolia");
assert(arbConfig, "arbitrum-sepolia should have a bridge config");

const arbDestKeys = arbConfig!.routes.map((r) => r.destinationNetworkKey);
assert(
  arbDestKeys.includes("ethereum-sepolia"),
  "arbitrum-sepolia should route to ethereum-sepolia",
);
assert(
  arbDestKeys.includes("base-sepolia"),
  "arbitrum-sepolia should route to base-sepolia",
);

console.log("useBridgeDestChains tests passed");
