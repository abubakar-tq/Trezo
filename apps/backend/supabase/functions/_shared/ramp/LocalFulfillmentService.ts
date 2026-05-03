import { createWalletClient, http, parseEther, createPublicClient } from "https://esm.sh/viem@2.17.4";
import { privateKeyToAccount } from "https://esm.sh/viem@2.17.4/accounts";
import { anvil } from "https://esm.sh/viem@2.17.4/chains";

export class LocalFulfillmentService {
  private rpcUrl: string;
  private funderPrivateKey: string;

  constructor() {
    this.rpcUrl = Deno.env.get("ANVIL_RPC_URL") || "http://127.0.0.1:8545";
    this.funderPrivateKey = Deno.env.get("LOCAL_FUNDER_PRIVATE_KEY") || "";
  }

  async fulfill(params: { walletAddress: string; amount: number; cryptoCurrency: string; chainId: number }) {
    // SECURITY GUARD
    const isDevFulfillmentEnabled = Deno.env.get("LOCAL_DEV_FULFILLMENT") === "true";
    if (!isDevFulfillmentEnabled) {
      console.log("Local fulfillment skipped: LOCAL_DEV_FULFILLMENT is false.");
      return null;
    }

    if (params.chainId !== 31337 && Deno.env.get("TRANSAK_ENV") !== "STAGING") {
      console.log("Local fulfillment skipped: Not on Anvil or Staging.");
      return null;
    }

    console.log(`Fulfilling local order for ${params.walletAddress} with ${params.amount} ${params.cryptoCurrency}`);

    try {
      const account = privateKeyToAccount(this.funderPrivateKey as `0x${string}`);
      const client = createWalletClient({
        account,
        chain: anvil,
        transport: http(this.rpcUrl),
      });

      const publicClient = createPublicClient({
        chain: anvil,
        transport: http(this.rpcUrl),
      });

      let hash: `0x${string}`;

      if (params.cryptoCurrency === "ETH" || params.cryptoCurrency === "MATIC") {
        // Send native currency
        hash = await client.sendTransaction({
          to: params.walletAddress as `0x${string}`,
          value: parseEther(params.amount.toString()),
        });
      } else {
        // TODO: Handle ERC20 minting if MOCK_TOKEN_ADDRESS is provided
        // For now, we fallback to sending ETH as a gas/demo fund
        hash = await client.sendTransaction({
          to: params.walletAddress as `0x${string}`,
          value: parseEther("0.1"), // Default small amount for demo
        });
      }

      console.log(`Local fulfillment successful: ${hash}`);
      return hash;
    } catch (error) {
      console.error("Local fulfillment failed:", error);
      throw error;
    }
  }
}
