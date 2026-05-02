import { keccak256, type Address, type Hex } from "viem";
import {
  assertSortedUniqueChainScopes,
  hashChainScope,
  hashChainScopes,
  hashEmailRecoveryData,
  hashPasskeyInit,
  hashRecoveryIntent,
  normalizeChainScopes,
  type ChainRecoveryScope,
  type EmailRecoveryData,
  type PasskeyInit,
  type RecoveryIntent,
} from "../recoveryHash";

const WALLET = "0x1111111111111111111111111111111111111111" as Address;
const MODULE_A = "0x2222222222222222222222222222222222222222" as Address;
const MODULE_B = "0x3333333333333333333333333333333333333333" as Address;
const REQUEST_ID = "0x00000000000000000000000000000000000000000000000000000000000a11ce" as Hex;
const METADATA_HASH = "0x0000000000000000000000000000000000000000000000000000000000000b0b" as Hex;
const DEADLINE = 1_800_000_000;

const PASSKEY_HASH = "0x766309447cef0f160aae87a9b7292c02408cb3dac53bbf0d93e9b7da43faea93" as Hex;
const SCOPE_BASE_HASH = "0x6ad573ffe3e26efc1bb913fd63b39b62666be00d43e8a00d1c05e3676116bc0d" as Hex;
const SCOPE_SEPOLIA_HASH = "0xce5cf8d99ab5d61d878306f5789e5510e4a45631ce3cd1565cec260f512713e9" as Hex;
const CHAIN_SCOPE_HASH = "0xba1a93104b3e5bae88315e9468d90eff2672d11424ab4b882d1a6a45ceb1aa7c" as Hex;
const INTENT_HASH = "0x70f574b4653cce1de9f127410f2108886c60d68995ff00849b88932377f27f35" as Hex;
const EMAIL_RECOVERY_DATA_HASH = "0x8c4acab2e7c86e01f6f8bf2e06dd20cbce924fbb44cae8b43393860195344ce3" as Hex;

function textHash(value: string): Hex {
  return keccak256(new TextEncoder().encode(value) as Uint8Array);
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertThrows(fn: () => unknown, expectedMessage: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(expectedMessage), `unexpected error: ${message}`);
    return;
  }

  throw new Error(`expected error containing: ${expectedMessage}`);
}

function defaultPasskey(): PasskeyInit {
  return {
    idRaw: "0x0000000000000000000000000000000000000000000000000000000000001234",
    px: 11n,
    py: 22n,
  };
}

function alternatePasskey(): PasskeyInit {
  return {
    idRaw: "0x0000000000000000000000000000000000000000000000000000000000005678",
    px: 33n,
    py: 44n,
  };
}

function defaultScopes(): ChainRecoveryScope[] {
  return [
    {
      chainId: 8453,
      wallet: WALLET,
      recoveryModule: MODULE_A,
      nonce: 7,
      guardianSetHash: textHash("guardian-set-base"),
      policyHash: textHash("policy-base"),
    },
    {
      chainId: 11_155_111,
      wallet: WALLET,
      recoveryModule: MODULE_A,
      nonce: 3,
      guardianSetHash: textHash("guardian-set-sepolia"),
      policyHash: textHash("policy-sepolia"),
    },
  ];
}

function intent(passkey: PasskeyInit, scopes: readonly ChainRecoveryScope[], deadline = DEADLINE): RecoveryIntent {
  return {
    requestId: REQUEST_ID,
    newPasskeyHash: hashPasskeyInit(passkey),
    chainScopeHash: hashChainScopes(scopes),
    validAfter: 0,
    deadline,
    metadataHash: METADATA_HASH,
  };
}

function emailData(
  passkey: PasskeyInit,
  scopes: readonly ChainRecoveryScope[],
  deadline = DEADLINE,
): EmailRecoveryData {
  return {
    version: 1,
    newPasskey: passkey,
    intent: intent(passkey, scopes, deadline),
    scopes,
  };
}

function runRecoveryHashTests(): void {
  const scopes = defaultScopes();
  const reversedScopes = [...scopes].reverse();

  assertEqual(normalizeChainScopes(reversedScopes)[0].chainId, 8453n, "scopes normalize by ascending chainId");
  assertEqual(hashChainScopes(scopes), hashChainScopes(reversedScopes), "normalized order should hash the same");
  assertThrows(() => assertSortedUniqueChainScopes(reversedScopes), "sorted by unique ascending chainId");

  const duplicateScopes = [scopes[0], { ...scopes[1], chainId: scopes[0].chainId }];
  assertThrows(() => hashChainScopes(duplicateScopes), "sorted by unique ascending chainId");

  assert(hashChainScopes(scopes) !== hashChainScopes([scopes[0]]), "different chain set changes hash");
  assert(
    hashChainScopes(scopes) !== hashChainScopes([scopes[0], { ...scopes[1], nonce: 4 }]),
    "different per-chain nonce changes hash",
  );
  assert(
    hashChainScopes(scopes) !== hashChainScopes([scopes[0], { ...scopes[1], recoveryModule: MODULE_B }]),
    "different recovery module changes hash",
  );
  assert(
    hashChainScopes(scopes) !==
      hashChainScopes([scopes[0], { ...scopes[1], guardianSetHash: textHash("guardian-set-b") }]),
    "different guardian set hash changes hash",
  );
  assert(
    hashChainScopes(scopes) !== hashChainScopes([scopes[0], { ...scopes[1], policyHash: textHash("policy-b") }]),
    "different policy hash changes hash",
  );

  const passkey = defaultPasskey();
  assert(
    hashRecoveryIntent(intent(passkey, scopes, DEADLINE)) !== hashRecoveryIntent(intent(passkey, scopes, DEADLINE + 1)),
    "different deadline changes hash",
  );
  assert(
    hashEmailRecoveryData(emailData(passkey, scopes)) !== hashEmailRecoveryData(emailData(alternatePasskey(), scopes)),
    "different new passkey changes hash",
  );

  assertEqual(hashPasskeyInit(passkey), PASSKEY_HASH, "passkey hash matches Solidity vector");
  assertEqual(hashChainScope(scopes[0]), SCOPE_BASE_HASH, "base scope hash matches Solidity vector");
  assertEqual(hashChainScope(scopes[1]), SCOPE_SEPOLIA_HASH, "sepolia scope hash matches Solidity vector");
  assertEqual(hashChainScopes(scopes), CHAIN_SCOPE_HASH, "chain scope hash matches Solidity vector");
  assertEqual(hashRecoveryIntent(intent(passkey, scopes)), INTENT_HASH, "intent hash matches Solidity vector");
  assertEqual(
    hashEmailRecoveryData(emailData(passkey, scopes)),
    EMAIL_RECOVERY_DATA_HASH,
    "email recovery data hash matches Solidity vector",
  );
}

runRecoveryHashTests();
