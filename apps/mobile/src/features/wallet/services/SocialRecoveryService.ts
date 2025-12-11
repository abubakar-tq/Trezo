import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import {
  buildInstallSocialRecoveryUserOp,
  encodeSocialRecoveryInitData,
  getDeployment,
  sendUserOp,
} from "@/src/integration/viem";
import type { Address, Hex } from "viem";
import type { UserOperation } from "viem/account-abstraction";

export type SocialRecoveryInstallRequest = {
  smartAccountAddress: Address;
  guardians: readonly Address[];
  threshold: number | bigint;
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

export type SocialRecoveryInstallResponse = {
  userOp: UserOperation<"0.7">;
  userOpHash: Hex;
};

export type SocialRecoverySubmitRequest = {
  signedUserOp: UserOperation<"0.7">;
  chainId?: SupportedChainId;
  bundlerUrl?: string;
};

export class SocialRecoveryService {
  static encodeInitData(guardians: readonly Address[], threshold: number | bigint): Hex {
    return encodeSocialRecoveryInitData(guardians, threshold);
  }

  static async buildInstallModuleUserOp(
    params: SocialRecoveryInstallRequest,
  ): Promise<SocialRecoveryInstallResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl()
      : params.paymasterUrl;

    const { userOp, userOpHash } = await buildInstallSocialRecoveryUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      guardians: params.guardians,
      threshold: params.threshold,
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

  static async submitInstallModuleUserOp(params: SocialRecoverySubmitRequest): Promise<Hex> {
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
}
