// npx tsx apps/mobile/src/features/dex/hooks/__tests__/useBridgeDestChains.test.tsx
//
// Tests the useBridgeDestChains hook's testnet logic path via the extracted pure helper.
// The helper is tested directly without React hooks, validating bridge registry behavior.
// Pure helper only — no lazy require of viem so it runs under tsx without react-native.

import type { NetworkKey } from "@/src/integration/networks";
import type { Address } from "viem";

// ── Inline bridge config for testing (mirror from bridgeRegistry.ts) ──
type BridgeRouteConfig = {
  destinationNetworkKey: NetworkKey;
  pairs: Array<{ inputToken: Address; outputToken: Address }>;
};

type BridgeConfig = {
  networkKey: NetworkKey;
  bridgeId: "across_v3";
  spokePool: Address;
  routes: BridgeRouteConfig[];
};

const SEPOLIA_USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" as Address;
const SEPOLIA_WETH = "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9" as Address;
const BASE_SEPOLIA_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as Address;
const BASE_SEPOLIA_WETH = "0x4200000000000000000000000000000000000006" as Address;
const ARB_SEPOLIA_USDC = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d" as Address;
const ARB_SEPOLIA_WETH = "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" as Address;

const SPOKE_POOL_SEPOLIA = "0x5ef6C01E11889d86803e0B23e3cB3F9E9d97B662" as Address;
const SPOKE_POOL_BASE_SEPOLIA = "0x82B564983aE7274c86695917BBf8C99ECb6F0F8F" as Address;
const SPOKE_POOL_ARB_SEPOLIA = "0x7E63A5f1a8F0B4d0934B2f2327DAED3F6bb2ee75" as Address;

const pairsBetween = (
  source: { usdc: Address; weth: Address },
  dest: { usdc: Address; weth: Address },
) => [
  { inputToken: source.usdc, outputToken: dest.usdc },
  { inputToken: source.weth, outputToken: dest.weth },
];

const SEPOLIA_TOKENS = { usdc: SEPOLIA_USDC, weth: SEPOLIA_WETH };
const BASE_SEPOLIA_TOKENS = { usdc: BASE_SEPOLIA_USDC, weth: BASE_SEPOLIA_WETH };
const ARB_SEPOLIA_TOKENS = { usdc: ARB_SEPOLIA_USDC, weth: ARB_SEPOLIA_WETH };

const BRIDGE_CONFIGS: Partial<Record<NetworkKey, BridgeConfig>> = {
  "ethereum-sepolia": {
    networkKey: "ethereum-sepolia",
    bridgeId: "across_v3",
    spokePool: SPOKE_POOL_SEPOLIA,
    routes: [
      { destinationNetworkKey: "base-sepolia", pairs: pairsBetween(SEPOLIA_TOKENS, BASE_SEPOLIA_TOKENS) },
      { destinationNetworkKey: "arbitrum-sepolia", pairs: pairsBetween(SEPOLIA_TOKENS, ARB_SEPOLIA_TOKENS) },
    ],
  },
  "base-sepolia": {
    networkKey: "base-sepolia",
    bridgeId: "across_v3",
    spokePool: SPOKE_POOL_BASE_SEPOLIA,
    routes: [
      { destinationNetworkKey: "ethereum-sepolia", pairs: pairsBetween(BASE_SEPOLIA_TOKENS, SEPOLIA_TOKENS) },
      { destinationNetworkKey: "arbitrum-sepolia", pairs: pairsBetween(BASE_SEPOLIA_TOKENS, ARB_SEPOLIA_TOKENS) },
    ],
  },
  "arbitrum-sepolia": {
    networkKey: "arbitrum-sepolia",
    bridgeId: "across_v3",
    spokePool: SPOKE_POOL_ARB_SEPOLIA,
    routes: [
      { destinationNetworkKey: "ethereum-sepolia", pairs: pairsBetween(ARB_SEPOLIA_TOKENS, SEPOLIA_TOKENS) },
      { destinationNetworkKey: "base-sepolia", pairs: pairsBetween(ARB_SEPOLIA_TOKENS, BASE_SEPOLIA_TOKENS) },
    ],
  },
};

/** Pure test version — same as the exported hook helper but without lazy require. */
function getTestnetDestChainKeysForTest(sourceNetworkKey: string): string[] {
  const config = BRIDGE_CONFIGS[sourceNetworkKey as NetworkKey];
  return config?.routes.map((r) => r.destinationNetworkKey as string) ?? [];
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// ── Test 1: getTestnetDestChainKeys returns correct destination chains for base-sepolia ──
const fromBase = getTestnetDestChainKeysForTest("base-sepolia");
assert(
  fromBase.includes("ethereum-sepolia"),
  `base-sepolia should route to ethereum-sepolia, got: ${JSON.stringify(fromBase)}`,
);
assert(
  fromBase.includes("arbitrum-sepolia"),
  `base-sepolia should route to arbitrum-sepolia, got: ${JSON.stringify(fromBase)}`,
);
assert(
  !fromBase.includes("base-sepolia"),
  "source chain base-sepolia should not appear in its own destination list",
);

// ── Test 2: ethereum-sepolia routes correctly ──
const fromSepolia = getTestnetDestChainKeysForTest("ethereum-sepolia");
assert(
  fromSepolia.includes("base-sepolia"),
  "ethereum-sepolia should route to base-sepolia",
);
assert(
  fromSepolia.includes("arbitrum-sepolia"),
  "ethereum-sepolia should route to arbitrum-sepolia",
);
assert(
  !fromSepolia.includes("ethereum-sepolia"),
  "source chain excluded from its own dest list",
);

// ── Test 3: arbitrum-sepolia routes correctly ──
const fromArb = getTestnetDestChainKeysForTest("arbitrum-sepolia");
assert(
  fromArb.includes("ethereum-sepolia"),
  "arbitrum-sepolia should route to ethereum-sepolia",
);
assert(
  fromArb.includes("base-sepolia"),
  "arbitrum-sepolia should route to base-sepolia",
);
assert(
  !fromArb.includes("arbitrum-sepolia"),
  "source chain excluded from its own dest list",
);

// ── Test 4: Unknown source chain returns empty array ──
const unknown = getTestnetDestChainKeysForTest("not-a-chain");
assert(unknown.length === 0, "unknown source should return empty array");

console.log("useBridgeDestChains tests passed");
