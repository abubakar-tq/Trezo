import {
  concatHex,
  encodeAbiParameters,
  isAddress,
  keccak256,
  type Address,
  type Hex,
} from "viem";

export type PasskeyInit = {
  idRaw: Hex;
  px: bigint;
  py: bigint;
};

export type ChainRecoveryScope = {
  chainId: bigint | number;
  wallet: Address;
  recoveryModule: Address;
  nonce: bigint | number;
  guardianSetHash: Hex;
  policyHash: Hex;
};

export type NormalizedChainRecoveryScope = {
  chainId: bigint;
  wallet: Address;
  recoveryModule: Address;
  nonce: bigint;
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

export type EmailRecoveryData = {
  version: number;
  newPasskey: PasskeyInit;
  intent: RecoveryIntent;
  scopes: readonly ChainRecoveryScope[];
};

export const PASSKEY_INIT_TYPEHASH = keccak256(
  new TextEncoder().encode("PasskeyInit(bytes32 idRaw,uint256 px,uint256 py)") as Uint8Array,
);

export const CHAIN_RECOVERY_SCOPE_TYPEHASH = keccak256(
  new TextEncoder().encode(
    "ChainRecoveryScope(uint256 chainId,address wallet,address recoveryModule,uint256 nonce,bytes32 guardianSetHash,bytes32 policyHash)",
  ) as Uint8Array,
);

export const RECOVERY_INTENT_TYPEHASH = keccak256(
  new TextEncoder().encode(
    "RecoveryIntent(bytes32 requestId,bytes32 newPasskeyHash,bytes32 chainScopeHash,uint48 validAfter,uint48 deadline,bytes32 metadataHash)",
  ) as Uint8Array,
);

const UINT48_MAX = (1n << 48n) - 1n;

function assertBytes32(value: Hex, fieldName: string): void {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${fieldName} must be a bytes32 hex value`);
  }
}

function assertValidAddress(value: Address, fieldName: string): void {
  if (!isAddress(value)) {
    throw new Error(`${fieldName} must be a valid address`);
  }
}

function toUint(value: bigint | number, fieldName: string): bigint {
  if (typeof value === "bigint") {
    if (value < 0n) {
      throw new Error(`${fieldName} must be non-negative`);
    }
    return value;
  }

  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative safe integer`);
  }
  return BigInt(value);
}

function toUint48(value: bigint | number, fieldName: string): bigint {
  const normalized = toUint(value, fieldName);
  if (normalized > UINT48_MAX) {
    throw new Error(`${fieldName} exceeds uint48`);
  }
  return normalized;
}

function assertPasskey(passkey: PasskeyInit): void {
  assertBytes32(passkey.idRaw, "passkey.idRaw");
  toUint(passkey.px, "passkey.px");
  toUint(passkey.py, "passkey.py");
}

function normalizeChainScope(scope: ChainRecoveryScope): NormalizedChainRecoveryScope {
  assertValidAddress(scope.wallet, "scope.wallet");
  assertValidAddress(scope.recoveryModule, "scope.recoveryModule");
  assertBytes32(scope.guardianSetHash, "scope.guardianSetHash");
  assertBytes32(scope.policyHash, "scope.policyHash");

  return {
    chainId: toUint(scope.chainId, "scope.chainId"),
    wallet: scope.wallet,
    recoveryModule: scope.recoveryModule,
    nonce: toUint(scope.nonce, "scope.nonce"),
    guardianSetHash: scope.guardianSetHash,
    policyHash: scope.policyHash,
  };
}

function assertRecoveryIntent(intent: RecoveryIntent): void {
  assertBytes32(intent.requestId, "intent.requestId");
  assertBytes32(intent.newPasskeyHash, "intent.newPasskeyHash");
  assertBytes32(intent.chainScopeHash, "intent.chainScopeHash");
  toUint48(intent.validAfter, "intent.validAfter");
  toUint48(intent.deadline, "intent.deadline");
  assertBytes32(intent.metadataHash, "intent.metadataHash");
}

export function assertSortedUniqueChainScopes(scopes: readonly ChainRecoveryScope[]): void {
  if (scopes.length === 0) {
    throw new Error("chain scopes must not be empty");
  }

  const normalized = scopes.map(normalizeChainScope);
  for (let i = 1; i < normalized.length; i += 1) {
    if (normalized[i].chainId <= normalized[i - 1].chainId) {
      throw new Error("chain scopes must be sorted by unique ascending chainId");
    }
  }
}

export function normalizeChainScopes(scopes: readonly ChainRecoveryScope[]): NormalizedChainRecoveryScope[] {
  if (scopes.length === 0) {
    throw new Error("chain scopes must not be empty");
  }

  const normalized = scopes.map(normalizeChainScope).sort((a, b) => {
    if (a.chainId < b.chainId) return -1;
    if (a.chainId > b.chainId) return 1;
    return 0;
  });

  assertSortedUniqueChainScopes(normalized);
  return normalized;
}

export function hashPasskeyInit(passkey: PasskeyInit): Hex {
  assertPasskey(passkey);
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
  const normalized = normalizeChainScope(scope);
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
        normalized.chainId,
        normalized.wallet,
        normalized.recoveryModule,
        normalized.nonce,
        normalized.guardianSetHash,
        normalized.policyHash,
      ],
    ),
  );
}

export function hashChainScopes(scopes: readonly ChainRecoveryScope[]): Hex {
  const normalized = normalizeChainScopes(scopes);
  return keccak256(concatHex(normalized.map((scope) => hashChainScope(scope))));
}

export function hashRecoveryIntent(intent: RecoveryIntent): Hex {
  assertRecoveryIntent(intent);
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "bytes32" },
        { type: "uint48" },
        { type: "uint48" },
        { type: "bytes32" },
      ],
      [
        RECOVERY_INTENT_TYPEHASH,
        intent.requestId,
        intent.newPasskeyHash,
        intent.chainScopeHash,
        Number(toUint48(intent.validAfter, "intent.validAfter")),
        Number(toUint48(intent.deadline, "intent.deadline")),
        intent.metadataHash,
      ],
    ),
  );
}

export function encodeEmailRecoveryData(data: EmailRecoveryData): Hex {
  if (!Number.isInteger(data.version) || data.version < 0 || data.version > 255) {
    throw new Error("data.version must fit uint8");
  }

  assertPasskey(data.newPasskey);
  assertRecoveryIntent(data.intent);
  const scopes = normalizeChainScopes(data.scopes);

  return encodeAbiParameters(
    [
      { type: "uint8" },
      {
        type: "tuple",
        components: [
          { name: "idRaw", type: "bytes32" },
          { name: "px", type: "uint256" },
          { name: "py", type: "uint256" },
        ],
      },
      {
        type: "tuple",
        components: [
          { name: "requestId", type: "bytes32" },
          { name: "newPasskeyHash", type: "bytes32" },
          { name: "chainScopeHash", type: "bytes32" },
          { name: "validAfter", type: "uint48" },
          { name: "deadline", type: "uint48" },
          { name: "metadataHash", type: "bytes32" },
        ],
      },
      {
        type: "tuple[]",
        components: [
          { name: "chainId", type: "uint256" },
          { name: "wallet", type: "address" },
          { name: "recoveryModule", type: "address" },
          { name: "nonce", type: "uint256" },
          { name: "guardianSetHash", type: "bytes32" },
          { name: "policyHash", type: "bytes32" },
        ],
      },
    ],
    [
      data.version,
      data.newPasskey,
      {
        ...data.intent,
        validAfter: Number(toUint48(data.intent.validAfter, "intent.validAfter")),
        deadline: Number(toUint48(data.intent.deadline, "intent.deadline")),
      },
      scopes,
    ],
  );
}

export function hashEmailRecoveryData(data: EmailRecoveryData): Hex {
  return keccak256(encodeEmailRecoveryData(data));
}
