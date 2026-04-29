import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { ABIS } from "@/src/integration/viem/abis";
import {
  buildInstallRecoveryModuleUserOp,
  encodeSocialRecoveryInitData,
  getDeployment,
  getPublicClient,
  isExecutorModuleInstalled,
  submitConfiguredUserOp,
  waitForUserOperationReceipt,
} from "@/src/integration/viem";
import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";
import type { UserOperation, UserOperationReceipt } from "viem/account-abstraction";

export type SocialRecoveryInstallRequest = {
  smartAccountAddress: Address;
  guardians: readonly Address[];
  threshold: number | bigint;
  timelockSeconds?: number | bigint;
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

export type RecoveryHashes = {
  guardianSetHash: Hex;
  policyHash: Hex;
};

export type RecoveryDetailsState = {
  guardians: Address[];
  threshold: bigint;
  timelockSeconds: bigint;
};

export type ActiveRecoveryState = {
  recoveryId: Hex;
  executeAfter: bigint;
};

export type MultiChainRecoveryState = RecoveryDetailsState & {
  chainId: SupportedChainId;
  accountDeployed: boolean;
  moduleInstalled: boolean;
  moduleConfigured: boolean;
  nonce: bigint;
  hashes: RecoveryHashes;
  activeRecovery: ActiveRecoveryState | null;
};

const DEFAULT_TIMELOCK_SECONDS = 86400n;

export class SocialRecoveryService {
  static encodeInitData(
    guardians: readonly Address[],
    threshold: number | bigint,
    timelockSeconds: number | bigint = DEFAULT_TIMELOCK_SECONDS,
  ): Hex {
    return encodeSocialRecoveryInitData(guardians, threshold, timelockSeconds);
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
    const initData = encodeSocialRecoveryInitData(
      params.guardians,
      params.threshold,
      params.timelockSeconds ?? DEFAULT_TIMELOCK_SECONDS,
    );

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

  static async waitForInstallModuleReceipt(
    userOpHash: Hex,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
    bundlerUrl?: string,
    timeoutMs?: number,
  ): Promise<UserOperationReceipt<"0.7">> {
    return waitForUserOperationReceipt(
      userOpHash,
      chainId,
      bundlerUrl ?? getBundlerUrl(),
      timeoutMs,
    );
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

  static async getRecoveryDetails(
    smartAccountAddress: Address,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<RecoveryDetailsState> {
    const deployment = getDeployment(chainId);
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }

    const publicClient = getPublicClient(chainId);
    const [details, timelockSeconds] = await Promise.all([
      publicClient.readContract({
        address: deployment.socialRecovery as Address,
        abi: ABIS.socialRecovery,
        functionName: "getRecoveryDetails",
        args: [smartAccountAddress],
      }) as Promise<[Address[], bigint]>,
      publicClient.readContract({
        address: deployment.socialRecovery as Address,
        abi: ABIS.socialRecovery,
        functionName: "getRecoveryTimelock",
        args: [smartAccountAddress],
      }) as Promise<bigint>,
    ]);

    const [guardians, threshold] = details;
    return { guardians, threshold, timelockSeconds };
  }

  static async getRecoveryNonce(
    smartAccountAddress: Address,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<bigint> {
    const deployment = getDeployment(chainId);
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }

    const publicClient = getPublicClient(chainId);
    return (await publicClient.readContract({
      address: deployment.socialRecovery as Address,
      abi: ABIS.socialRecovery,
      functionName: "getRecoveryNonce",
      args: [smartAccountAddress],
    })) as bigint;
  }

  static async getRecoveryHashes(
    smartAccountAddress: Address,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<RecoveryHashes | null> {
    const { guardians, threshold } = await this.getRecoveryDetails(smartAccountAddress, chainId);
    if (guardians.length === 0 || threshold === 0n) {
      return null;
    }

    const deployment = getDeployment(chainId);
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }

    const publicClient = getPublicClient(chainId);
    const [guardianSetHash, policyHash] = await Promise.all([
      publicClient.readContract({
        address: deployment.socialRecovery as Address,
        abi: ABIS.socialRecovery,
        functionName: "getGuardianSetHash",
        args: [smartAccountAddress],
      }) as Promise<Hex>,
      publicClient.readContract({
        address: deployment.socialRecovery as Address,
        abi: ABIS.socialRecovery,
        functionName: "getPolicyHash",
        args: [smartAccountAddress],
      }) as Promise<Hex>,
    ]);

    return {
      guardianSetHash,
      policyHash,
    };
  }

  static async getActiveRecovery(
    smartAccountAddress: Address,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
  ): Promise<ActiveRecoveryState | null> {
    const deployment = getDeployment(chainId);
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }

    const publicClient = getPublicClient(chainId);
    const [recoveryId, executeAfter] = (await publicClient.readContract({
      address: deployment.socialRecovery as Address,
      abi: ABIS.socialRecovery,
      functionName: "getActiveRecovery",
      args: [smartAccountAddress],
    })) as [Hex, bigint];

    if (recoveryId === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      return null;
    }

    return { recoveryId, executeAfter };
  }

  static async getMultiChainRecoveryState(
    smartAccountAddress: Address,
    chainIds: readonly SupportedChainId[],
  ): Promise<MultiChainRecoveryState[]> {
    const states = await Promise.all(
      chainIds.map(async (chainId) => {
        const publicClient = getPublicClient(chainId);
        const bytecode = await publicClient.getBytecode({ address: smartAccountAddress });
        const accountDeployed = Boolean(bytecode && bytecode !== "0x");

        if (!accountDeployed) {
          return {
            chainId,
            accountDeployed: false,
            moduleInstalled: false,
            moduleConfigured: false,
            guardians: [],
            threshold: 0n,
            timelockSeconds: DEFAULT_TIMELOCK_SECONDS,
            nonce: 0n,
            hashes: {
              guardianSetHash: keccak256("0x"),
              policyHash: keccak256(
                encodeAbiParameters(
                  [{ type: "uint256" }, { type: "uint256" }],
                  [0n, DEFAULT_TIMELOCK_SECONDS],
                ),
              ),
            },
            activeRecovery: null,
          } satisfies MultiChainRecoveryState;
        }

        const [moduleInstalled, details, nonce, hashes, activeRecovery] = await Promise.all([
          this.isModuleInstalled(smartAccountAddress, chainId),
          this.getRecoveryDetails(smartAccountAddress, chainId),
          this.getRecoveryNonce(smartAccountAddress, chainId),
          this.getRecoveryHashes(smartAccountAddress, chainId),
          this.getActiveRecovery(smartAccountAddress, chainId),
        ]);

        return {
          chainId,
          accountDeployed,
          moduleInstalled,
          moduleConfigured: details.guardians.length > 0 && details.threshold > 0n,
          guardians: details.guardians,
          threshold: details.threshold,
          timelockSeconds: details.timelockSeconds,
          nonce,
          activeRecovery,
          hashes:
            hashes ??
            {
              guardianSetHash: keccak256("0x"),
              policyHash: keccak256(
                encodeAbiParameters(
                  [{ type: "uint256" }, { type: "uint256" }],
                  [details.threshold, details.timelockSeconds],
                ),
              ),
            },
        } satisfies MultiChainRecoveryState;
      }),
    );

    return states;
  }
}
