import { createConfig, factory } from "ponder";
import { parseAbiItem } from "viem";
import { AccountFactoryAbi } from "./abis/AccountFactory.abi.js";
import { SmartAccountAbi } from "./abis/SmartAccount.abi.js";
import { SocialRecoveryAbi } from "./abis/SocialRecovery.abi.js";
import { PasskeyValidatorAbi } from "./abis/PasskeyValidator.abi.js";
import { EntryPointAbi } from "./abis/EntryPoint.abi.js";
import { Erc20Abi } from "./abis/Erc20.abi.js";
import { ANVIL_LOCAL, ENTRYPOINT_V07, ACTIVE_TESTNET_CHAINS } from "./src/addresses.js";

const ACCOUNT_CREATED = parseAbiItem(
  "event AccountCreated(address indexed account, bytes32 indexed walletId, uint256 indexed walletIndex, bytes32 mode, bytes32 salt)",
);

// Anvil is only available when its local deployment artifact (contracts/deployments/31337.json)
// is present — true in local dev, false on a hosted indexer (Render). Omit it cleanly otherwise.
const includeAnvil = ANVIL_LOCAL !== null;
const anvilFactory = (ANVIL_LOCAL?.accountFactory ?? "") as `0x${string}`;

// A factory address that always exists, for the REQUIRED top-level account `address`
// (the per-chain map overrides it). Prefer an active testnet's, then anvil, then the portable factory.
const defaultFactory = (Object.values(ACTIVE_TESTNET_CHAINS)[0]?.accountFactory ??
  ANVIL_LOCAL?.accountFactory ??
  "0xBc20fACed405c4806f4B1bEf9B8C6704ae0afC9F") as `0x${string}`;

// chains: optional anvilLocal + each active testnet (RPC configured).
const chains: Record<string, { id: number; rpc: string; pollingInterval?: number }> = {};
if (includeAnvil) {
  chains.anvilLocal = {
    id: 31337,
    rpc: process.env.PONDER_ANVIL_RPC_URL ?? "http://192.168.100.68:8545",
    pollingInterval: 1000,
  };
}
for (const [key, c] of Object.entries(ACTIVE_TESTNET_CHAINS)) {
  chains[key] = { id: c.id, rpc: c.rpc!, pollingInterval: 2000 };
}

// Per-chain entry for each active testnet for a contract field.
const perChain = (build: (c: (typeof ACTIVE_TESTNET_CHAINS)[string]) => unknown) =>
  Object.fromEntries(Object.entries(ACTIVE_TESTNET_CHAINS).map(([key, c]) => [key, build(c)]));

export default createConfig({
  database: { kind: "postgres", connectionString: process.env.DATABASE_URL! },
  chains,
  contracts: {
    AccountFactory: {
      abi: AccountFactoryAbi,
      chain: {
        ...(includeAnvil ? { anvilLocal: { address: anvilFactory, startBlock: 0 } } : {}),
        ...perChain((c) => ({ address: c.accountFactory!, startBlock: c.startBlock })),
      },
    },
    SmartAccount: {
      abi: SmartAccountAbi,
      chain: {
        ...(includeAnvil
          ? { anvilLocal: { address: factory({ address: anvilFactory, event: ACCOUNT_CREATED, parameter: "account" }), startBlock: 0 } }
          : {}),
        ...perChain((c) => ({
          address: factory({ address: c.accountFactory!, event: ACCOUNT_CREATED, parameter: "account" }),
          startBlock: c.startBlock,
        })),
      },
    },
    SocialRecovery: {
      abi: SocialRecoveryAbi,
      chain: {
        ...(includeAnvil ? { anvilLocal: { address: ANVIL_LOCAL!.socialRecovery as `0x${string}`, startBlock: 0 } } : {}),
        ...perChain((c) => ({ address: c.socialRecovery!, startBlock: c.startBlock })),
      },
    },
    PasskeyValidator: {
      abi: PasskeyValidatorAbi,
      chain: {
        ...(includeAnvil ? { anvilLocal: { address: ANVIL_LOCAL!.passkeyValidator as `0x${string}`, startBlock: 0 } } : {}),
        ...perChain((c) => ({ address: c.passkeyValidator!, startBlock: c.startBlock })),
      },
    },
    EntryPoint: {
      abi: EntryPointAbi,
      chain: {
        ...(includeAnvil ? { anvilLocal: { address: ENTRYPOINT_V07, startBlock: 0 } } : {}),
        ...perChain((c) => ({ address: ENTRYPOINT_V07, startBlock: c.startBlock })),
      },
    },
    // ERC-20 receives: restrict to KNOWN TOKEN CONTRACTS per chain (volume control).
    // anvilLocal stays unfiltered (low local volume).
    Erc20Inbound: {
      abi: Erc20Abi,
      chain: {
        ...(includeAnvil ? { anvilLocal: { startBlock: 0 } } : {}),
        ...perChain((c) => ({ address: c.tokens, startBlock: c.startBlock })),
      },
    },
  },
  accounts: {
    KnownAccounts: {
      // Top-level `address` is required by Ponder's AccountConfig type; the per-chain
      // `chain` map below overrides it with each chain's own factory.
      address: factory({ address: defaultFactory, event: ACCOUNT_CREATED, parameter: "account" }),
      chain: {
        ...(includeAnvil
          ? { anvilLocal: { address: factory({ address: anvilFactory, event: ACCOUNT_CREATED, parameter: "account" }), startBlock: 0 } }
          : {}),
        ...perChain((c) => ({
          address: factory({ address: c.accountFactory!, event: ACCOUNT_CREATED, parameter: "account" }),
          startBlock: c.startBlock,
        })),
      },
    },
  },
});
