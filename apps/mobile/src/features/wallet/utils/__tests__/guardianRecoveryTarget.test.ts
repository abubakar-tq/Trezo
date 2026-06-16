import {
  deviceCanManageGuardians,
  resolveGuardianRecoveryTarget,
} from "../guardianRecoveryTarget";

// ── tiny assert helpers ────────────────────────────────────────────────────────
let passed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    console.error(
      `FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`,
    );
    process.exit(1);
  }
  passed++;
}

console.log("running guardianRecoveryTarget.test.ts");

// deviceCanManageGuardians mirrors exactly what GuardianRecoveryScreen blocks on
// (!canSignForWallet), so RecoveryEntry/CompromisedWallet never route a device
// into the "This device cannot manage guardians yet" dead-end.
assertEqual(deviceCanManageGuardians({ canSignForWallet: true }), true, "canSign true -> can manage");
assertEqual(deviceCanManageGuardians({ canSignForWallet: false }), false, "canSign false -> cannot manage");

void (async () => {
  const verified = {
    hasLocalPasskey: true,
    localPasskeyId: "0xabc" as `0x${string}`,
    canSignForWallet: true,
    walletDeployedOnChain: true,
    metadataMatchesWallet: true,
    reason: "verified" as const,
    verificationError: null,
  };
  const blocked = { ...verified, canSignForWallet: false, reason: "onchain_passkey_missing" as const };

  const r1 = await resolveGuardianRecoveryTarget({ userId: "u" }, async () => verified);
  assertEqual(r1.canManage, true, "verified status -> canManage true");
  assertEqual(r1.status.reason, "verified", "result carries the resolved status");

  const r2 = await resolveGuardianRecoveryTarget({ userId: "u" }, async () => blocked);
  assertEqual(r2.canManage, false, "onchain_passkey_missing -> canManage false");

  // forwards the lookup params unchanged to the injected status fetcher
  let received: { smartAccountAddress?: unknown; expectedPasskeyId?: unknown; chainId?: unknown } | null = null;
  await resolveGuardianRecoveryTarget(
    {
      userId: "u",
      smartAccountAddress: "0xabc" as `0x${string}`,
      chainId: 84532 as never,
      expectedPasskeyId: "0xdef",
    },
    async (p) => {
      received = p;
      return blocked;
    },
  );
  assertEqual(received?.smartAccountAddress, "0xabc", "forwards smartAccountAddress");
  assertEqual(received?.expectedPasskeyId, "0xdef", "forwards expectedPasskeyId");
  assertEqual(received?.chainId, 84532, "forwards chainId");

  console.log(`OK guardianRecoveryTarget.test.ts (${passed} assertions)`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
