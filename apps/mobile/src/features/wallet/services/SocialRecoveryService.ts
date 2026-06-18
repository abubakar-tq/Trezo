import { getBundlerUrl, getPaymasterUrl } from "@/src/core/network/chain";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { ABIS } from "@/src/integration/viem/abis";
import {
  buildAddGuardiansUserOp as _buildAddGuardiansUserOp,
  buildApproveHashUserOp as _buildApproveHashUserOp,
  buildInstallRecoveryModuleUserOp,
  buildRawCallUserOp as _buildRawCallUserOp,
  buildRemoveGuardiansUserOp as _buildRemoveGuardiansUserOp,
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

export type GuardianUpdateRequest = {
  smartAccountAddress: Address;
  guardians: readonly Address[];
  /** Pass 0n to keep current threshold; otherwise enforce this value. */
  threshold: bigint;
  passkeyId: Hex;
  chainId?: SupportedChainId;
  bundlerUrl?: string;
  paymasterUrl?: string;
  usePaymaster?: boolean;
  nonce?: bigint;
};

export type GuardianUpdateResponse = SocialRecoveryInstallResponse;

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

// Budget for the per-chain CONNECTIVITY PROBE (not the data reads). The viem
// transport allows 30s + retries (~90s) before failing, which is catastrophic
// here: an unreachable candidate chain (e.g. local Anvil at the laptop IP, viewed
// from a physical device) would stall the whole Promise.all for over a minute and
// leave the "Create request" button spinning. If a chain can't even answer the
// first request within this budget it's treated as unreachable → emptyState. A
// reachable chain answers far faster, after which its data reads run uncapped.
const MULTICHAIN_READ_TIMEOUT_MS = 8_000;

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
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl(chainId);
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl(chainId)
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

  static async buildAddGuardiansUserOp(
    params: GuardianUpdateRequest,
  ): Promise<GuardianUpdateResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl(chainId);
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl(chainId)
      : params.paymasterUrl;
    const deployment = getDeployment(chainId);
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }
    const { userOp, userOpHash } = await _buildAddGuardiansUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      socialRecoveryAddress: deployment.socialRecovery as Address,
      guardians: params.guardians,
      threshold: params.threshold,
      passkeyId: params.passkeyId,
      usePaymaster: params.usePaymaster,
      paymasterUrl,
      nonce: params.nonce,
    });
    return { userOp, userOpHash };
  }

  static async buildRemoveGuardiansUserOp(
    params: GuardianUpdateRequest,
  ): Promise<GuardianUpdateResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl(chainId);
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl(chainId)
      : params.paymasterUrl;
    const deployment = getDeployment(chainId);
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }
    const { userOp, userOpHash } = await _buildRemoveGuardiansUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      socialRecoveryAddress: deployment.socialRecovery as Address,
      guardians: params.guardians,
      threshold: params.threshold,
      passkeyId: params.passkeyId,
      usePaymaster: params.usePaymaster,
      paymasterUrl,
      nonce: params.nonce,
    });
    return { userOp, userOpHash };
  }

  static async buildApproveHashUserOp(params: {
    smartAccountAddress: Address;
    digest: Hex;
    passkeyId: Hex;
    chainId?: SupportedChainId;
    bundlerUrl?: string;
    paymasterUrl?: string;
    usePaymaster?: boolean;
    nonce?: bigint;
  }): Promise<GuardianUpdateResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl(chainId);
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl(chainId)
      : params.paymasterUrl;
    const deployment = getDeployment(chainId);
    if (!deployment?.socialRecovery) {
      throw new Error(`No Social Recovery module configured for chain ${chainId}`);
    }
    const { userOp, userOpHash } = await _buildApproveHashUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      socialRecoveryAddress: deployment.socialRecovery as Address,
      digest: params.digest,
      passkeyId: params.passkeyId,
      usePaymaster: params.usePaymaster,
      paymasterUrl,
      nonce: params.nonce,
    });
    return { userOp, userOpHash };
  }

  /**
   * Wrap an opaque target+calldata pair in a smart-account execute UserOp and
   * build the signed-able payload. Used for paymaster-sponsored recovery
   * scheduling / execution where the guardian's smart account is the caller.
   */
  static async buildRawCallUserOp(params: {
    smartAccountAddress: Address;
    target: Address;
    innerCalldata: Hex;
    passkeyId: Hex;
    chainId?: SupportedChainId;
    bundlerUrl?: string;
    paymasterUrl?: string;
    usePaymaster?: boolean;
    nonce?: bigint;
  }): Promise<GuardianUpdateResponse> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl(chainId);
    const paymasterUrl = params.usePaymaster
      ? params.paymasterUrl ?? getPaymasterUrl(chainId)
      : params.paymasterUrl;
    const { userOp, userOpHash } = await _buildRawCallUserOp({
      chainId,
      bundlerUrl,
      smartAccountAddress: params.smartAccountAddress,
      target: params.target,
      innerCalldata: params.innerCalldata,
      passkeyId: params.passkeyId,
      usePaymaster: params.usePaymaster,
      paymasterUrl,
      nonce: params.nonce,
    });
    return { userOp, userOpHash };
  }

  static submitGuardianUserOp(params: SocialRecoverySubmitRequest): Promise<Hex> {
    return SocialRecoveryService.submitInstallModuleUserOp(params);
  }

  static waitForGuardianReceipt(
    userOpHash: Hex,
    chainId: SupportedChainId = DEFAULT_CHAIN_ID,
    bundlerUrl?: string,
    timeoutMs?: number,
  ): Promise<UserOperationReceipt<"0.7">> {
    return SocialRecoveryService.waitForInstallModuleReceipt(userOpHash, chainId, bundlerUrl, timeoutMs);
  }

  static async submitInstallModuleUserOp(params: SocialRecoverySubmitRequest): Promise<Hex> {
    const chainId = params.chainId ?? DEFAULT_CHAIN_ID;
    const bundlerUrl = params.bundlerUrl ?? getBundlerUrl(chainId);
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
      bundlerUrl ?? getBundlerUrl(chainId),
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
    // Helper: return a safe "nothing on this chain" snapshot for any chain
    // that can't be reached. Recovery requests must be tolerant of a single
    // chain RPC being down — otherwise an unreachable dev chain (e.g. local
    // Anvil at localhost:8545 viewed from a physical device) kills the whole
    // multi-chain read and prevents the user from recovering on a chain that
    // IS reachable.
    const emptyState = (chainId: SupportedChainId): MultiChainRecoveryState => ({
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
    });

    // Connectivity probe with a short budget. Unreachability shows up on the very
    // first request: an unreachable RPC (e.g. local Anvil at the laptop IP, viewed
    // from a physical device) never answers, so without this it would wait out the
    // full 30s × retries transport timeout (~90s) and stall the whole Promise.all.
    // CRITICAL: only the PROBE is capped. Once a chain answers (a live chain does so
    // in well under a second) the real data reads run UNCAPPED — a merely-slow but
    // reachable RPC must never be cut short and reported as "no config", or the UI
    // would show an already-configured wallet as un-configured.
    const probeReachable = (chainId: SupportedChainId, probe: Promise<unknown>): Promise<unknown> => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`chain ${chainId} unreachable (probe exceeded ${MULTICHAIN_READ_TIMEOUT_MS}ms)`)),
          MULTICHAIN_READ_TIMEOUT_MS,
        );
      });
      return Promise.race([probe, timeout]).finally(() => {
        if (timer) clearTimeout(timer);
      });
    };

    const states = await Promise.all(
      chainIds.map(async (chainId) => {
        try {
          const publicClient = getPublicClient(chainId);
          // Probe is the connectivity gate; a timeout here means the chain is unreachable.
          const bytecode = (await probeReachable(
            chainId,
            publicClient.getBytecode({ address: smartAccountAddress }),
          )) as Awaited<ReturnType<typeof publicClient.getBytecode>>;
          const accountDeployed = Boolean(bytecode && bytecode !== "0x");

          if (!accountDeployed) return emptyState(chainId);

          // Chain is reachable — run the full read with NO timeout.
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
        } catch (err) {
          console.warn(`[SocialRecoveryService] chain ${chainId} unreachable, skipping:`, err);
          return emptyState(chainId);
        }
      }),
    );

    return states;
  }
}
