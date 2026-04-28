import { hashTypedData, type Address, type Hex } from "viem";

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

const PORTABLE_DOMAIN_NAME = "Trezo Social Recovery";
const PORTABLE_DOMAIN_VERSION = "1";

export function buildRecoveryTypedData(
  intent: RecoveryIntent,
  socialRecoveryAddress: Address,
): RecoveryTypedData {
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
      validAfter: Number(intent.validAfter),
      deadline: Number(intent.deadline),
    },
  }) as Hex;
}
