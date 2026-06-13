import {
  concatHex,
  encodeFunctionData,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  http,
  type Address,
  type Hex,
  createClient,
} from "viem";
import {
  formatUserOperationRequest,
  getUserOperationHash,
  type RpcEstimateUserOperationGasReturnType,
  type RpcUserOperation,
  type UserOperationReceipt,
  type UserOperation,
} from "viem/account-abstraction";

import { ABIS } from "./abis";
import { getNetwork } from "./networks";
const getDeployment = (chainId: number) => getNetwork(chainId).deployment;
import { getPublicClient, getViemChain } from "./clients";
type SupportedChainId = number;
import { collectErrorData, decodeDelegateAndRevert, decodeFailedOp, decodeRevertString } from "./revertDecoding";

const debugLog = (..._a: unknown[]) => {};
const debugError = (...a: unknown[]) => console.error(...a);

export type PasskeyInit = {
  idRaw: Hex;
  px: bigint;
  py: bigint;
};

export type DeploymentMode = "portable" | "chain-specific";

// EntryPoint version in use
const ENTRY_POINT_VERSION = "0.7";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const BUNDLER_GAS_CAP = 20_000_000n; // many bundlers default to 20m max gas per UserOp
const CREATE_ACCOUNT_MIN_VERIFICATION_GAS = 1_500_000n;
const SMART_ACCOUNT_MIN_VERIFICATION_GAS = 500_000n;
const VALIDATIONDATA_ALL_TIME_VALID_SENTINEL = "000000000000ffffffffffff0000000000000000000000000000000000000000";

const hexByteLength = (value?: Hex) => {
  if (!value || value === "0x") return 0;
  return (value.length - 2) / 2;
};

const summarizeUserOp = (op: UserOperation<typeof ENTRY_POINT_VERSION>) => ({
  sender: op.sender,
  nonce: op.nonce?.toString(),
  factory: op.factory,
  factoryDataBytes: hexByteLength(op.factoryData as Hex | undefined),
  callDataBytes: hexByteLength(op.callData as Hex | undefined),
  signatureBytes: hexByteLength(op.signature as Hex | undefined),
  paymaster: op.paymaster,
});

// ------------ Error decoding helpers (imported from revertDecoding) -------------

const containsValidationDataSuccessSentinel = (raw: Hex) =>
  raw.toLowerCase().includes(VALIDATIONDATA_ALL_TIME_VALID_SENTINEL);

const isAlreadyKnownError = (err: unknown) => {
  const parts = [
    typeof err === "string" ? err : undefined,
    err instanceof Error ? err.message : undefined,
    (err as any)?.details,
    (err as any)?.shortMessage,
    (err as any)?.body,
  ].filter((value): value is string => typeof value === "string");

  return parts.some((value) => value.toLowerCase().includes("already known"));
};

/**
 * Build a dummy WebAuthn signature for gas estimation.
 * The signature structure matches what PasskeyValidator expects but with dummy values.
 */
const buildDummyPasskeySignature = (passkeyId: Hex): Hex => {
  // Dummy authenticatorData (37 bytes minimum for WebAuthn)
  const dummyAuthData = "0x" + "49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000";
  // Dummy clientDataJSON
  const dummyClientData = '{"type":"webauthn.get","challenge":"","origin":"https://example.com"}';
  // Indices where challenge and type appear in clientDataJSON
  const challengeIndex = dummyClientData.indexOf('"challenge":"') + 13;
  const typeIndex = dummyClientData.indexOf('"type":"') + 8;

  return encodeAbiParameters(
    parseAbiParameters("bytes32, bytes, string, uint256, uint256, uint256, uint256"),
    [
      passkeyId,
      dummyAuthData as Hex,
      dummyClientData,
      BigInt(challengeIndex),
      BigInt(typeIndex),
      BigInt("0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0"), // dummy r
      BigInt("0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0"), // dummy s
    ]
  );
};

export type CreateAccountParams = {
  chainId: SupportedChainId;
  walletId: Hex;
  walletIndex?: bigint | number;
  mode?: DeploymentMode;
  validator: Hex;
  passkeyInit: PasskeyInit;
  bundlerUrl: string;
  paymasterUrl?: string;
  usePaymaster?: boolean;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  paymasterAndData?: Hex;
  nonce?: bigint;
};

export type InstallSocialRecoveryParams = {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  guardians: readonly Address[];
  threshold: bigint | number;
  passkeyId: Hex;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
};

export type InstallEmailRecoveryParams = {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  guardians: readonly Address[];
  weights: readonly (bigint | number)[];
  threshold: bigint | number;
  delay: bigint | number;
  expiry: bigint | number;
  passkeyId: Hex;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
};

export type InstallRecoveryModuleUserOpParams = {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  moduleAddress: Address;
  initData: Hex;
  passkeyId: Hex;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  operationLabel?: string;
};

export type GuardianUserOpParams = {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  socialRecoveryAddress: Address;
  guardians: readonly Address[];
  threshold: bigint;
  passkeyId: Hex;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  operationLabel?: string;
};

export type AddPasskeyUserOpParams = {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  newPasskey: PasskeyInit;
  signingPasskeyId: Hex;
  validatorAddress?: Address;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
};

export type RemovePasskeyUserOpParams = {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  targetPasskeyId: Hex;
  signingPasskeyId: Hex;
  validatorAddress?: Address;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
};

export type BuildSmartAccountExecutionUserOpParams = {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  target: Address;
  value: bigint | number;
  data: Hex;
  passkeyId: Hex;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  operationLabel?: string;
};

type RpcRequestClient = {
  request(args: { method: string; params?: readonly unknown[] }): Promise<any>;
};

type BundlerGasEstimate = RpcEstimateUserOperationGasReturnType<typeof ENTRY_POINT_VERSION> & {
  maxFeePerGas?: Hex;
  maxPriorityFeePerGas?: Hex;
};

/**
 * Pimlico's pimlico_getUserOperationGasPrice — returns slow/standard/fast tiers
 * the bundler will accept right now. Non-Pimlico bundlers (e.g. Alto on Anvil)
 * don't implement this method; we silently fall back so the caller can use a
 * sane default.
 *
 * Why this matters: Pimlico enforces a minimum maxFeePerGas that varies with
 * network conditions. Sending below that minimum gets rejected with
 * "max feePerGas must be at least <X>". Calling this method first guarantees
 * the values we submit are above the floor.
 */
const fetchPimlicoGasPrice = async (
  bundler: RpcRequestClient,
): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } | null> => {
  try {
    const res = (await bundler.request({
      method: "pimlico_getUserOperationGasPrice",
      params: [],
    })) as
      | { standard?: { maxFeePerGas: Hex; maxPriorityFeePerGas: Hex } }
      | null;
    if (!res?.standard) return null;
    return {
      maxFeePerGas: toBigInt(res.standard.maxFeePerGas),
      maxPriorityFeePerGas: toBigInt(res.standard.maxPriorityFeePerGas),
    };
  } catch {
    return null;
  }
};

const toBigInt = (value: bigint | number | string): bigint =>
  typeof value === "bigint" ? value : BigInt(value);

// Some bundlers/paymasters may return 0 for gas fields when simulation fails softly.
// This helper falls back to a sane default to avoid zero gas in the final userOp.
const ensureNonZeroBigInt = (value: bigint | number | string, fallback: bigint | number): bigint => {
  const bn = toBigInt(value);
  const fb = toBigInt(fallback);
  return bn === 0n ? (fb === 0n ? 1_000_000n : fb) : bn;
};

const clampGas = (value: bigint, cap: bigint = BUNDLER_GAS_CAP): bigint =>
  value > cap ? cap : value;

const maxBigInt = (a: bigint, b: bigint): bigint => (a > b ? a : b);

const addGasHeadroom = (value: bigint, percent: bigint, additive: bigint = 0n): bigint =>
  clampGas((value * (100n + percent)) / 100n + additive);

// Bundlers expect unpacked user ops with hex quantity fields
const serializeUserOp = (
  op: UserOperation<typeof ENTRY_POINT_VERSION>,
): RpcUserOperation<typeof ENTRY_POINT_VERSION> =>
  formatUserOperationRequest(op) as RpcUserOperation<typeof ENTRY_POINT_VERSION>;

const sponsorUserOp = async (
  paymasterUrl: string,
  chainId: SupportedChainId,
  entryPoint: Hex,
  userOp: UserOperation<typeof ENTRY_POINT_VERSION>,
) => {
  const client = createClient({
    chain: getViemChain(chainId),
    transport: http(paymasterUrl),
  }) as unknown as RpcRequestClient;

  return client.request({
    method: "pm_sponsorUserOperation",
    params: [serializeUserOp(userOp), entryPoint],
  }) as Promise<{
    paymaster: Hex;
    paymasterData?: Hex;
    paymasterVerificationGasLimit?: Hex;
    paymasterPostOpGasLimit?: Hex;
    preVerificationGas?: Hex;
    verificationGasLimit?: Hex;
    callGasLimit?: Hex;
  }>;
};

const getBundlerClient = (bundlerUrl: string, chainId: SupportedChainId): RpcRequestClient =>
  createClient({
    chain: getViemChain(chainId),
    transport: http(bundlerUrl),
  }) as unknown as RpcRequestClient;

const resolveEntryPoint = (chainId: SupportedChainId): Hex => {
  const dep = getDeployment(chainId);
  if (!dep?.entryPoint || dep.entryPoint === ZERO_ADDRESS) {
    throw new Error(`Deployment is missing entry point for chain ${chainId}`);
  }
  return dep.entryPoint as Hex;
};

const resolveSmartAccountNonce = async ({
  chainId,
  smartAccountAddress,
  nonce,
  nonceKey,
}: {
  chainId: SupportedChainId;
  smartAccountAddress: Address;
  nonce?: bigint;
  nonceKey?: bigint;
}) => {
  if (nonce !== undefined) return nonce;
  const publicClient = getPublicClient(chainId);
  return (await publicClient.readContract({
    address: smartAccountAddress,
    abi: ABIS.smartAccount,
    functionName: "getNonce",
    args: [nonceKey ?? 0n],
  })) as bigint;
};

const ensureBundlerSupportsEntryPoint = async ({
  bundler,
  bundlerUrl,
  entryPoint,
  operationLabel,
}: {
  bundler: RpcRequestClient;
  bundlerUrl: string;
  entryPoint: Hex;
  operationLabel: string;
}) => {
  let supportedEntryPoints: Hex[];
  try {
    supportedEntryPoints = await bundler.request({
      method: "eth_supportedEntryPoints",
      params: [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `[${operationLabel}] Bundler unreachable at ${bundlerUrl} — is the bundler stack running? (eth_supportedEntryPoints: ${msg})`,
    );
  }
  if (!supportedEntryPoints.includes(entryPoint)) {
    throw new Error(
      `Bundler at ${bundlerUrl} does not support EntryPoint ${entryPoint}. Supported: ${supportedEntryPoints.join(", ")}`,
    );
  }
};

const maybeSponsorUserOp = async ({
  chainId,
  paymasterUrl,
  usePaymaster,
  entryPoint,
  userOp,
  operationLabel,
}: {
  chainId: SupportedChainId;
  paymasterUrl?: string;
  usePaymaster?: boolean;
  entryPoint: Hex;
  userOp: UserOperation<typeof ENTRY_POINT_VERSION>;
  operationLabel: string;
}) => {
  if (!usePaymaster || !paymasterUrl) {
    return userOp;
  }
  try {
    const pm = await sponsorUserOp(paymasterUrl, chainId, entryPoint, userOp);
    return {
      ...userOp,
      paymaster: pm.paymaster,
      paymasterVerificationGasLimit:
        pm.paymasterVerificationGasLimit !== undefined ? toBigInt(pm.paymasterVerificationGasLimit) : undefined,
      paymasterPostOpGasLimit:
        pm.paymasterPostOpGasLimit !== undefined ? toBigInt(pm.paymasterPostOpGasLimit) : undefined,
      paymasterData: pm.paymasterData || "0x",
      preVerificationGas:
        pm.preVerificationGas !== undefined ? toBigInt(pm.preVerificationGas) : userOp.preVerificationGas,
      verificationGasLimit:
        pm.verificationGasLimit !== undefined ? toBigInt(pm.verificationGasLimit) : userOp.verificationGasLimit,
      callGasLimit: pm.callGasLimit !== undefined ? toBigInt(pm.callGasLimit) : userOp.callGasLimit,
    } satisfies UserOperation<typeof ENTRY_POINT_VERSION>;
  } catch (err) {
    console.error(`[${operationLabel}] Paymaster sponsorship failed`, err);
    throw err;
  }
};

const finalizeUserOpBuild = async ({
  bundler,
  userOpForEstimation,
  entryPoint,
  chainId,
  operationLabel,
  minVerificationGas = 0n,
  verificationHeadroomPercent = 0n,
  verificationHeadroomAdditive = 0n,
  preVerificationHeadroomPercent = 0n,
  callGasHeadroomPercent = 0n,
}: {
  bundler: RpcRequestClient;
  userOpForEstimation: UserOperation<typeof ENTRY_POINT_VERSION>;
  entryPoint: Hex;
  chainId: SupportedChainId;
  operationLabel: string;
  minVerificationGas?: bigint;
  verificationHeadroomPercent?: bigint;
  verificationHeadroomAdditive?: bigint;
  preVerificationHeadroomPercent?: bigint;
  callGasHeadroomPercent?: bigint;
}) => {
  const provisionalHash = getUserOperationHash({
    userOperation: userOpForEstimation,
    entryPointAddress: entryPoint,
    entryPointVersion: ENTRY_POINT_VERSION,
    chainId,
  });
  debugLog(`[${operationLabel}] provisional userOpHash:`, provisionalHash);

  let gas: BundlerGasEstimate;
  try {
    gas = await bundler.request({
      method: "eth_estimateUserOperationGas",
      params: [serializeUserOp(userOpForEstimation), entryPoint],
    }) as BundlerGasEstimate;
  } catch (err) {
    console.error(`[${operationLabel}] eth_estimateUserOperationGas failed`, err);
    throw err;
  }

  const estimatedPreVerificationGas =
    gas.preVerificationGas !== undefined
      ? ensureNonZeroBigInt(gas.preVerificationGas, userOpForEstimation.preVerificationGas)
      : userOpForEstimation.preVerificationGas;
  const estimatedVerificationGas =
    gas.verificationGasLimit !== undefined
      ? ensureNonZeroBigInt(gas.verificationGasLimit, userOpForEstimation.verificationGasLimit)
      : userOpForEstimation.verificationGasLimit;
  const estimatedCallGas =
    gas.callGasLimit !== undefined
      ? ensureNonZeroBigInt(gas.callGasLimit, userOpForEstimation.callGasLimit)
      : userOpForEstimation.callGasLimit;

  const withGas: UserOperation<typeof ENTRY_POINT_VERSION> = {
    ...userOpForEstimation,
    preVerificationGas:
      preVerificationHeadroomPercent > 0n
        ? addGasHeadroom(estimatedPreVerificationGas, preVerificationHeadroomPercent)
        : estimatedPreVerificationGas,
    verificationGasLimit:
      maxBigInt(
        verificationHeadroomPercent > 0n
          ? addGasHeadroom(
              estimatedVerificationGas,
              verificationHeadroomPercent,
              verificationHeadroomAdditive,
            )
          : estimatedVerificationGas,
        minVerificationGas,
      ),
    callGasLimit:
      callGasHeadroomPercent > 0n
        ? clampGas(addGasHeadroom(estimatedCallGas, callGasHeadroomPercent))
        : clampGas(estimatedCallGas),
    maxFeePerGas: gas.maxFeePerGas !== undefined ? toBigInt(gas.maxFeePerGas) : userOpForEstimation.maxFeePerGas,
    maxPriorityFeePerGas:
      gas.maxPriorityFeePerGas !== undefined
        ? toBigInt(gas.maxPriorityFeePerGas)
        : userOpForEstimation.maxPriorityFeePerGas,
  };

  const userOpHash = getUserOperationHash({
    userOperation: withGas,
    entryPointAddress: entryPoint,
    entryPointVersion: ENTRY_POINT_VERSION,
    chainId,
  });
  debugLog(`[${operationLabel}] userOpHash (post-estimate):`, userOpHash);

  return { userOp: withGas, userOpHash };
};

const refreshSponsoredUserOp = async ({
  chainId,
  paymasterUrl,
  usePaymaster,
  entryPoint,
  userOp,
  operationLabel,
}: {
  chainId: SupportedChainId;
  paymasterUrl?: string;
  usePaymaster?: boolean;
  entryPoint: Hex;
  userOp: UserOperation<typeof ENTRY_POINT_VERSION>;
  operationLabel: string;
}) => {
  if (!usePaymaster || !paymasterUrl) {
    return userOp;
  }

  return maybeSponsorUserOp({
    chainId,
    paymasterUrl,
    usePaymaster,
    entryPoint,
    userOp,
    operationLabel: `${operationLabel}:refreshPaymaster`,
  });
};

const buildSmartAccountExecuteUserOp = async ({
  chainId,
  bundlerUrl,
  smartAccountAddress,
  callData,
  passkeyId,
  nonce,
  nonceKey,
  usePaymaster,
  paymasterUrl,
  maxFeePerGas,
  maxPriorityFeePerGas,
  callGasLimit,
  verificationGasLimit,
  preVerificationGas,
  operationLabel,
}: {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  callData: Hex;
  passkeyId: Hex;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  operationLabel: string;
}) => {
  if (!passkeyId) {
    throw new Error("Active passkeyId is required to build the UserOperation signature envelope");
  }

  const entryPoint = resolveEntryPoint(chainId);
  const resolvedNonce = await resolveSmartAccountNonce({
    chainId,
    smartAccountAddress,
    nonce,
    nonceKey,
  });

  // Fetch the bundler's currently-acceptable gas price BEFORE constructing the
  // userOp. Pimlico rejects userOps whose maxFeePerGas falls below its current
  // minimum; this avoids the "max feePerGas must be at least X" failure.
  const bundler = getBundlerClient(bundlerUrl, chainId);
  const pimlicoGas = await fetchPimlicoGasPrice(bundler);

  const userOp: UserOperation<typeof ENTRY_POINT_VERSION> = {
    sender: smartAccountAddress,
    nonce: resolvedNonce,
    callData,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas: maxFeePerGas ?? pimlicoGas?.maxFeePerGas ?? 1_000_000_000n,
    maxPriorityFeePerGas:
      maxPriorityFeePerGas ?? pimlicoGas?.maxPriorityFeePerGas ?? 1_000_000n,
    signature: buildDummyPasskeySignature(passkeyId),
  };
  await ensureBundlerSupportsEntryPoint({ bundler, bundlerUrl, entryPoint, operationLabel });

  const userOpForEstimation = await maybeSponsorUserOp({
    chainId,
    paymasterUrl,
    usePaymaster,
    entryPoint,
    userOp,
    operationLabel,
  });

  const finalized = await finalizeUserOpBuild({
    bundler,
    userOpForEstimation,
    entryPoint,
    chainId,
    operationLabel,
    minVerificationGas: SMART_ACCOUNT_MIN_VERIFICATION_GAS,
    verificationHeadroomPercent: 100n,
    verificationHeadroomAdditive: 100_000n,
    preVerificationHeadroomPercent: 20n,
    callGasHeadroomPercent: 20n,
  });

  const refreshedUserOp = await refreshSponsoredUserOp({
    chainId,
    paymasterUrl,
    usePaymaster,
    entryPoint,
    userOp: finalized.userOp,
    operationLabel,
  });

  const userOpHash = getUserOperationHash({
    userOperation: refreshedUserOp,
    entryPointAddress: entryPoint,
    entryPointVersion: ENTRY_POINT_VERSION,
    chainId,
  });
  debugLog(`[${operationLabel}] userOpHash (post-paymaster):`, userOpHash);

  return { userOp: refreshedUserOp, userOpHash };
};

export async function buildSmartAccountExecutionUserOp(
  params: BuildSmartAccountExecutionUserOpParams,
) {
  const callData = encodeFunctionData({
    abi: ABIS.smartAccount,
    functionName: "execute",
    args: [params.target, toBigInt(params.value), params.data],
  });

  return buildSmartAccountExecuteUserOp({
    chainId: params.chainId,
    bundlerUrl: params.bundlerUrl,
    smartAccountAddress: params.smartAccountAddress,
    callData,
    passkeyId: params.passkeyId,
    nonce: params.nonce,
    nonceKey: params.nonceKey,
    usePaymaster: params.usePaymaster,
    paymasterUrl: params.paymasterUrl,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    callGasLimit: params.callGasLimit ?? 1_000_000n,
    verificationGasLimit: params.verificationGasLimit ?? 1_000_000n,
    preVerificationGas: params.preVerificationGas ?? 100_000n,
    operationLabel: params.operationLabel ?? "buildSmartAccountExecutionUserOp",
  });
}

export const encodeSocialRecoveryInitData = (
  guardians: readonly Address[],
  threshold: bigint | number,
  timelockSeconds: bigint | number = 86400,
): Hex => {
  if (!guardians.length) {
    throw new Error("At least one guardian is required to initialize Social Recovery");
  }
  const normalizedThreshold = typeof threshold === "bigint" ? threshold : BigInt(threshold);
  const normalizedTimelock = typeof timelockSeconds === "bigint" ? timelockSeconds : BigInt(timelockSeconds);
  if (normalizedThreshold === 0n) {
    throw new Error("Threshold must be greater than zero");
  }
  if (normalizedThreshold > BigInt(guardians.length)) {
    throw new Error("Threshold cannot exceed guardian count");
  }
  const seen = new Set<string>();
  guardians.forEach((guardian) => {
    if (!guardian || guardian === ZERO_ADDRESS) {
      throw new Error("Guardian address cannot be zero");
    }
    const key = guardian.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Duplicate guardian detected: ${guardian}`);
    }
    seen.add(key);
  });
  return encodeAbiParameters(
    parseAbiParameters("address[], uint256, uint256"),
    [guardians, normalizedThreshold, normalizedTimelock],
  );
};

export const encodeEmailRecoveryInitData = (
  guardians: readonly Address[],
  weights: readonly (bigint | number)[],
  threshold: bigint | number,
  delay: bigint | number,
  expiry: bigint | number,
): Hex => {
  if (!guardians.length) {
    throw new Error("At least one guardian is required to initialize Email Recovery");
  }
  if (guardians.length !== weights.length) {
    throw new Error("Guardian and weight counts must match");
  }

  const normalizedThreshold = toBigInt(threshold);
  const normalizedDelay = toBigInt(delay);
  const normalizedExpiry = toBigInt(expiry);
  if (normalizedThreshold === 0n) {
    throw new Error("Threshold must be greater than zero");
  }
  if (normalizedDelay === 0n) {
    throw new Error("Recovery delay must be greater than zero");
  }
  if (normalizedExpiry < normalizedDelay) {
    throw new Error("Recovery expiry must be greater than or equal to the recovery delay");
  }

  const normalizedWeights = weights.map((weight, index) => {
    const normalizedWeight = toBigInt(weight);
    if (normalizedWeight === 0n) {
      throw new Error(`Guardian weight at index ${index} must be greater than zero`);
    }
    return normalizedWeight;
  });

  const totalWeight = normalizedWeights.reduce((sum, weight) => sum + weight, 0n);
  if (normalizedThreshold > totalWeight) {
    throw new Error("Threshold cannot exceed total guardian weight");
  }

  const seen = new Set<string>();
  guardians.forEach((guardian) => {
    if (!guardian || guardian === ZERO_ADDRESS) {
      throw new Error("Guardian address cannot be zero");
    }
    const key = guardian.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Duplicate guardian detected: ${guardian}`);
    }
    seen.add(key);
  });

  return encodeAbiParameters(
    parseAbiParameters("address[], uint256[], uint256, uint256, uint256"),
    [guardians, normalizedWeights, normalizedThreshold, normalizedDelay, normalizedExpiry],
  );
};

const toPasskeyTuple = (passkeyInit: PasskeyInit) => [
  passkeyInit.idRaw,
  BigInt(passkeyInit.px),
  BigInt(passkeyInit.py),
] as const;

export const getPasskeyPublicKeyHash = (passkeyInit: PasskeyInit): Hex =>
  keccak256(
    encodeAbiParameters(
      parseAbiParameters("bytes32, uint256, uint256"),
      [passkeyInit.idRaw, BigInt(passkeyInit.px), BigInt(passkeyInit.py)],
    ),
  );

const buildInitCode = (accountFactory: Hex, passkeyArgs: CreateAccountParams) =>
  concatHex([
    accountFactory,
    encodeFunctionData({
      abi: ABIS.accountFactory,
      functionName: passkeyArgs.mode === "chain-specific" ? "createChainSpecificAccount" : "createAccount",
      args: [
        passkeyArgs.walletId,
        BigInt(passkeyArgs.walletIndex ?? 0n),
        passkeyArgs.validator,
        toPasskeyTuple(passkeyArgs.passkeyInit),
      ],
    }),
  ]);

async function predictAccountAddress(
  chainId: SupportedChainId,
  walletId: Hex,
  validator: Hex,
  passkeyInit: PasskeyInit,
  walletIndex: bigint | number = 0n,
  mode: DeploymentMode = "portable",
) {
  const dep = getDeployment(chainId);
  if (!dep) throw new Error(`No deployment found for chain ${chainId}`);

  const client = getPublicClient(chainId);
  const predicted = await client.readContract({
    address: dep.accountFactory as Address,
    abi: ABIS.accountFactory,
    functionName: mode === "chain-specific" ? "predictChainSpecificAccount" : "predictAccount",
    args: [walletId, BigInt(walletIndex), validator, toPasskeyTuple(passkeyInit)],
  });

  return predicted as Hex;
}

/**
 * Prepare a UserOperation for deploying a SmartAccount via AccountFactory.createAccount.
 * Returns the userOp with gas filled (via bundler estimate) and the hash to sign.
 */
export async function buildCreateAccountUserOp(params: CreateAccountParams) {
  const dep = getDeployment(params.chainId);
  if (!dep) throw new Error(`No deployment found for chain ${params.chainId}`);

  debugLog("Deployment:", {
    chainId: dep.chainId,
    accountFactory: dep.accountFactory,
    entryPoint: dep.entryPoint,
    passkeyValidator: dep.passkeyValidator,
  });

  // Defensive checks for passkey struct to avoid encode errors
  if (!params.passkeyInit) {
    throw new Error("PasskeyInit is required");
  }
  if (!params.passkeyInit.idRaw) {
    throw new Error("PasskeyInit.idRaw is required");
  }

  // Defensive checks for required addresses
  if (!dep.accountFactory || !dep.entryPoint || !params.validator) {
    throw new Error(
      `Missing required address: accountFactory=${dep.accountFactory}, entryPoint=${dep.entryPoint}, validator=${params.validator}`,
    );
  }

  // Ensure addresses are properly formatted as Hex
  const entryPoint = dep.entryPoint as Hex;
  const accountFactory = dep.accountFactory as Hex;
  const validator = params.validator as Hex;
  const mode = params.mode ?? "portable";
  const walletIndex = BigInt(params.walletIndex ?? 0n);

  debugLog("[buildCreateAccountUserOp] Validated addresses:", {
    entryPoint,
    accountFactory,
    validator,
  });

  const sender = await predictAccountAddress(
    params.chainId,
    params.walletId,
    validator,
    params.passkeyInit,
    walletIndex,
    mode,
  );

  debugLog("[buildCreateAccountUserOp] Predicted sender address:", sender);

  let initCode: Hex;
  try {
    initCode = buildInitCode(accountFactory, params);
  } catch (err) {
    debugError("[buildCreateAccountUserOp] buildInitCode failed", {
      accountFactory,
      walletId: params.walletId,
      walletIndex,
      validator,
      passkeyIdBytes: hexByteLength(params.passkeyInit.idRaw),
      error: err,
    });
    throw err;
  }

  debugLog("[buildCreateAccountUserOp] initCode bytes:", hexByteLength(initCode));

  // For v0.7, extract factory and factoryData from initCode
  // initCode format: factory (20 bytes) + factoryData (remaining bytes)
  const factory = ("0x" + initCode.slice(2, 42)) as Hex;
  const factoryData = ("0x" + initCode.slice(42)) as Hex;

  debugLog("[buildCreateAccountUserOp] Extracted factory and factoryData:", {
    factory,
    factoryDataBytes: hexByteLength(factoryData),
  });

  // Build a properly formatted dummy signature for gas estimation
  const dummySignature = buildDummyPasskeySignature(params.passkeyInit.idRaw);
  debugLog("[buildCreateAccountUserOp] Dummy signature bytes:", hexByteLength(dummySignature));

  // Fetch Pimlico's acceptable gas price first so the create-account userOp
  // is not rejected with "max feePerGas must be at least X" on chains where
  // Pimlico enforces a floor above our default.
  const bundler = getBundlerClient(params.bundlerUrl, params.chainId);
  const pimlicoGas = await fetchPimlicoGasPrice(bundler);

  const userOp: UserOperation<typeof ENTRY_POINT_VERSION> = {
    sender,
    nonce: params.nonce ?? 0n,
    factory,
    factoryData,
    callData: "0x",
    callGasLimit: 1_000_000n,
    verificationGasLimit: 1_000_000n,
    preVerificationGas: 200_000n,
    // Pimlico's standard tier when available, else low default for local Alto.
    maxFeePerGas: params.maxFeePerGas ?? pimlicoGas?.maxFeePerGas ?? 10_000_000n,
    maxPriorityFeePerGas:
      params.maxPriorityFeePerGas ?? pimlicoGas?.maxPriorityFeePerGas ?? 1_000_000n,
    signature: dummySignature,
  };

  await ensureBundlerSupportsEntryPoint({
    bundler,
    bundlerUrl: params.bundlerUrl,
    entryPoint,
    operationLabel: "buildCreateAccountUserOp",
  });

  let userOpForEstimation = userOp;

  // Optional paymaster sponsorship - call before gas estimation
  if (params.usePaymaster && params.paymasterUrl) {
    debugLog("[buildCreateAccountUserOp] Requesting paymaster sponsorship...", {
      paymasterUrl: params.paymasterUrl,
    });
    userOpForEstimation = await maybeSponsorUserOp({
      chainId: params.chainId,
      paymasterUrl: params.paymasterUrl,
      usePaymaster: params.usePaymaster,
      entryPoint,
      userOp,
      operationLabel: "buildCreateAccountUserOp",
    });
  }

  // Log critical values before getUserOperationHash
  debugLog("[buildCreateAccountUserOp] About to compute provisional hash with:", {
    entryPoint: entryPoint,
    chainId: params.chainId,
    sender: userOpForEstimation.sender,
    entryPointVersion: ENTRY_POINT_VERSION,
  });

  let provisionalHash: Hex;
  try {
    provisionalHash = getUserOperationHash({
      userOperation: userOpForEstimation,
      entryPointAddress: entryPoint,
      entryPointVersion: ENTRY_POINT_VERSION,
      chainId: params.chainId,
    });
    debugLog("[buildCreateAccountUserOp] provisional userOpHash (pre-estimate):", provisionalHash);
  } catch (err) {
    debugError("[buildCreateAccountUserOp] getUserOperationHash failed", {
      entryPoint: entryPoint,
      chainId: params.chainId,
      userOp: summarizeUserOp(userOpForEstimation),
      error: err,
    });
    throw err;
  }

  let gas: BundlerGasEstimate;
  try {
    gas = await bundler.request({
      method: "eth_estimateUserOperationGas",
      params: [serializeUserOp(userOpForEstimation), entryPoint],
    }) as BundlerGasEstimate;
  } catch (err) {
    debugError("[buildCreateAccountUserOp] eth_estimateUserOperationGas failed", {
      bundlerUrl: params.bundlerUrl,
      entryPoint: entryPoint,
      userOp: summarizeUserOp(userOpForEstimation),
      error: err,
    });
    throw err;
  }

  const estimatedPreVerificationGas = gas.preVerificationGas !== undefined
    ? ensureNonZeroBigInt(gas.preVerificationGas, userOp.preVerificationGas)
    : userOp.preVerificationGas;
  const estimatedVerificationGas = gas.verificationGasLimit !== undefined
    ? ensureNonZeroBigInt(gas.verificationGasLimit, userOp.verificationGasLimit)
    : userOp.verificationGasLimit;

  const withGas: UserOperation<typeof ENTRY_POINT_VERSION> = {
    ...userOpForEstimation,
    // Estimation uses dummy signature; real passkey validation costs more gas.
    preVerificationGas: addGasHeadroom(estimatedPreVerificationGas, 20n),
    verificationGasLimit: maxBigInt(
      addGasHeadroom(estimatedVerificationGas, 100n, 150_000n),
      CREATE_ACCOUNT_MIN_VERIFICATION_GAS,
    ),
    callGasLimit: gas.callGasLimit !== undefined
      ? clampGas(ensureNonZeroBigInt(gas.callGasLimit, userOp.callGasLimit))
      : clampGas(userOp.callGasLimit),
    maxFeePerGas: gas.maxFeePerGas !== undefined
      ? ensureNonZeroBigInt(gas.maxFeePerGas, userOp.maxFeePerGas)
      : userOp.maxFeePerGas,
    maxPriorityFeePerGas: gas.maxPriorityFeePerGas !== undefined
      ? ensureNonZeroBigInt(gas.maxPriorityFeePerGas, userOp.maxPriorityFeePerGas)
      : userOp.maxPriorityFeePerGas,
  };

  const refreshedUserOp = await refreshSponsoredUserOp({
    chainId: params.chainId,
    paymasterUrl: params.paymasterUrl,
    usePaymaster: params.usePaymaster,
    entryPoint,
    userOp: withGas,
    operationLabel: "buildCreateAccountUserOp",
  });

  const userOpHash = getUserOperationHash({
    userOperation: refreshedUserOp,
    entryPointAddress: entryPoint,
    entryPointVersion: ENTRY_POINT_VERSION,
    chainId: params.chainId,
  });

  debugLog("[buildCreateAccountUserOp] userOpHash (post-paymaster):", userOpHash);

  return { userOp: refreshedUserOp, userOpHash, sender };
}

export async function buildInstallRecoveryModuleUserOp(params: InstallRecoveryModuleUserOpParams) {
  if (!params.moduleAddress || params.moduleAddress === ZERO_ADDRESS) {
    throw new Error("A valid recovery module address is required to build the installation UserOperation");
  }
  const installCalldata = encodeFunctionData({
    abi: ABIS.smartAccount,
    functionName: "installRecoveryExecutorModule",
    args: [params.moduleAddress, params.initData],
  });
  const callData = encodeFunctionData({
    abi: ABIS.smartAccount,
    functionName: "execute",
    args: [params.smartAccountAddress, 0n, installCalldata],
  });
  return buildSmartAccountExecuteUserOp({
    chainId: params.chainId,
    bundlerUrl: params.bundlerUrl,
    smartAccountAddress: params.smartAccountAddress,
    callData,
    passkeyId: params.passkeyId,
    nonce: params.nonce,
    nonceKey: params.nonceKey,
    usePaymaster: params.usePaymaster,
    paymasterUrl: params.paymasterUrl,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    callGasLimit: params.callGasLimit ?? 1_000_000n,
    verificationGasLimit: params.verificationGasLimit ?? 1_000_000n,
    preVerificationGas: params.preVerificationGas ?? 100_000n,
    operationLabel: params.operationLabel ?? "buildInstallRecoveryModuleUserOp",
  });
}

export async function buildAddGuardiansUserOp(params: GuardianUserOpParams) {
  if (!params.socialRecoveryAddress || params.socialRecoveryAddress === ZERO_ADDRESS) {
    throw new Error("Social recovery address is required to build addGuardians UserOp");
  }
  const addCalldata = encodeFunctionData({
    abi: ABIS.socialRecovery,
    functionName: "addGuardians",
    args: [params.smartAccountAddress, params.guardians as Address[], params.threshold],
  });
  const callData = encodeFunctionData({
    abi: ABIS.smartAccount,
    functionName: "execute",
    args: [params.socialRecoveryAddress, 0n, addCalldata],
  });
  return buildSmartAccountExecuteUserOp({
    chainId: params.chainId,
    bundlerUrl: params.bundlerUrl,
    smartAccountAddress: params.smartAccountAddress,
    callData,
    passkeyId: params.passkeyId,
    nonce: params.nonce,
    nonceKey: params.nonceKey,
    usePaymaster: params.usePaymaster,
    paymasterUrl: params.paymasterUrl,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    callGasLimit: params.callGasLimit ?? 600_000n,
    verificationGasLimit: params.verificationGasLimit ?? 800_000n,
    preVerificationGas: params.preVerificationGas ?? 100_000n,
    operationLabel: params.operationLabel ?? "buildAddGuardiansUserOp",
  });
}

export async function buildRemoveGuardiansUserOp(params: GuardianUserOpParams) {
  if (!params.socialRecoveryAddress || params.socialRecoveryAddress === ZERO_ADDRESS) {
    throw new Error("Social recovery address is required to build removeGuardians UserOp");
  }
  const removeCalldata = encodeFunctionData({
    abi: ABIS.socialRecovery,
    functionName: "removeGuardians",
    args: [params.socialRecoveryAddress, params.guardians as Address[], params.threshold],
  });
  const callData = encodeFunctionData({
    abi: ABIS.smartAccount,
    functionName: "execute",
    args: [params.socialRecoveryAddress, 0n, removeCalldata],
  });
  return buildSmartAccountExecuteUserOp({
    chainId: params.chainId,
    bundlerUrl: params.bundlerUrl,
    smartAccountAddress: params.smartAccountAddress,
    callData,
    passkeyId: params.passkeyId,
    nonce: params.nonce,
    nonceKey: params.nonceKey,
    usePaymaster: params.usePaymaster,
    paymasterUrl: params.paymasterUrl,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    callGasLimit: params.callGasLimit ?? 600_000n,
    verificationGasLimit: params.verificationGasLimit ?? 800_000n,
    preVerificationGas: params.preVerificationGas ?? 100_000n,
    operationLabel: params.operationLabel ?? "buildRemoveGuardiansUserOp",
  });
}

export type ApproveHashUserOpParams = {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  socialRecoveryAddress: Address;
  digest: Hex;
  passkeyId: Hex;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  operationLabel?: string;
};

export async function buildApproveHashUserOp(params: ApproveHashUserOpParams) {
  if (!params.socialRecoveryAddress || params.socialRecoveryAddress === ZERO_ADDRESS) {
    throw new Error("Social recovery address is required to build approveHash UserOp");
  }
  const innerCalldata = encodeFunctionData({
    abi: ABIS.socialRecovery,
    functionName: "approveHash",
    args: [params.digest],
  });
  const callData = encodeFunctionData({
    abi: ABIS.smartAccount,
    functionName: "execute",
    args: [params.socialRecoveryAddress, 0n, innerCalldata],
  });
  return buildSmartAccountExecuteUserOp({
    chainId: params.chainId,
    bundlerUrl: params.bundlerUrl,
    smartAccountAddress: params.smartAccountAddress,
    callData,
    passkeyId: params.passkeyId,
    nonce: params.nonce,
    nonceKey: params.nonceKey,
    usePaymaster: params.usePaymaster,
    paymasterUrl: params.paymasterUrl,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    callGasLimit: params.callGasLimit ?? 400_000n,
    verificationGasLimit: params.verificationGasLimit ?? 800_000n,
    preVerificationGas: params.preVerificationGas ?? 100_000n,
    operationLabel: params.operationLabel ?? "buildApproveHashUserOp",
  });
}

export type RawCallUserOpParams = {
  chainId: SupportedChainId;
  bundlerUrl: string;
  smartAccountAddress: Address;
  target: Address;
  innerCalldata: Hex;
  passkeyId: Hex;
  nonce?: bigint;
  nonceKey?: bigint;
  usePaymaster?: boolean;
  paymasterUrl?: string;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  callGasLimit?: bigint;
  verificationGasLimit?: bigint;
  preVerificationGas?: bigint;
  operationLabel?: string;
};

/**
 * Build a UserOp that wraps an arbitrary contract call in smartAccount.execute().
 * Used by recovery-schedule and recovery-execute flows where the caller is a
 * guardian whose smart account is making a permissionless call to SocialRecovery.
 * The inner calldata is supplied pre-encoded by the backend (which has access
 * to all guardian signatures), avoiding the need to expose every guardian's
 * signature to the client.
 */
export async function buildRawCallUserOp(params: RawCallUserOpParams) {
  if (!params.target || params.target === ZERO_ADDRESS) {
    throw new Error("Target address is required for buildRawCallUserOp");
  }
  const callData = encodeFunctionData({
    abi: ABIS.smartAccount,
    functionName: "execute",
    args: [params.target, 0n, params.innerCalldata],
  });
  return buildSmartAccountExecuteUserOp({
    chainId: params.chainId,
    bundlerUrl: params.bundlerUrl,
    smartAccountAddress: params.smartAccountAddress,
    callData,
    passkeyId: params.passkeyId,
    nonce: params.nonce,
    nonceKey: params.nonceKey,
    usePaymaster: params.usePaymaster,
    paymasterUrl: params.paymasterUrl,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    callGasLimit: params.callGasLimit ?? 1_500_000n,
    verificationGasLimit: params.verificationGasLimit ?? 1_000_000n,
    preVerificationGas: params.preVerificationGas ?? 120_000n,
    operationLabel: params.operationLabel ?? "buildRawCallUserOp",
  });
}

export async function buildInstallSocialRecoveryUserOp(params: InstallSocialRecoveryParams) {
  const dep = getDeployment(params.chainId);
  if (!dep) throw new Error(`No deployment found for chain ${params.chainId}`);
  if (!dep.socialRecovery || dep.socialRecovery === ZERO_ADDRESS) {
    throw new Error("Deployment is missing SocialRecovery module address");
  }
  const initData = encodeSocialRecoveryInitData(params.guardians, params.threshold);
  return buildInstallRecoveryModuleUserOp({
    ...params,
    moduleAddress: dep.socialRecovery as Address,
    initData,
    operationLabel: "buildInstallSocialRecoveryUserOp",
  });
}

export async function buildInstallEmailRecoveryUserOp(params: InstallEmailRecoveryParams) {
  const dep = getDeployment(params.chainId);
  if (!dep) throw new Error(`No deployment found for chain ${params.chainId}`);
  const missing: string[] = [];
  if (!dep.emailRecovery || dep.emailRecovery === ZERO_ADDRESS) missing.push("emailRecovery");
  if (missing.length > 0) {
    throw new Error(
      `Deployment config missing required field(s): ${missing.join(", ")} for chain ${params.chainId}. `
      + "Generate contracts/deployments/31337.json (make deploy-local or make deploy-email-local) and restart Metro with cache clear.",
    );
  }
  if (!params.passkeyId) {
    throw new Error("Active passkeyId is required to build the UserOperation signature envelope");
  }

  const initData = encodeEmailRecoveryInitData(
    params.guardians,
    params.weights,
    params.threshold,
    params.delay,
    params.expiry,
  );
  return buildInstallRecoveryModuleUserOp({
    ...params,
    moduleAddress: dep.emailRecovery as Address,
    initData,
    verificationGasLimit: params.verificationGasLimit ?? 1_200_000n,
    preVerificationGas: params.preVerificationGas ?? 120_000n,
    operationLabel: "buildInstallEmailRecoveryUserOp",
  });
}

export async function buildAddPasskeyUserOp(params: AddPasskeyUserOpParams) {
  const dep = getDeployment(params.chainId);
  if (!dep) throw new Error(`No deployment found for chain ${params.chainId}`);
  if (!dep.entryPoint) {
    throw new Error("Deployment is missing entry point");
  }
  const validatorAddress = (params.validatorAddress ?? dep.passkeyValidator) as Address;
  if (!validatorAddress || validatorAddress === ZERO_ADDRESS) {
    throw new Error("Passkey validator address is required to add a passkey");
  }
  const addPasskeyData = encodeFunctionData({
    abi: ABIS.passkeyValidator,
    functionName: "addPasskey",
    args: [params.newPasskey.idRaw, params.newPasskey.px, params.newPasskey.py],
  });
  const callData = encodeFunctionData({
    abi: ABIS.smartAccount,
    functionName: "execute",
    args: [validatorAddress, 0n, addPasskeyData],
  });
  return buildSmartAccountExecuteUserOp({
    chainId: params.chainId,
    bundlerUrl: params.bundlerUrl,
    smartAccountAddress: params.smartAccountAddress,
    callData,
    passkeyId: params.signingPasskeyId,
    nonce: params.nonce,
    nonceKey: params.nonceKey,
    usePaymaster: params.usePaymaster,
    paymasterUrl: params.paymasterUrl,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    callGasLimit: params.callGasLimit ?? 800_000n,
    verificationGasLimit: params.verificationGasLimit ?? 900_000n,
    preVerificationGas: params.preVerificationGas ?? 100_000n,
    operationLabel: "buildAddPasskeyUserOp",
  });
}

const resolvePasskeyValidatorAddress = (
  chainId: SupportedChainId,
  validatorAddress?: Address,
): Address => {
  const dep = getDeployment(chainId);
  if (!dep) throw new Error(`No deployment found for chain ${chainId}`);
  const resolved = (validatorAddress ?? dep.passkeyValidator) as Address;
  if (!resolved || resolved === ZERO_ADDRESS) {
    throw new Error("Passkey validator address is required");
  }
  return resolved;
};

const buildPasskeyValidatorExecuteUserOp = async (
  params: RemovePasskeyUserOpParams,
  functionName: "scheduleRemovePasskey" | "cancelRemovePasskey" | "executeRemovePasskey",
  operationLabel: string,
) => {
  const validatorAddress = resolvePasskeyValidatorAddress(params.chainId, params.validatorAddress);
  const actionData = encodeFunctionData({
    abi: ABIS.passkeyValidator,
    functionName,
    args: [params.targetPasskeyId],
  });
  const callData = encodeFunctionData({
    abi: ABIS.smartAccount,
    functionName: "execute",
    args: [validatorAddress, 0n, actionData],
  });

  return buildSmartAccountExecuteUserOp({
    chainId: params.chainId,
    bundlerUrl: params.bundlerUrl,
    smartAccountAddress: params.smartAccountAddress,
    callData,
    passkeyId: params.signingPasskeyId,
    nonce: params.nonce,
    nonceKey: params.nonceKey,
    usePaymaster: params.usePaymaster,
    paymasterUrl: params.paymasterUrl,
    maxFeePerGas: params.maxFeePerGas,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas,
    callGasLimit: params.callGasLimit ?? 650_000n,
    verificationGasLimit: params.verificationGasLimit ?? 900_000n,
    preVerificationGas: params.preVerificationGas ?? 100_000n,
    operationLabel,
  });
};

export async function buildScheduleRemovePasskeyUserOp(params: RemovePasskeyUserOpParams) {
  return buildPasskeyValidatorExecuteUserOp(
    params,
    "scheduleRemovePasskey",
    "buildScheduleRemovePasskeyUserOp",
  );
}

export async function buildCancelRemovePasskeyUserOp(params: RemovePasskeyUserOpParams) {
  return buildPasskeyValidatorExecuteUserOp(
    params,
    "cancelRemovePasskey",
    "buildCancelRemovePasskeyUserOp",
  );
}

export async function buildExecuteRemovePasskeyUserOp(params: RemovePasskeyUserOpParams) {
  return buildPasskeyValidatorExecuteUserOp(
    params,
    "executeRemovePasskey",
    "buildExecuteRemovePasskeyUserOp",
  );
}

export async function submitConfiguredUserOp(
  signedUserOp: UserOperation<typeof ENTRY_POINT_VERSION>,
  chainId: SupportedChainId,
  bundlerUrl: string,
) {
  const entryPoint = resolveEntryPoint(chainId);
  return sendUserOp(signedUserOp, chainId, bundlerUrl, entryPoint);
}

export async function getUserOperationReceipt(
  userOpHash: Hex,
  chainId: SupportedChainId,
  bundlerUrl: string,
): Promise<UserOperationReceipt<typeof ENTRY_POINT_VERSION> | null> {
  const bundler = getBundlerClient(bundlerUrl, chainId);
  const receipt = await bundler.request({
    method: "eth_getUserOperationReceipt",
    params: [userOpHash],
  });
  return (receipt ?? null) as UserOperationReceipt<typeof ENTRY_POINT_VERSION> | null;
}

export async function waitForUserOperationReceipt(
  userOpHash: Hex,
  chainId: SupportedChainId,
  bundlerUrl: string,
  timeoutMs = 60_000,
  pollIntervalMs = 2_000,
): Promise<UserOperationReceipt<typeof ENTRY_POINT_VERSION>> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const receipt = await getUserOperationReceipt(userOpHash, chainId, bundlerUrl);
    if (receipt) {
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Timed out waiting for UserOperation receipt: ${userOpHash}`);
}

/**
 * Submit a signed UserOperation to the bundler.
 */
export async function sendUserOp(
  signedUserOp: UserOperation<typeof ENTRY_POINT_VERSION>,
  chainId: SupportedChainId,
  bundlerUrl: string,
  entryPoint: Hex,
) {
  const bundler = getBundlerClient(bundlerUrl, chainId);
  const localUserOpHash = getUserOperationHash({
    userOperation: signedUserOp,
    entryPointAddress: entryPoint,
    entryPointVersion: ENTRY_POINT_VERSION,
    chainId,
  });

  try {
    const opHash = await bundler.request({
      method: "eth_sendUserOperation",
      params: [serializeUserOp(signedUserOp), entryPoint],
    });
    return opHash as Hex;
  } catch (err) {
    const rawData = collectErrorData(err);
    let decoded: {
      delegate?: { ok: boolean; inner: Hex };
      failedOp?: { opIndex: number; reason: string };
      reason?: string;
    } = {};

    for (const raw of rawData) {
      const delegated = decodeDelegateAndRevert(raw);
      if (delegated) {
        decoded.delegate = delegated;
        const failedOp = decodeFailedOp(delegated.inner);
        if (failedOp) {
          decoded.failedOp = failedOp;
          decoded.reason = failedOp.reason;
        }
        const reason = decodeRevertString(delegated.inner);
        if (reason) decoded.reason = reason;
        break;
      }
      const failedOp = decodeFailedOp(raw);
      if (failedOp) {
        decoded.failedOp = failedOp;
        decoded.reason = failedOp.reason;
        break;
      }
      const reason = decodeRevertString(raw);
      if (reason) {
        decoded.reason = reason;
        break;
      }
    }

    debugError("[sendUserOp] eth_sendUserOperation failed", {
      bundlerUrl,
      entryPoint,
      signedUserOp: summarizeUserOp(signedUserOp),
      localUserOpHash,
      error: err,
      rawDataBytes: rawData.map(hexByteLength),
      decoded,
    });

    if (isAlreadyKnownError(err)) {
      debugLog("[sendUserOp] Bundler already has this UserOperation. Reusing local hash:", localUserOpHash);
      return localUserOpHash;
    }

    if (decoded.reason) {
      throw new Error(`Bundler rejected UserOperation: ${decoded.reason}`);
    }

    if (decoded.delegate?.ok) {
      if (containsValidationDataSuccessSentinel(decoded.delegate.inner)) {
        throw new Error(
          "Bundler rejected a successful validation result wrapper (DelegateAndRevert ok=true with valid validationData). This is a local bundler decode/compatibility issue, not account deployment failure.",
        );
      }
      throw new Error(
        "Bundler rejected a successful EntryPoint DelegateAndRevert wrapper. This points to a local bundler/EntryPoint compatibility issue.",
      );
    }

    throw err;
  }
}
