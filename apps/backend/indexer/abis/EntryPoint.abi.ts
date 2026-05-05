export const EntryPointAbi = [
  {
    type: "event",
    name: "UserOperationEvent",
    inputs: [
      { name: "userOpHash", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "sender", type: "address", indexed: true, internalType: "address" },
      { name: "paymaster", type: "address", indexed: true, internalType: "address" },
      { name: "nonce", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "success", type: "bool", indexed: false, internalType: "bool" },
      { name: "actualGasCost", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "actualGasUsed", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
] as const;
