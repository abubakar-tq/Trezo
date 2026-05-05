import { createConfig, factory } from "ponder";
import { http, parseAbiItem } from "viem";
import { AccountFactoryAbi } from "./abis/AccountFactory.abi.js";
import { SmartAccountAbi } from "./abis/SmartAccount.abi.js";
import { SocialRecoveryAbi } from "./abis/SocialRecovery.abi.js";
import { PasskeyValidatorAbi } from "./abis/PasskeyValidator.abi.js";
import { EntryPointAbi } from "./abis/EntryPoint.abi.js";
import { Erc20Abi } from "./abis/Erc20.abi.js";
import { ANVIL_LOCAL, ENTRYPOINT_V07 } from "./src/addresses.js";

export default createConfig({
  database: {
    kind: "postgres",
    connectionString: process.env.DATABASE_URL!,
  },
  chains: {
    anvilLocal: {
      id: 31337,
      transport: http(
        process.env.PONDER_ANVIL_RPC_URL ?? "http://192.168.100.68:8545"
      ),
      pollingInterval: 1000,
    },
  },
  contracts: {
    AccountFactory: {
      abi: AccountFactoryAbi,
      chain: "anvilLocal",
      address: ANVIL_LOCAL.accountFactory as `0x${string}`,
      startBlock: 0,
    },
    SmartAccount: {
      abi: SmartAccountAbi,
      chain: "anvilLocal",
      address: factory({
        address: ANVIL_LOCAL.accountFactory as `0x${string}`,
        event: parseAbiItem(
          "event AccountCreated(address indexed account, bytes32 indexed walletId, uint256 indexed walletIndex, bytes32 mode, bytes32 salt)"
        ),
        parameter: "account",
      }),
      startBlock: 0,
    },
    SocialRecovery: {
      abi: SocialRecoveryAbi,
      chain: "anvilLocal",
      address: ANVIL_LOCAL.socialRecovery as `0x${string}`,
      startBlock: 0,
    },
    PasskeyValidator: {
      abi: PasskeyValidatorAbi,
      chain: "anvilLocal",
      address: ANVIL_LOCAL.passkeyValidator as `0x${string}`,
      startBlock: 0,
    },
    EntryPoint: {
      abi: EntryPointAbi,
      chain: "anvilLocal",
      address: ENTRYPOINT_V07,
      startBlock: 0,
    },
    Erc20Inbound: {
      abi: Erc20Abi,
      chain: "anvilLocal",
      // No address filter — index all Transfer events; handler filters by known accounts
      startBlock: 0,
    },
  },
  blocks: {
    HealthBeat: {
      chain: "anvilLocal",
      interval: 100,
      startBlock: 0,
    },
  },
});
