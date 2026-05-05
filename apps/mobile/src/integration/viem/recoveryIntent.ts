import {
  encodeAbiParameters,
  hashTypedData,
  keccak256,
  type Address,
  type Hex,
} from "viem";
import type { SupportedChainId } from "../chains";

export type PasskeyInit = {
  idRaw: Hex;
  px: bigint;
  py: bigint;
};

export type ChainRecoveryScope = {
  chainId: bigint | number;
  wallet: Address;
  socialRecovery: Address;
  nonce: bigint | number;
  guardianSetHash: Hex;
  policyHash: Hex;
};

export type RecoveryIntent = {
  requestId: Hex;
  newPasskeyHash: Hex;
  chainScopeHash: Hex;
  validAfter: bigint | number;
  deadline: bigint | number;
  metadataHash: Hex;
};

export type RecoveryTypedData = {
  domain: {
    name: string;
    version: string;
    verifyingContract: Address;
  };
  types: {
    RecoveryIntent: Array<{ name: string; type: string }>;
  };
  primaryType: "RecoveryIntent";
  message: RecoveryIntent;
};

const PASSKEY_INIT_TYPEHASH = keccak256(
  new TextEncoder().encode("PasskeyInit(bytes32 idRaw,uint256 px,uint256 py)") as Uint8Array,
);

const CHAIN_RECOVERY_SCOPE_TYPEHASH = keccak256(
  new TextEncoder().encode(
    "ChainRecoveryScope(uint256 chainId,address wallet,address socialRecovery,uint256 nonce,bytes32 guardianSetHash,bytes32 policyHash)",
  ) as Uint8Array,
);

const RECOVERY_INTENT_TYPEHASH = keccak256(
  new TextEncoder().encode(
    "RecoveryIntent(bytes32 requestId,bytes32 newPasskeyHash,bytes32 chainScopeHash,uint48 validAfter,uint48 deadline,bytes32 metadataHash)",
  ) as Uint8Array,
);

const PORTABLE_DOMAIN_NAME = "Trezo Social Recovery";
const PORTABLE_DOMAIN_VERSION = "1";

const toBigInt = (value: bigint | number) => BigInt(value);

export function hashPasskeyInit(passkey: PasskeyInit): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [PASSKEY_INIT_TYPEHASH, passkey.idRaw, passkey.px, passkey.py],
    ),
  );
}

export function hashChainScope(scope: ChainRecoveryScope): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        CHAIN_RECOVERY_SCOPE_TYPEHASH,
        toBigInt(scope.chainId),
        scope.wallet,
        scope.socialRecovery,
        toBigInt(scope.nonce),
        scope.guardianSetHash,
        scope.policyHash,
      ],
    ),
  );
}

export function hashChainScopes(scopes: readonly ChainRecoveryScope[]): Hex {
  const sorted = [...scopes].sort((a, b) => Number(a.chainId) - Number(b.chainId));
  const encoded = sorted.map((scope) => hashChainScope(scope)).join("") as Hex;
  return keccak256(encoded || "0x");
}

export function buildRecoveryIntent(params: {
  requestId: Hex;
  passkey: PasskeyInit;
  chainScopes: readonly ChainRecoveryScope[];
  validAfter?: bigint | number;
  deadline: bigint | number;
  metadataHash?: Hex;
}): RecoveryIntent {
  return {
    requestId: params.requestId,
    newPasskeyHash: hashPasskeyInit(params.passkey),
    chainScopeHash: hashChainScopes(params.chainScopes),
    validAfter: params.validAfter ?? 0,
    deadline: params.deadline,
    metadataHash: params.metadataHash ?? keccak256(new Uint8Array()),
  };
}

export function buildRecoveryTypedData(intent: RecoveryIntent, socialRecoveryAddress: Address): RecoveryTypedData {
  return {
    domain: {
      name: PORTABLE_DOMAIN_NAME,
      version: PORTABLE_DOMAIN_VERSION,
      verifyingContract: socialRecoveryAddress,
    },
    types: {
      RecoveryIntent: [
        { name: "requestId", type: "bytes32" },
        { name: "newPasskeyHash", type: "bytes32" },
        { name: "chainScopeHash", type: "bytes32" },
        { name: "validAfter", type: "uint48" },
        { name: "deadline", type: "uint48" },
        { name: "metadataHash", type: "bytes32" },
      ],
    },
    primaryType: "RecoveryIntent",
    message: intent,
  };
}

export function computeRecoveryDigest(intent: RecoveryIntent, socialRecoveryAddress: Address): Hex {
  const validAfter = typeof intent.validAfter === "bigint" ? Number(intent.validAfter) : intent.validAfter;
  const deadline = typeof intent.deadline === "bigint" ? Number(intent.deadline) : intent.deadline;

  return hashTypedData({
    domain: {
      name: PORTABLE_DOMAIN_NAME,
      version: PORTABLE_DOMAIN_VERSION,
      verifyingContract: socialRecoveryAddress,
    },
    types: {
      RecoveryIntent: [
        { name: "requestId", type: "bytes32" },
        { name: "newPasskeyHash", type: "bytes32" },
        { name: "chainScopeHash", type: "bytes32" },
        { name: "validAfter", type: "uint48" },
        { name: "deadline", type: "uint48" },
        { name: "metadataHash", type: "bytes32" },
      ],
    },
    primaryType: "RecoveryIntent",
    message: {
      ...intent,
      validAfter,
      deadline,
    },
  }) as Hex;
}
