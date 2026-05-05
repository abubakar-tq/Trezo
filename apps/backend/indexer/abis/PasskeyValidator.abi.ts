export const PasskeyValidatorAbi = [
  {
    type: "event",
    name: "PasskeyAdded",
    inputs: [
      { name: "account", type: "address", indexed: true, internalType: "address" },
      { name: "passkeyId", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PasskeyRemoved",
    inputs: [
      { name: "account", type: "address", indexed: true, internalType: "address" },
      { name: "passkeyId", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PasskeyRemovalScheduled",
    inputs: [
      { name: "account", type: "address", indexed: true, internalType: "address" },
      { name: "passkeyId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "executeAfter", type: "uint48", indexed: false, internalType: "uint48" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PasskeyRemovalCancelled",
    inputs: [
      { name: "account", type: "address", indexed: true, internalType: "address" },
      { name: "passkeyId", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
] as const;
