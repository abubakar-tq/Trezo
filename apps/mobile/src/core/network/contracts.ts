import anvilDeployment from "../../../../../contracts/deployments/31337.json";

/**
 * Minimal set of contract addresses the app actually uses.
 * Expand if/when we add new features that need more contracts.
 */
export interface ContractAddresses {
  entryPoint: string;
  accountFactory: string;
  proxyFactory?: string;
  accountImplementation?: string;
  passkeyValidator?: string;
  emailRecovery?: string;
}

type DeploymentContractAddresses = {
  entryPoint: string;
  accountFactory: string;
  proxyFactory?: string;
  smartAccountImpl?: string;
  passkeyValidator?: string;
  emailRecovery?: string;
};

const anvilDeploymentContracts = anvilDeployment as DeploymentContractAddresses;

/**
 * Contract addresses for local Anvil (read from the shared deployment json)
 */
export const ANVIL_CONTRACTS: ContractAddresses = {
  entryPoint: anvilDeploymentContracts.entryPoint,
  accountFactory: anvilDeploymentContracts.accountFactory,
  proxyFactory: anvilDeploymentContracts.proxyFactory,
  accountImplementation: anvilDeploymentContracts.smartAccountImpl,
  passkeyValidator: anvilDeploymentContracts.passkeyValidator,
  emailRecovery: anvilDeploymentContracts.emailRecovery,
};

/**
 * Contract addresses for Sepolia testnet (chainId 11155111).
 * Source from env so we don't hardcode deployment specifics here.
 */
export const SEPOLIA_CONTRACTS: ContractAddresses = {
  entryPoint: process.env.EXPO_PUBLIC_SEPOLIA_ENTRYPOINT ?? "0x0000000000000000000000000000000000000000",
  accountFactory: process.env.EXPO_PUBLIC_SEPOLIA_ACCOUNT_FACTORY ?? "0x0000000000000000000000000000000000000000",
  proxyFactory: process.env.EXPO_PUBLIC_SEPOLIA_PROXY_FACTORY,
  accountImplementation: process.env.EXPO_PUBLIC_SEPOLIA_ACCOUNT_IMPL,
  passkeyValidator: process.env.EXPO_PUBLIC_SEPOLIA_PASSKEY_VALIDATOR,
  emailRecovery: process.env.EXPO_PUBLIC_SEPOLIA_EMAIL_RECOVERY,
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
  ];
  
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


export default {
  getContractAddresses,
  validateContractAddresses,
  areContractsReady,
  ANVIL_CONTRACTS,
  SEPOLIA_CONTRACTS,
};
