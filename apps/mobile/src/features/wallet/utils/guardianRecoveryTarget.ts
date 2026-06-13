/**
 * Shared decision for "can this device reach the guardian-recovery config screen?".
 *
 * GuardianRecoveryScreen blocks rendering when `!canSignForWallet` ("This device
 * cannot manage guardians yet"). Entry points that navigate INTO that screen
 * (RecoveryEntryScreen, CompromisedWalletScreen) historically used a weaker
 * local-passkey-presence check, so they routed devices into a guaranteed
 * dead-end. This module centralises the gate on the SAME on-chain signer-authority
 * signal the destination enforces, so the two can never disagree.
 *
 * The pure decision (`deviceCanManageGuardians`) and the orchestration
 * (`resolveGuardianRecoveryTarget`, with the status fetcher injected) are kept
 * free of native value imports so they unit-test under the plain `tsx` convention.
 */
import type { LocalWalletSignerStatus } from "../services/LocalSignerService";
import type { Address } from "viem";
import type { SupportedChainId } from "../../../integration/chains";

/**
 * Mirrors exactly what GuardianRecoveryScreen blocks on (`!canSignForWallet`).
 * Keeping this in one place means RecoveryEntry/CompromisedWallet cannot drift
 * from the destination's own precondition.
 */
export function deviceCanManageGuardians(
  status: Pick<LocalWalletSignerStatus, "canSignForWallet">,
): boolean {
  return status.canSignForWallet === true;
}

export type GuardianRecoveryTargetParams = {
  userId?: string | null;
  smartAccountAddress?: Address | null;
  chainId?: SupportedChainId | null;
  expectedPasskeyId?: string | null;
};

export type GuardianRecoveryTargetResult = {
  canManage: boolean;
  status: LocalWalletSignerStatus;
};

/**
 * Resolves whether a device should be sent to GuardianRecovery (canManage=true)
 * or routed to the recovery/link path instead. The signer-status fetcher is
 * injected (callers pass `LocalSignerService.getWalletSignerStatus`) so this
 * orchestration is testable without the native viem/passkey stack.
 */
export async function resolveGuardianRecoveryTarget(
  params: GuardianRecoveryTargetParams,
  getStatus: (p: GuardianRecoveryTargetParams) => Promise<LocalWalletSignerStatus>,
): Promise<GuardianRecoveryTargetResult> {
  const status = await getStatus(params);
  return { canManage: deviceCanManageGuardians(status), status };
}
