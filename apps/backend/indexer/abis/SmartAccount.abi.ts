export const SmartAccountAbi = [
  {
    type: "event",
    name: "AccountInitialized",
    inputs: [
      { name: "entryPoint", type: "address", indexed: false, internalType: "address" },
      { name: "passKeyId", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ModuleInstalled",
    inputs: [
      { name: "moduleTypeId", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "module", type: "address", indexed: false, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ModuleUninstalled",
    inputs: [
      { name: "moduleTypeId", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "module", type: "address", indexed: false, internalType: "address" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RecoveryModuleUpdated",
    inputs: [
      { name: "module", type: "address", indexed: true, internalType: "address" },
      { name: "enabled", type: "bool", indexed: false, internalType: "bool" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "PasskeyAddedViaRecovery",
    inputs: [
      { name: "passkeyId", type: "bytes32", indexed: true, internalType: "bytes32" },
    ],
    anonymous: false,
  },
] as const;
