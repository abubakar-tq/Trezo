import {
  concatHex,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  http,
  toHex,
  type Hex,
  type Transport,
  createClient,
} from "viem";
import { getUserOperationHash, type UserOperation } from "viem/account-abstraction";

import { ABIS } from "./abis";
import { getDeployment } from "./deployments";
import { getPublicClient, getViemChain } from "./clients";
import type { SupportedChainId } from "../chains";

export type PasskeyInit = {
  idRaw: Hex;
  px: bigint;
  py: bigint;
  rpIdHash: Hex;
};

// EntryPoint version in use
const ENTRY_POINT_VERSION = "0.7";

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
  salt: Hex;
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

type BundlerClient = ReturnType<typeof createClient<Transport>>;

const toBigInt = (value: bigint | number | string): bigint =>
  typeof value === "bigint" ? value : BigInt(value);

// Bundlers expect unpacked user ops with hex quantity fields
const serializeUserOp = (op: UserOperation<typeof ENTRY_POINT_VERSION>) => ({
  ...op,
  nonce: toHex(op.nonce),
  callGasLimit: toHex(op.callGasLimit),
  verificationGasLimit: toHex(op.verificationGasLimit),
  preVerificationGas: toHex(op.preVerificationGas),
  maxFeePerGas: toHex(op.maxFeePerGas),
  maxPriorityFeePerGas: toHex(op.maxPriorityFeePerGas),
  // Handle v0.7 paymaster fields
  ...(op.paymasterVerificationGasLimit !== undefined && {
    paymasterVerificationGasLimit: toHex(op.paymasterVerificationGasLimit),
  }),
  ...(op.paymasterPostOpGasLimit !== undefined && {
    paymasterPostOpGasLimit: toHex(op.paymasterPostOpGasLimit),
  }),
});

const sponsorUserOp = async (
  paymasterUrl: string,
  chainId: SupportedChainId,
  entryPoint: Hex,
  userOp: UserOperation<typeof ENTRY_POINT_VERSION>,
) => {
  const client = createClient({
    chain: getViemChain(chainId),
    transport: http(paymasterUrl),
  });

  return client.request({
    method: "pm_sponsorUserOperation",
    params: [serializeUserOp(userOp), entryPoint] as any,
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

const getBundlerClient = (bundlerUrl: string, chainId: SupportedChainId): BundlerClient =>
  createClient({
    chain: getViemChain(chainId),
    transport: http(bundlerUrl),
  });

const buildInitCode = (accountFactory: Hex, passkeyArgs: CreateAccountParams) =>
  concatHex([
    accountFactory,
    encodeFunctionData({
      abi: ABIS.accountFactory,
      functionName: "createAccount",
      args: [passkeyArgs.salt, passkeyArgs.validator, passkeyArgs.passkeyInit],
    }),
  ]);

async function predictAccountAddress(chainId: SupportedChainId, salt: Hex) {
  const deployment = getDeployment(chainId);
  if (!deployment) throw new Error(`No deployment found for chain ${chainId}`);

  const client = getPublicClient(chainId);
  const predicted = await client.readContract({
    address: deployment.accountFactory,
    abi: ABIS.accountFactory,
    functionName: "predictAccount",
    args: [salt],
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

  console.log("Deployment : ", deployment);

  // Defensive checks for passkey struct to avoid encode errors
  if (!params.passkeyInit) {
    throw new Error("PasskeyInit is required");
  }
  if (!params.passkeyInit.idRaw || !params.passkeyInit.rpIdHash) {
    throw new Error("PasskeyInit.idRaw and rpIdHash are required");
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

  console.log("[buildCreateAccountUserOp] Validated addresses:", {
    entryPoint,
    accountFactory,
    validator,
  });

  const sender = await predictAccountAddress(params.chainId, params.salt);

  console.log("[buildCreateAccountUserOp] Predicted sender address:", sender);

  let initCode: Hex;
  try {
    initCode = buildInitCode(accountFactory, params);
  } catch (err) {
    console.error("[buildCreateAccountUserOp] buildInitCode failed", {
      accountFactory,
      salt: params.salt,
      validator,
      passkeyInit: params.passkeyInit,
      error: err,
    });
    throw err;
  }

  console.log("[buildCreateAccountUserOp] initCode built:", initCode);

  // For v0.7, extract factory and factoryData from initCode
  // initCode format: factory (20 bytes) + factoryData (remaining bytes)
  const factory = ("0x" + initCode.slice(2, 42)) as Hex;
  const factoryData = ("0x" + initCode.slice(42)) as Hex;

  console.log("[buildCreateAccountUserOp] Extracted factory and factoryData:", {
    factory,
    factoryData: factoryData.slice(0, 66) + "...", // truncate for logging
  });

  // Build a properly formatted dummy signature for gas estimation
  const dummySignature = buildDummyPasskeySignature(params.passkeyInit.idRaw);
  console.log("[buildCreateAccountUserOp] Dummy signature length:", dummySignature.length);

  const userOp: UserOperation<typeof ENTRY_POINT_VERSION> = {
    sender,
    nonce: params.nonce ?? 0n,
    factory,
    factoryData,
    callData: "0x",
    callGasLimit: 100000000n,
    verificationGasLimit: 100000000n,
    preVerificationGas: 100000000n,
    maxFeePerGas: params.maxFeePerGas ?? 100000000n,
    maxPriorityFeePerGas: params.maxPriorityFeePerGas ?? 100000000n,
    signature: dummySignature,
  };

  const bundler = getBundlerClient(params.bundlerUrl, params.chainId);

  // Check supported entry point early
  let supportedEntryPoints: Hex[];
  try {
    supportedEntryPoints = await bundler.request({
      method: "eth_supportedEntryPoints",
      params: [],
    });
  } catch (err) {
    console.error("[buildCreateAccountUserOp] Failed eth_supportedEntryPoints", {
      bundlerUrl: params.bundlerUrl,
      error: err,
    });
    throw err;
  }

  if (!supportedEntryPoints.includes(entryPoint)) {
    throw new Error(
      `Bundler does not support the required EntryPoint ${entryPoint}. Supported: ${supportedEntryPoints.join(
        ", ",
      )}`,
    );
  }

  console.log("[buildCreateAccountUserOp] EntryPoint supported by bundler.", supportedEntryPoints);

  let userOpForEstimation = userOp;

  // Optional paymaster sponsorship - call before gas estimation
  if (params.usePaymaster && params.paymasterUrl) {
    try {
      console.log("[buildCreateAccountUserOp] Requesting paymaster sponsorship...", {
        paymasterUrl: params.paymasterUrl,
      });
      
      const pm = await sponsorUserOp(params.paymasterUrl, params.chainId, entryPoint, userOp);
      
      // For v0.7, paymaster fields are: paymaster, paymasterVerificationGasLimit, paymasterPostOpGasLimit, paymasterData
      // The pm_sponsorUserOperation response should provide paymasterAndData which we need to parse
      userOpForEstimation = {
        ...userOp,
        paymaster: pm.paymaster,
        paymasterVerificationGasLimit: pm.paymasterVerificationGasLimit !== undefined 
          ? toBigInt(pm.paymasterVerificationGasLimit) 
          : undefined,
        paymasterPostOpGasLimit: pm.paymasterPostOpGasLimit !== undefined
          ? toBigInt(pm.paymasterPostOpGasLimit)
          : undefined,
        paymasterData: pm.paymasterData || "0x",
        preVerificationGas:
          pm.preVerificationGas !== undefined ? toBigInt(pm.preVerificationGas) : userOp.preVerificationGas,
        verificationGasLimit:
          pm.verificationGasLimit !== undefined
            ? toBigInt(pm.verificationGasLimit)
            : userOp.verificationGasLimit,
        callGasLimit: pm.callGasLimit !== undefined ? toBigInt(pm.callGasLimit) : userOp.callGasLimit,
      };
      console.log("[buildCreateAccountUserOp] Sponsored by paymaster", {
        paymaster: pm.paymaster,
        paymasterData: pm.paymasterData,
      });
    } catch (err) {
      console.error("[buildCreateAccountUserOp] Paymaster sponsorship failed", {
        paymasterUrl: params.paymasterUrl,
        error: err,
      });
      throw err;
    }
  }

  // Log critical values before getUserOperationHash
  console.log("[buildCreateAccountUserOp] About to compute provisional hash with:", {
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
    console.log("[buildCreateAccountUserOp] provisional userOpHash (pre-estimate):", provisionalHash);
  } catch (err) {
    console.error("[buildCreateAccountUserOp] getUserOperationHash failed", {
      entryPoint: entryPoint,
      chainId: params.chainId,
      userOp: userOpForEstimation,
      error: err,
    });
    throw err;
  }

  let gas;
  try {
    gas = await bundler.request({
      method: "eth_estimateUserOperationGas",
      params: [serializeUserOp(userOpForEstimation), entryPoint],
    });
  } catch (err) {
    console.error("[buildCreateAccountUserOp] eth_estimateUserOperationGas failed", {
      bundlerUrl: params.bundlerUrl,
      entryPoint: entryPoint,
      userOp: serializeUserOp(userOpForEstimation),
      error: err,
    });
    throw err;
  }

  const withGas: UserOperation<typeof ENTRY_POINT_VERSION> = {
    ...userOpForEstimation,
    preVerificationGas: gas.preVerificationGas !== undefined ? toBigInt(gas.preVerificationGas) : userOp.preVerificationGas,
    verificationGasLimit:
      gas.verificationGasLimit !== undefined ? toBigInt(gas.verificationGasLimit) : userOp.verificationGasLimit,
    callGasLimit: gas.callGasLimit !== undefined ? toBigInt(gas.callGasLimit) : userOp.callGasLimit,
    maxFeePerGas: gas.maxFeePerGas !== undefined ? toBigInt(gas.maxFeePerGas) : userOp.maxFeePerGas,
    maxPriorityFeePerGas:
      gas.maxPriorityFeePerGas !== undefined ? toBigInt(gas.maxPriorityFeePerGas) : userOp.maxPriorityFeePerGas,
  };

  const userOpHash = getUserOperationHash({
    userOperation: withGas,
    entryPointAddress: entryPoint,
    entryPointVersion: ENTRY_POINT_VERSION,
    chainId: params.chainId,
  });

  console.log("[buildCreateAccountUserOp] userOpHash (post-estimate):", userOpHash);

  return { userOp: withGas, userOpHash, sender };
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
  try {
    const opHash = await bundler.request({
      method: "eth_sendUserOperation",
      params: [serializeUserOp(signedUserOp), entryPoint],
    });
    return opHash as Hex;
  } catch (err) {
    console.error("[sendUserOp] eth_sendUserOperation failed", {
      bundlerUrl,
      entryPoint,
      signedUserOp: serializeUserOp(signedUserOp),
      error: err,
    });
    throw err;
  }
}
