export const AccountFactoryAbi = [
  {
    type: "event",
    name: "AccountCreated",
    inputs: [
      { name: "account", type: "address", indexed: true, internalType: "address" },
      { name: "walletId", type: "bytes32", indexed: true, internalType: "bytes32" },
      { name: "walletIndex", type: "uint256", indexed: true, internalType: "uint256" },
      { name: "mode", type: "bytes32", indexed: false, internalType: "bytes32" },
      { name: "salt", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
] as const;
