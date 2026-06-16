// Chain-aware thin wrapper around userOps.ts primitives.
// Every bundler/paymaster/chain lookup is resolved from getNetwork(chainId)
// so a tx built for chain A is always sponsored and submitted on chain A.

import type { Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";
import {
  buildSmartAccountExecutionUserOp,
  submitConfiguredUserOp,
  waitForUserOperationReceipt,
} from "./userOps";
import { getNetwork } from "./networks";
import { encodeSignatureForContract, type PasskeySignature } from "../passkey/encode";

const ENTRY_POINT_VERSION = "0.7" as const;

export async function prepareDappTx(params: {
  chainId: number;
  account: `0x${string}`;
  passkeyIdRaw: Hex;
  to: `0x${string}`;
  value: bigint;
  data: Hex;
}): Promise<{ userOp: UserOperation<typeof ENTRY_POINT_VERSION>; userOpHash: Hex }> {
  const net = getNetwork(params.chainId);
  const { userOp, userOpHash } = await buildSmartAccountExecutionUserOp({
    chainId: params.chainId,
    bundlerUrl: net.bundlerUrl,
    smartAccountAddress: params.account,
    target: params.to,
    value: params.value,
    data: params.data,
    passkeyId: params.passkeyIdRaw,
    usePaymaster: true,
    paymasterUrl: net.paymasterUrl,
    operationLabel: "dappSendTransaction",
  });
  return { userOp, userOpHash };
}

export async function submitDappTx(
  chainId: number,
  prepared: { userOp: UserOperation<typeof ENTRY_POINT_VERSION>; userOpHash: Hex },
  signature: PasskeySignature,
): Promise<Hex> {
  const net = getNetwork(chainId);
  const signedUserOp: UserOperation<typeof ENTRY_POINT_VERSION> = {
    ...prepared.userOp,
    signature: encodeSignatureForContract(signature),
  };
  return submitConfiguredUserOp(signedUserOp, chainId, net.bundlerUrl) as Promise<Hex>;
}

export async function waitForTx(chainId: number, userOpHash: Hex) {
  const net = getNetwork(chainId);
  return waitForUserOperationReceipt(userOpHash, chainId, net.bundlerUrl);
}
