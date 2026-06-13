import { txRowLabel, formatGasFee } from "../txFormatters";

// ── tiny assert helpers ──────────────────────────────────────────────────────
let passed = 0;

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    console.error(
      `FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
    );
    process.exit(1);
  }
  passed++;
}

function assertNull(actual: unknown, label: string): void {
  if (actual !== null) {
    console.error(
      `FAIL: ${label}\n  expected: null\n  actual:   ${JSON.stringify(actual)}`,
    );
    process.exit(1);
  }
  passed++;
}

// ── txRowLabel ───────────────────────────────────────────────────────────────

assertEqual(txRowLabel("outgoing", "send_native", "ETH"), "Sent ETH", "outgoing native");
assertEqual(txRowLabel("incoming", "send_native", "ETH"), "Received ETH", "incoming native");
assertEqual(txRowLabel("outgoing", "send_erc20", "USDC"), "Sent USDC", "outgoing erc20");
assertEqual(txRowLabel("incoming", "send_erc20", "USDC"), "Received USDC", "incoming erc20");
assertEqual(txRowLabel("outgoing", "send_native", null), "Sent", "outgoing native no sym");
assertEqual(txRowLabel("incoming", "send_erc20", null), "Received", "incoming erc20 no sym");
assertEqual(txRowLabel("outgoing", "swap", "ETH"), "Swapped", "swap");
assertEqual(txRowLabel("outgoing", "cross_chain_swap", "ETH"), "Cross-chain Swap", "cross chain");
assertEqual(txRowLabel("outgoing", "bridge", "ETH"), "Bridged", "bridge");
assertEqual(txRowLabel("outgoing", "token_approval", "USDC"), "Approved", "approval");
assertEqual(txRowLabel("outgoing", "module_install", null), "Module Install", "module install");
assertEqual(txRowLabel("outgoing", "recovery", null), "Recovery", "recovery");

// ── formatGasFee ─────────────────────────────────────────────────────────────

// 21000 gas * 1 gwei (1e9) = 21000e9 wei = 0.000021 ETH
assertEqual(formatGasFee("21000", "1000000000"), "0.000021", "standard 21k gas @ 1gwei");

// 0 gas fee
assertEqual(formatGasFee("0", "1000000000"), "0", "zero gas");

// null inputs
assertNull(formatGasFee(null, "1000000000"), "null gasUsed");
assertNull(formatGasFee("21000", null), "null priceWei");
assertNull(formatGasFee(null, null), "both null");

// 1 ETH exactly
assertEqual(formatGasFee("1000000000000000000", "1"), "1", "1 ETH exactly");

// ─────────────────────────────────────────────────────────────────────────────
console.log(`All ${passed} assertions passed.`);
