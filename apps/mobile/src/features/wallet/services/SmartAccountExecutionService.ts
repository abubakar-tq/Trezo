import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import type { SupportedChainId } from "@/src/integration/chains";
import { getNetworkConfig, getBundlerUrlForNetwork } from "@/src/integration/networks";
import type { NetworkKey } from "@/src/integration/networks";
import { getDeployment, buildSmartAccountExecutionUserOp, submitConfiguredUserOp, waitForUserOperationReceipt } from "@/src/integration/viem";
import { getDeploymentForNetwork } from "@/src/integration/viem/deployments";
import LocalPasskeyService from "@/src/features/wallet/services/PasskeyService";
import type { PreparedSmartAccountExecution, PreparedUserOperation, SignedUserOperation } from "@/src/features/wallet/types/execution";
import type { Hex } from "viem";
import type { UserOperationReceipt } from "viem/account-abstraction";

export type PrepareUserOperationOptions = {
  userId: string;
  bundlerUrl?: string;
  paymasterUrl?: string;
  usePaymaster?: boolean;
  nonce?: bigint;
  nonceKey?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
};

export type UserOperationSubmission = SignedUserOperation & {
  submittedUserOpHash: Hex;
};

export type UserOperationReceiptResult = {
  submittedUserOpHash: Hex;
  receipt: UserOperationReceipt<"0.7">;
  transactionHash?: Hex;
  blockNumber?: bigint;
  success: boolean;
};

const resolveBundlerUrl = (
  chainId: SupportedChainId,
  override?: string,
  networkKey?: NetworkKey,
): string => {
  if (override) return override;
  // Prefer network-key resolution (fork-aware)
  if (networkKey) {
    try {
      return getBundlerUrlForNetwork(networkKey);
    } catch {
      // Fallback to chain-id
    }
  }
  return getBundlerUrl(chainId);
};

const resolvePaymasterUrl = (
  chainId: SupportedChainId,
  usePaymaster?: boolean,
  override?: string,
  networkKey?: NetworkKey,
): string | undefined => {
  if (!usePaymaster) return undefined;
  if (override) return override;
  // For fork networks, paymaster is optional (defaultUsePaymaster)
  if (networkKey) {
    try {
      const config = getNetworkConfig(networkKey);
      return config.paymasterUrl;
    } catch {
      // Fallback to chain-id
    }
  }
  try {
    return getPaymasterUrl(chainId);
  } catch {
    return undefined;
  }
};

const getEntryPointAddress = (chainId: SupportedChainId, networkKey?: NetworkKey) => {
  // Try network-key-aware deployment first
  if (networkKey) {
    const dep = getDeploymentForNetwork(networkKey);
    if (dep?.entryPoint) return dep.entryPoint;
  }
  const deployment = getDeployment(chainId as never);
  if (!deployment?.entryPoint) {
    throw new Error(`Deployment is missing entry point for chain ${chainId}`);
  }
  return deployment.entryPoint;
};

const getSuccessFlag = (receipt: UserOperationReceipt<"0.7">): boolean => {
  const directSuccess = (receipt as { success?: boolean }).success;
  if (typeof directSuccess === "boolean") {
    return directSuccess;
  }

  const status = (receipt.receipt as { status?: unknown }).status;
  if (typeof status === "string") {
    return status.toLowerCase() === "success";
  }
  if (typeof status === "bigint") {
    return status === 1n;
  }
  if (typeof status === "number") {
    return status === 1;
  }

  return false;
};

export class SmartAccountExecutionService {
  static async prepareUserOperation(
    execution: PreparedSmartAccountExecution,
    options: PrepareUserOperationOptions,
  ): Promise<PreparedUserOperation> {
    const passkey = await LocalPasskeyService.getPasskey(options.userId);
    if (!passkey?.credentialIdRaw) {
      throw new Error("No local passkey found for this user. Create a passkey before sending.");
    }

    const bundlerUrl = resolveBundlerUrl(execution.chainId, options.bundlerUrl, execution.networkKey);
    const paymasterUrl = resolvePaymasterUrl(execution.chainId, options.usePaymaster, options.paymasterUrl, execution.networkKey);

    const { userOp, userOpHash } = await buildSmartAccountExecutionUserOp({
      chainId: execution.chainId,
      bundlerUrl,
      smartAccountAddress: execution.account,
      target: execution.target,
      value: execution.value,
      data: execution.data,
      passkeyId: passkey.credentialIdRaw as Hex,
      nonce: options.nonce,
      nonceKey: options.nonceKey,
      usePaymaster: options.usePaymaster,
      paymasterUrl,
      maxFeePerGas: options.maxFeePerGas,
      maxPriorityFeePerGas: options.maxPriorityFeePerGas,
      callGasLimit: options.callGasLimit,
      verificationGasLimit: options.verificationGasLimit,
      preVerificationGas: options.preVerificationGas,
      operationLabel: execution.operationLabel,
    });

    return {
      chainId: execution.chainId,
      account: execution.account,
      entryPoint: getEntryPointAddress(execution.chainId, execution.networkKey),
      bundlerUrl,
      paymasterUrl,
      userOp,
      userOpHash,
      execution,
    };
  }

  static async signUserOperation(
    userId: string,
    prepared: PreparedUserOperation,
  ): Promise<SignedUserOperation> {
    const signature = await LocalPasskeyService.signWithPasskey(userId, prepared.userOpHash);
    const encodedSignature = LocalPasskeyService.encodeSignatureForContract(signature) as Hex;

    return {
      ...prepared,
      signature: encodedSignature,
      signedUserOp: {
        ...prepared.userOp,
        signature: encodedSignature,
      },
    };
  }

  static async submitUserOperation(
    signed: SignedUserOperation,
  ): Promise<UserOperationSubmission> {
    const submittedUserOpHash = await submitConfiguredUserOp(
      signed.signedUserOp,
      signed.chainId,
      signed.bundlerUrl,
    );

    return {
      ...signed,
      submittedUserOpHash,
    };
  }

  static async waitForReceipt(
    submission: UserOperationSubmission,
    options?: { timeoutMs?: number; pollIntervalMs?: number },
  ): Promise<UserOperationReceiptResult> {
    const receipt = await waitForUserOperationReceipt(
      submission.submittedUserOpHash,
      submission.chainId,
      submission.bundlerUrl,
      options?.timeoutMs,
      options?.pollIntervalMs,
    );

    return {
      submittedUserOpHash: submission.submittedUserOpHash,
      receipt,
      transactionHash: receipt.receipt?.transactionHash as Hex | undefined,
      blockNumber: receipt.receipt?.blockNumber,
      success: getSuccessFlag(receipt),
    };
  }
}
