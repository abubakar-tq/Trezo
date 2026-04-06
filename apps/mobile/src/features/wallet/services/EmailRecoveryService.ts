import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import {
  ABIS,
  buildInstallEmailRecoveryUserOp,
  encodeEmailRecoveryInitData,
  getDeployment,
  getPublicClient,
  sendUserOp,
} from "@/src/integration/viem";
import type { Address, Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

const MODULE_TYPE_EXECUTOR = 2n;

export type EmailRecoveryInstallRequest = {
  smartAccountAddress: Address;
  guardians: readonly Address[];
  weights?: readonly (number | bigint)[];
  threshold: number | bigint;
  delay: number | bigint;
  expiry: number | bigint;
  passkeyId: Hex;
  chainId?: SupportedChainId;
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

export type EmailRecoveryInstallResponse = {
  userOp: UserOperation<"0.7">;
  userOpHash: Hex;
};

export type EmailRecoverySubmitRequest = {
  signedUserOp: UserOperation<"0.7">;
  chainId?: SupportedChainId;
  bundlerUrl?: string;
};

export class EmailRecoveryService {
  static encodeInitData(
    guardians: readonly Address[],
    weights: readonly (number | bigint)[],
    threshold: number | bigint,
    delay: number | bigint,
    expiry: number | bigint,
  ): Hex {
    return encodeEmailRecoveryInitData(guardians, weights, threshold, delay, expiry);
  }

  static async buildInstallModuleUserOp(
    params: EmailRecoveryInstallRequest,
  ): Promise<EmailRecoveryInstallResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl()
      : params.paymasterUrl;
    const weights = params.weights ?? params.guardians.map(() => 1n);

    const { userOp, userOpHash } = await buildInstallEmailRecoveryUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      guardians: params.guardians,
      weights,
      threshold: params.threshold,
      delay: params.delay,
      expiry: params.expiry,
      passkeyId: params.passkeyId,
      nonce: params.nonce,
      nonceKey: params.nonceKey,
      usePaymaster: params.usePaymaster,
      paymasterUrl,
      maxFeePerGas: params.maxFeePerGas,
      maxPriorityFeePerGas: params.maxPriorityFeePerGas,
      callGasLimit: params.callGasLimit,
      verificationGasLimit: params.verificationGasLimit,
      preVerificationGas: params.preVerificationGas,
    });

    return { userOp, userOpHash };
  }

  static async submitInstallModuleUserOp(params: EmailRecoverySubmitRequest): Promise<Hex> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const deployment = getDeployment(chainId);
    if (!deployment?.entryPoint) {
      throw new Error(`No deployment entry point configured for chain ${chainId}`);
    }
    if (!params.signedUserOp.signature || params.signedUserOp.signature === "0x") {
      throw new Error("Signed UserOperation must include a signature before submission");
    }
    return sendUserOp(params.signedUserOp, chainId, bundlerUrl, deployment.entryPoint);
  }

  static async isModuleInstalled(
    smartAccountAddress: Address,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<boolean> {
    const deployment = getDeployment(chainId);
    if (!deployment?.emailRecovery) {
      throw new Error(`No Email Recovery module configured for chain ${chainId}`);
    }
    const client = getPublicClient(chainId);
    return client.readContract({
      address: smartAccountAddress,
      abi: ABIS.smartAccount,
      functionName: "isModuleInstalled",
      args: [MODULE_TYPE_EXECUTOR, deployment.emailRecovery, "0x"],
    }) as Promise<boolean>;
  }
}
