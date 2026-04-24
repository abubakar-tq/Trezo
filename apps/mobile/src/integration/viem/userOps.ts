import {
  concatHex,
  encodeFunctionData,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  http,
  decodeAbiParameters,
  type Address,
  type Hex,
  type Transport,
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
import { getDeployment } from "./deployments";
import { getPublicClient, getViemChain } from "./clients";
import type { SupportedChainId } from "../chains";

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
const DELEGATE_AND_REVERT_SELECTOR = "0x99410554";
const FAILED_OP_SELECTOR = "0x220266b6";
const VALIDATIONDATA_ALL_TIME_VALID_SENTINEL = "000000000000ffffffffffff0000000000000000000000000000000000000000";

const debugLog = (...args: unknown[]) => {
  if (__DEV__) console.log(...args);
};

const debugError = (...args: unknown[]) => {
  if (__DEV__) console.error(...args);
};

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

// ------------ Error decoding helpers (for bundler delegateAndRevert) -------------
const asHex = (v: any): Hex | undefined =>
  typeof v === "string" && v.startsWith("0x") ? (v as Hex) : undefined;

const collectErrorData = (err: any): Hex[] => {
  const candidates = [
    err?.data,
    err?.error?.data,
    err?.cause?.data,
    err?.cause?.error?.data,
    (() => {
      try {
        const parsed = JSON.parse(err?.body ?? "{}");
        return parsed?.error?.data;
      } catch {
        return undefined;
      }
    })(),
  ];
  return candidates.map(asHex).filter(Boolean) as Hex[];
};

const decodeDelegateAndRevert = (raw: Hex) => {
  if (!raw.startsWith(DELEGATE_AND_REVERT_SELECTOR) || raw.length < 10) return null;
  try {
    const data = ("0x" + raw.slice(10)) as Hex;
    const [ok, inner] = decodeAbiParameters([{ type: "bool" }, { type: "bytes" }], data);
    return { ok, inner: inner as Hex };
  } catch {
    return null;
  }
};

const decodeFailedOp = (raw: Hex) => {
  if (!raw.startsWith(FAILED_OP_SELECTOR) || raw.length < 10) return null;
  try {
    const data = ("0x" + raw.slice(10)) as Hex;
    const [opIndex, reason] = decodeAbiParameters([{ type: "uint256" }, { type: "string" }], data);
    return { opIndex: Number(opIndex), reason: reason as string };
  } catch {
    return null;
  }
};

const decodeRevertString = (raw: Hex) => {
  // Error(string) selector 0x08c379a0
  if (!raw.startsWith("0x08c379a0") || raw.length < 10) return null;
  try {
    const data = ("0x" + raw.slice(10)) as Hex;
    const [reason] = decodeAbiParameters([{ type: "string" }], data);
    return reason as string;
  } catch {
    return null;
  }
};

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

type RpcRequestClient = {
  request(args: { method: string; params?: readonly unknown[] }): Promise<any>;
};

type BundlerGasEstimate = RpcEstimateUserOperationGasReturnType<typeof ENTRY_POINT_VERSION> & {
  maxFeePerGas?: Hex;
  maxPriorityFeePerGas?: Hex;
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
  const deployment = getDeployment(chainId);
  if (!deployment?.entryPoint || deployment.entryPoint === ZERO_ADDRESS) {
    throw new Error(`Deployment is missing entry point for chain ${chainId}`);
  }
  return deployment.entryPoint as Hex;
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
  entryPoint,
  operationLabel,
}: {
  bundler: RpcRequestClient;
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
    console.error(`[${operationLabel}] Failed eth_supportedEntryPoints`, err);
    throw err;
  }
  if (!supportedEntryPoints.includes(entryPoint)) {
    throw new Error(
      `Bundler does not support EntryPoint ${entryPoint}. Supported entry points: ${supportedEntryPoints.join(", ")}`,
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

  const userOp: UserOperation<typeof ENTRY_POINT_VERSION> = {
    sender: smartAccountAddress,
    nonce: resolvedNonce,
    callData,
    callGasLimit,
    verificationGasLimit,
    preVerificationGas,
    maxFeePerGas: maxFeePerGas ?? 1_000_000_000n,
    maxPriorityFeePerGas: maxPriorityFeePerGas ?? 1_000_000n,
    signature: buildDummyPasskeySignature(passkeyId),
  };

  const bundler = getBundlerClient(bundlerUrl, chainId);
  await ensureBundlerSupportsEntryPoint({ bundler, entryPoint, operationLabel });

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

export const encodeSocialRecoveryInitData = (guardians: readonly Address[], threshold: bigint | number): Hex => {
  if (!guardians.length) {
    throw new Error("At least one guardian is required to initialize Social Recovery");
  }
  const normalizedThreshold = typeof threshold === "bigint" ? threshold : BigInt(threshold);
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
  return encodeAbiParameters(parseAbiParameters("address[], uint256"), [guardians, normalizedThreshold]);
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
  const deployment = getDeployment(chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${chainId}`);

  const client = getPublicClient(chainId);
  const predicted = await client.readContract({
    address: deployment.accountFactory,
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
  const deployment = getDeployment(params.chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${params.chainId}`);

  debugLog("Deployment:", {
    chainId: deployment.chainId,
    accountFactory: deployment.accountFactory,
    entryPoint: deployment.entryPoint,
    passkeyValidator: deployment.passkeyValidator,
  });

  // Defensive checks for passkey struct to avoid encode errors
  if (!params.passkeyInit) {
    throw new Error("PasskeyInit is required");
  }
  if (!params.passkeyInit.idRaw) {
    throw new Error("PasskeyInit.idRaw is required");
  }

  // Defensive checks for required addresses
  if (!deployment.accountFactory || !deployment.entryPoint || !params.validator) {
    throw new Error(
      `Missing required address: accountFactory=${deployment.accountFactory}, entryPoint=${deployment.entryPoint}, validator=${params.validator}`,
    );
  }

  // Ensure addresses are properly formatted as Hex
  const entryPoint = deployment.entryPoint as Hex;
  const accountFactory = deployment.accountFactory as Hex;
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

  const userOp: UserOperation<typeof ENTRY_POINT_VERSION> = {
    sender,
    nonce: params.nonce ?? 0n,
    factory,
    factoryData,
    callData: "0x",
    callGasLimit: 1_000_000n,
    verificationGasLimit: 1_000_000n,
    preVerificationGas: 200_000n,
    // Keep gas price low so total gas stays under common bundler caps (20m)
    maxFeePerGas: params.maxFeePerGas ?? 10_000_000n,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas ?? 1_000_000n,
    signature: dummySignature,
  };

  const bundler = getBundlerClient(params.bundlerUrl, params.chainId);

  await ensureBundlerSupportsEntryPoint({
    bundler,
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

export async function buildInstallSocialRecoveryUserOp(params: InstallSocialRecoveryParams) {
  const deployment = getDeployment(params.chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${params.chainId}`);
  if (!deployment.socialRecovery || deployment.socialRecovery === ZERO_ADDRESS) {
    throw new Error("Deployment is missing SocialRecovery module address");
  }
  const initData = encodeSocialRecoveryInitData(params.guardians, params.threshold);
  return buildInstallRecoveryModuleUserOp({
    ...params,
    moduleAddress: deployment.socialRecovery as Address,
    initData,
    operationLabel: "buildInstallSocialRecoveryUserOp",
  });
}

export async function buildInstallEmailRecoveryUserOp(params: InstallEmailRecoveryParams) {
  const deployment = getDeployment(params.chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${params.chainId}`);
  const missing: string[] = [];
  if (!deployment.emailRecovery || deployment.emailRecovery === ZERO_ADDRESS) missing.push("emailRecovery");
  if (missing.length > 0) {
    throw new Error(
      `Deployment config missing required field(s): ${missing.join(", ")} for chain ${params.chainId}. `
      + "Sync contracts JSON to mobile (make sync-mobile CHAIN_ID=31337) and restart Metro with cache clear.",
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
    moduleAddress: deployment.emailRecovery as Address,
    initData,
    verificationGasLimit: params.verificationGasLimit ?? 1_200_000n,
    preVerificationGas: params.preVerificationGas ?? 120_000n,
    operationLabel: "buildInstallEmailRecoveryUserOp",
  });
}

export async function buildAddPasskeyUserOp(params: AddPasskeyUserOpParams) {
  const deployment = getDeployment(params.chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${params.chainId}`);
  if (!deployment.entryPoint) {
    throw new Error("Deployment is missing entry point");
  }
  const validatorAddress = (params.validatorAddress ?? deployment.passkeyValidator) as Address;
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
