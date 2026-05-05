import { createWalletClient, http, parseEther, createPublicClient } from "https://esm.sh/viem@2.17.4";
import { privateKeyToAccount } from "https://esm.sh/viem@2.17.4/accounts";
import { anvil } from "https://esm.sh/viem@2.17.4/chains";

export class LocalFulfillmentService {
  private rpcUrl: string;
  private funderPrivateKey: string;
  private isEnabled: boolean;

  constructor() {
    this.rpcUrl = Deno.env.get("ANVIL_RPC_URL") || "http://127.0.0.1:8545";
    this.funderPrivateKey = Deno.env.get("LOCAL_FUNDER_PRIVATE_KEY") || "";
    this.isEnabled = Deno.env.get("LOCAL_DEV_FULFILLMENT") === "true";
  }

  /**
   * Send crypto to walletAddress on local Anvil for demo/testing.
   *
   * SECURITY: Only runs when ALL of these are true:
   *  1. LOCAL_DEV_FULFILLMENT=true is explicitly set
   *  2. TRANSAK_ENV is NOT "PRODUCTION" 
   *  3. chainId is 31337 (local Anvil)
   */
  async fulfill(params: {
    walletAddress: string;
    fiatAmount: number;
    cryptoCurrency: string;
    chainId: number;
  }): Promise<`0x${string}` | null> {
    // ── Guard 1: Feature flag must be on ──────────────────────────────────────
    if (!this.isEnabled) {
      console.log("[LocalFulfillment] Skipped: LOCAL_DEV_FULFILLMENT != true");
      return null;
    }

    // ── Guard 2: Never run in production ──────────────────────────────────────
    if (Deno.env.get("TRANSAK_ENV") === "PRODUCTION") {
      console.log("[LocalFulfillment] Skipped: TRANSAK_ENV=PRODUCTION");
      return null;
    }

    // ── Guard 3: Only run on local Anvil (chainId 31337) ─────────────────────
    if (params.chainId !== 31337) {
      console.log(`[LocalFulfillment] Skipped: chainId=${params.chainId} is not Anvil (31337)`);
      return null;
    }

    if (!this.funderPrivateKey) {
      throw new Error("[LocalFulfillment] LOCAL_FUNDER_PRIVATE_KEY is not set");
    }

    console.log(
      `[LocalFulfillment] Funding ${params.walletAddress} with ` +
      `${params.cryptoCurrency} for $${params.fiatAmount} USD via ${this.rpcUrl}`
    );

    try {
      const account = privateKeyToAccount(this.funderPrivateKey as `0x${string}`);
      const walletClient = createWalletClient({
        account,
        chain: anvil,
        transport: http(this.rpcUrl),
      });

      // Calculate crypto amount from fiat (rough mock rate for demo)
      const cryptoAmount = this.estimateCryptoAmount(params.fiatAmount, params.cryptoCurrency);

      let hash: `0x${string}`;

      if (params.cryptoCurrency === "ETH" || params.cryptoCurrency === "MATIC") {
        hash = await walletClient.sendTransaction({
          to: params.walletAddress as `0x${string}`,
          value: parseEther(cryptoAmount.toFixed(6)),
        });
      } else {
        // For ERC-20s in demo mode, we send 0.05 ETH as a proxy for gas/demo purposes
        // In a real setup, you'd call the mock token's mint() function here
        console.warn(`[LocalFulfillment] ERC-20 (${params.cryptoCurrency}) not yet supported, sending 0.05 ETH as demo`);
        hash = await walletClient.sendTransaction({
          to: params.walletAddress as `0x${string}`,
          value: parseEther("0.05"),
        });
      }

      console.log(`[LocalFulfillment] ✅ Success: ${hash}`);
      return hash;
    } catch (error) {
      console.error("[LocalFulfillment] ❌ Failed:", error);
      throw error;
    }
  }

  /**
   * Estimate crypto amount from fiat using rough demo prices.
   * In a real system, this would call a price oracle.
   */
  private estimateCryptoAmount(fiatAmount: number, crypto: string): number {
    const prices: Record<string, number> = {
      ETH: 2500,
      BTC: 65000,
      MATIC: 0.85,
      BNB: 580,
      USDC: 1,
      USDT: 1,
    };
    const price = prices[crypto.toUpperCase()] || 2500;
    return fiatAmount / price;
  }
}
