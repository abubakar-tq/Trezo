import type { SupportedChainId } from "@/src/integration/chains";
import type { Address, Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

export type PreparedSmartAccountExecution = {
  chainId: SupportedChainId;
  account: Address;
  target: Address;
  value: bigint;
  data: Hex;
  operationLabel: string;
  riskLevel: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
};

export type PreparedUserOperation = {
  chainId: SupportedChainId;
  account: Address;
  entryPoint: Address;
  bundlerUrl: string;
  paymasterUrl?: string;
  userOp: UserOperation<"0.7">;
  userOpHash: Hex;
  execution: PreparedSmartAccountExecution;
};

export type SignedUserOperation = PreparedUserOperation & {
  signature: Hex;
  signedUserOp: UserOperation<"0.7">;
};
