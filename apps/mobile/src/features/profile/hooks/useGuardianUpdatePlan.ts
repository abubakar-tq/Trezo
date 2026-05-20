import { getAddress, isAddress } from "viem";
import type { Address } from "viem";

export type GuardianUpdateOp =
  | { kind: "add"; guardians: Address[]; threshold: bigint }
  | { kind: "remove"; guardians: Address[]; threshold: bigint };

export type GuardianUpdatePlan = {
  ops: GuardianUpdateOp[];
  signatureCount: 1 | 2;
};

export type PlanInput = {
  current: readonly Address[];
  currentThreshold: bigint;
  proposed: readonly Address[];
  proposedThreshold: bigint;
};

export type PlanError =
  | { code: "EMPTY_FINAL"; message: string }
  | { code: "THRESHOLD_RANGE"; message: string }
  | { code: "DUPLICATE_PROPOSED"; message: string }
  | { code: "INVALID_ADDRESS"; message: string }
  | { code: "NO_CHANGE"; message: string };

export type PlanResult =
  | { ok: true; plan: GuardianUpdatePlan }
  | { ok: false; error: PlanError };

function normalize(addrs: readonly Address[]): Address[] {
  return addrs.map((a) => getAddress(a));
}

export function planGuardianUpdate(input: PlanInput): PlanResult {
  for (const a of input.proposed) {
    if (!isAddress(a)) {
      return { ok: false, error: { code: "INVALID_ADDRESS", message: `Not a valid address: ${a}` } };
    }
  }

  const current = normalize(input.current);
  const proposed = normalize(input.proposed);

  const seen = new Set<string>();
  for (const a of proposed) {
    if (seen.has(a)) {
      return { ok: false, error: { code: "DUPLICATE_PROPOSED", message: `Duplicate address in proposed set: ${a}` } };
    }
    seen.add(a);
  }

  const currentSet = new Set(current);
  const proposedSet = new Set(proposed);
  const toAdd = proposed.filter((a) => !currentSet.has(a));
  const toRemove = current.filter((a) => !proposedSet.has(a));

  if (toRemove.length === current.length && toAdd.length > 0) {
    return {
      ok: false,
      error: {
        code: "EMPTY_FINAL",
        message: "Cannot replace all guardians at once — keep at least one existing guardian, then update again to swap the last.",
      },
    };
  }

  const finalCount = current.length - toRemove.length + toAdd.length;
  if (finalCount < 1) {
    return { ok: false, error: { code: "EMPTY_FINAL", message: "Final guardian set must have at least one guardian" } };
  }
  if (input.proposedThreshold < 1n || input.proposedThreshold > BigInt(finalCount)) {
    return {
      ok: false,
      error: {
        code: "THRESHOLD_RANGE",
        message: `Threshold must be between 1 and ${finalCount} (got ${input.proposedThreshold.toString()})`,
      },
    };
  }

  const thresholdChanged = input.proposedThreshold !== input.currentThreshold;
  if (toAdd.length === 0 && toRemove.length === 0 && !thresholdChanged) {
    return { ok: false, error: { code: "NO_CHANGE", message: "No changes to apply" } };
  }

  const finalThreshold = input.proposedThreshold;
  if (toAdd.length > 0 && toRemove.length > 0) {
    const intermediateCount = current.length - toRemove.length;
    const intermediateThreshold = finalThreshold > BigInt(intermediateCount)
      ? BigInt(intermediateCount)
      : finalThreshold;
    return {
      ok: true,
      plan: {
        signatureCount: 2,
        ops: [
          { kind: "remove", guardians: toRemove, threshold: intermediateThreshold },
          { kind: "add", guardians: toAdd, threshold: finalThreshold },
        ],
      },
    };
  }
  if (toRemove.length > 0) {
    return {
      ok: true,
      plan: { signatureCount: 1, ops: [{ kind: "remove", guardians: toRemove, threshold: finalThreshold }] },
    };
  }
  if (toAdd.length > 0) {
    return {
      ok: true,
      plan: { signatureCount: 1, ops: [{ kind: "add", guardians: toAdd, threshold: finalThreshold }] },
    };
  }
  return {
    ok: true,
    plan: { signatureCount: 1, ops: [{ kind: "add", guardians: [], threshold: finalThreshold }] },
  };
}

if (__DEV__) {
  const G = (n: number): Address => getAddress(`0x${n.toString(16).padStart(40, "0")}`);
  const r1 = planGuardianUpdate({
    current: [G(1), G(2)], currentThreshold: 2n,
    proposed: [G(1), G(2), G(3)], proposedThreshold: 2n,
  });
  console.assert(r1.ok && r1.plan.signatureCount === 1 && r1.plan.ops[0].kind === "add", "add-only");

  const r2 = planGuardianUpdate({
    current: [G(1), G(2), G(3)], currentThreshold: 2n,
    proposed: [G(1), G(2)], proposedThreshold: 2n,
  });
  console.assert(r2.ok && r2.plan.signatureCount === 1 && r2.plan.ops[0].kind === "remove", "remove-only");

  const r3 = planGuardianUpdate({
    current: [G(1), G(2), G(3)], currentThreshold: 2n,
    proposed: [G(1), G(2), G(3)], proposedThreshold: 3n,
  });
  console.assert(
    r3.ok && r3.plan.signatureCount === 1 && r3.plan.ops[0].kind === "add" && r3.plan.ops[0].guardians.length === 0,
    "threshold-only",
  );

  const r4 = planGuardianUpdate({
    current: [G(1), G(2), G(3)], currentThreshold: 2n,
    proposed: [G(1), G(2), G(4)], proposedThreshold: 2n,
  });
  console.assert(r4.ok && r4.plan.signatureCount === 2, "add+remove");

  const r7 = planGuardianUpdate({
    current: [G(1)], currentThreshold: 1n,
    proposed: [], proposedThreshold: 1n,
  });
  console.assert(!r7.ok && r7.error.code === "EMPTY_FINAL", "empty final rejected");

  const r8 = planGuardianUpdate({
    current: [G(1), G(2)], currentThreshold: 2n,
    proposed: [G(1), G(2)], proposedThreshold: 3n,
  });
  console.assert(!r8.ok && r8.error.code === "THRESHOLD_RANGE", "threshold > count rejected");

  const r9 = planGuardianUpdate({
    current: [G(1)], currentThreshold: 1n,
    proposed: [G(2), G(2)], proposedThreshold: 1n,
  });
  console.assert(!r9.ok && r9.error.code === "DUPLICATE_PROPOSED", "duplicates rejected");

  const r10 = planGuardianUpdate({
    current: [G(1), G(2)], currentThreshold: 1n,
    proposed: [G(3), G(4)], proposedThreshold: 1n,
  });
  console.assert(!r10.ok && r10.error.code === "EMPTY_FINAL", "complete-replacement rejected");
}
