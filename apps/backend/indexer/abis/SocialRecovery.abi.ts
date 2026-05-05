export const SocialRecoveryAbi = [
  {
    type: "event",
    name: "HashedApproval",
    inputs: [
      { name: "guardian", type: "address", indexed: true, internalType: "address" },
      { name: "hash", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RejectHash",
    inputs: [
      { name: "guardian", type: "address", indexed: true, internalType: "address" },
      { name: "hash", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RecoveryScheduled",
    inputs: [
      { name: "wallet", type: "address", indexed: true, internalType: "address" },
      { name: "recoveryId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "executeAfter", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RecoveryExecuted",
    inputs: [
      { name: "wallet", type: "address", indexed: true, internalType: "address" },
      { name: "recoveryId", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RecoveryCancelled",
    inputs: [
      { name: "wallet", type: "address", indexed: true, internalType: "address" },
      { name: "recoveryId", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "GuardiansUpdated",
    inputs: [
      { name: "wallet", type: "address", indexed: true, internalType: "address" },
      { name: "threshold", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;
