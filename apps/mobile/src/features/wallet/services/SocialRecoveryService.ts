import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import {
  buildInstallRecoveryModuleUserOp,
  buildSmartAccountExecuteUserOp,
  encodeSocialRecoveryInitData,
  getDeployment,
  isExecutorModuleInstalled,
  submitConfiguredUserOp,
} from "@/src/integration/viem";
import { type Address, type Hex, keccak256, encodeAbiParameters, parseAbiParameters, encodeFunctionData } from "viem";
import type { UserOperation } from "viem/account-abstraction";
import { ABIS } from "@/src/integration/viem/abis";

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

export type PasskeyInit = {
  idRaw: Hex;
  px: bigint;
  py: bigint;
};

export type GuardianSig = {
  index: number;
  kind: number; // 0=EOA_ECDSA, 1=ERC1271, 2=APPROVE_HASH
  sig: Hex;
};

const SOCIAL_RECOVERY_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "wallet", "type": "address" },
      {
        "components": [
          { "internalType": "bytes32", "name": "idRaw", "type": "bytes32" },
          { "internalType": "uint256", "name": "px", "type": "uint256" },
          { "internalType": "uint256", "name": "py", "type": "uint256" }
        ],
        "internalType": "struct PasskeyTypes.PasskeyInit",
        "name": "newPassKey",
        "type": "tuple"
      },
      {
        "components": [
          { "internalType": "uint16", "name": "index", "type": "uint16" },
          { "internalType": "enum ISocialRecovery.SigKind", "name": "kind", "type": "uint8" },
          { "internalType": "bytes", "name": "sig", "type": "bytes" }
        ],
        "internalType": "struct ISocialRecovery.GuardianSig[]",
        "name": "sigs",
        "type": "tuple[]"
      }
    ],
    "name": "scheduleRecovery",
    "outputs": [{ "internalType": "bytes32", "name": "recoveryId", "type": "bytes32" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "wallet", "type": "address" },
      {
        "components": [
          { "internalType": "bytes32", "name": "idRaw", "type": "bytes32" },
          { "internalType": "uint256", "name": "px", "type": "uint256" },
          { "internalType": "uint256", "name": "py", "type": "uint256" }
        ],
        "internalType": "struct PasskeyTypes.PasskeyInit",
        "name": "newPassKey",
        "type": "tuple"
      }
    ],
    "name": "executeRecovery",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "wallet", "type": "address" },
      {
        "components": [
          { "internalType": "bytes32", "name": "idRaw", "type": "bytes32" },
          { "internalType": "uint256", "name": "px", "type": "uint256" },
          { "internalType": "uint256", "name": "py", "type": "uint256" }
        ],
        "internalType": "struct PasskeyTypes.PasskeyInit",
        "name": "newPassKey",
        "type": "tuple"
      }
    ],
    "name": "getRecoveryDigest",
    "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

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
    const deployment = getDeployment(chainId);
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }
    const initData = encodeSocialRecoveryInitData(params.guardians, params.threshold);

    const { userOp, userOpHash } = await buildInstallRecoveryModuleUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      moduleAddress: deployment.socialRecovery as Address,
      initData,
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
    if (!params.signedUserOp.signature || params.signedUserOp.signature === "0x") {
      throw new Error("Signed UserOperation must include a signature before submission");
    }
    return submitConfiguredUserOp(params.signedUserOp, chainId, bundlerUrl);
  }

  static async isModuleInstalled(
    smartAccountAddress: Address,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<boolean> {
    const deployment = getDeployment(chainId);
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }
    return isExecutorModuleInstalled({
      chainId,
      smartAccountAddress,
      moduleAddress: deployment.socialRecovery as Address,
    });
  }

  /**
   * Builds a UserOperation for a guardian to schedule recovery.
   */
  static async buildScheduleRecoveryUserOp(params: {
    smartAccountAddress: Address;
    accountToRecover: Address;
    newPassKey: PasskeyInit;
    sigs: GuardianSig[];
    passkeyId: Hex;
    chainId?: SupportedChainId;
    bundlerUrl?: string;
    usePaymaster?: boolean;
    paymasterUrl?: string;
  }): Promise<SocialRecoveryInstallResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const deployment = getDeployment(chainId);
    
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }

    const scheduleCalldata = encodeFunctionData({
      abi: SOCIAL_RECOVERY_ABI,
      functionName: "scheduleRecovery",
      args: [params.accountToRecover, params.newPassKey, params.sigs],
    });

    const callData = encodeFunctionData({
      abi: ABIS.smartAccount,
      functionName: "execute",
      args: [deployment.socialRecovery as Address, 0n, scheduleCalldata],
    });

    const { userOp, userOpHash } = await buildSmartAccountExecuteUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      callData,
      passkeyId: params.passkeyId,
      usePaymaster: params.usePaymaster,
      paymasterUrl: params.paymasterUrl,
      operationLabel: "scheduleRecovery",
    });

    return { userOp, userOpHash };
  }

  /**
   * Builds a UserOperation to execute a previously scheduled recovery.
   */
  static async buildExecuteRecoveryUserOp(params: {
    smartAccountAddress: Address;
    accountToRecover: Address;
    newPassKey: PasskeyInit;
    passkeyId: Hex;
    chainId?: SupportedChainId;
    bundlerUrl?: string;
    usePaymaster?: boolean;
    paymasterUrl?: string;
  }): Promise<SocialRecoveryInstallResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl();
    const deployment = getDeployment(chainId);
    
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }

    const executeCalldata = encodeFunctionData({
      abi: SOCIAL_RECOVERY_ABI,
      functionName: "executeRecovery",
      args: [params.accountToRecover, params.newPassKey],
    });

    const callData = encodeFunctionData({
      abi: ABIS.smartAccount,
      functionName: "execute",
      args: [deployment.socialRecovery as Address, 0n, executeCalldata],
    });

    const { userOp, userOpHash } = await buildSmartAccountExecuteUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      callData,
      passkeyId: params.passkeyId,
      usePaymaster: params.usePaymaster,
      paymasterUrl: params.paymasterUrl,
      operationLabel: "executeRecovery",
    });

    return { userOp, userOpHash };
  }
}
