/**
 * Smart Contract Addresses
 * 
 * Deployed contract addresses for Trezo Wallet smart contracts.
 * These addresses are network-specific and must be updated after deployment.
 */


export interface ContractAddresses {
  // ERC-4337 Core
  entryPoint: string;
  
  // Trezo Contracts
  accountImplementation: string; // SmartAccount.sol
  accountBeacon: string;         // AccountBeacon.sol  
  accountFactory: string;        // AccountFactory.sol
  proxyFactory: string;          // MinimalProxyFactory.sol
  
  // Paymaster
  mockPaymaster: string;
}

/**
 * Contract addresses for local Anvil testnet (chainId 31337)
 * 
 * ✅ These addresses are deployed by Pimlico's mock-contract-deployer
 * Running `docker compose up` automatically deploys:
 * - EntryPoint v0.7
 * - SimpleAccountFactory (ERC-4337 standard)
 * - Mock Paymaster
 * 
 * SimpleAccount is a basic AA implementation that works with any EOA as owner
 */
export const ANVIL_CONTRACTS: ContractAddresses = {
  // EntryPoint v0.7 (deployed by Pimlico)
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  
  // SimpleAccountFactory v0.7 (deployed by Pimlico)
  // This is a production-ready AA factory from account-abstraction repo
  accountFactory: '0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985',
  
  // SimpleAccount implementation (deployed with factory)
  accountImplementation: '0x9406Cc6185a346906296840746125a0E44976454',
  
  // Not using beacon pattern for SimpleAccount (it uses simple proxies)
  accountBeacon: '0x0000000000000000000000000000000000000000', // N/A
  proxyFactory: '0x0000000000000000000000000000000000000000',   // N/A
  
  // Mock Paymaster (we'll get this from logs or use bundler's)
  mockPaymaster: '0x3870419Ba2BBf0127060bCB37f69A1b1C090992B', // From Pimlico deployer
};

/**
 * Contract addresses for Sepolia testnet (chainId 11155111)
 */
export const SEPOLIA_CONTRACTS: ContractAddresses = {
  entryPoint: '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
  accountImplementation: '0x0000000000000000000000000000000000000000',
  accountBeacon: '0x0000000000000000000000000000000000000000',
  accountFactory: '0x0000000000000000000000000000000000000000',
  proxyFactory: '0x0000000000000000000000000000000000000000',
  mockPaymaster: '0x0000000000000000000000000000000000000000',
};

/**
 * Get contract addresses for current network
 */
export function getContractAddresses(chainId: number): ContractAddresses {
  switch (chainId) {
    case 31337: // Anvil
      return ANVIL_CONTRACTS;
    case 11155111: // Sepolia
      return SEPOLIA_CONTRACTS;
    default:
      throw new Error(`Unsupported chainId: ${chainId}`);
  }
}

/**
 * Validate contract addresses are not zero addresses
 * Only validates required contracts, skips optional ones
 */
export function validateContractAddresses(addresses: ContractAddresses): boolean {
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  
  // Required contracts for AA wallet to function
  const requiredFields: (keyof ContractAddresses)[] = [
    'entryPoint',
    'accountFactory',
    'accountImplementation',
    'mockPaymaster',
  ];
  
  // Optional contracts (not used by SimpleAccount)
  // accountBeacon and proxyFactory are for beacon proxy pattern
  
  let hasErrors = false;
  
  for (const key of requiredFields) {
    if (addresses[key] === zeroAddress) {
      console.warn(`⚠️  Required contract address for ${key} is not set!`);
      hasErrors = true;
    }
  }
  
  return !hasErrors;
}

/**
 * Check if contracts are deployed and ready
 */
export async function areContractsReady(chainId: number): Promise<boolean> {
  try {
    const addresses = getContractAddresses(chainId);
    return validateContractAddresses(addresses);
  } catch (error) {
    console.error('Error checking contract readiness:', error);
    return false;
  }
}

// Contract ABIs for ERC-4337 SimpleAccount
export const CONTRACT_ABIS = {
  // SimpleAccountFactory from @account-abstraction/contracts
  SimpleAccountFactory: [
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt', type: 'uint256' }
      ],
      name: 'createAccount',
      outputs: [{ name: '', type: 'address' }],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'salt', type: 'uint256' }
      ],
      name: 'getAddress',
      outputs: [{ name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function'
    }
  ] as const,
  
  // SimpleAccount implementation
  SimpleAccount: [
    {
      inputs: [{ name: 'anOwner', type: 'address' }],
      name: 'initialize',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [
        { name: 'dest', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'func', type: 'bytes' }
      ],
      name: 'execute',
      outputs: [],
      stateMutability: 'nonpayable',
      type: 'function'
    },
    {
      inputs: [],
      name: 'entryPoint',
      outputs: [{ name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'owner',
      outputs: [{ name: '', type: 'address' }],
      stateMutability: 'view',
      type: 'function'
    },
    {
      inputs: [],
      name: 'getNonce',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function'
    }
  ] as const,
};

export default {
  getContractAddresses,
  validateContractAddresses,
  areContractsReady,
  ANVIL_CONTRACTS,
  SEPOLIA_CONTRACTS,
  CONTRACT_ABIS,
};
