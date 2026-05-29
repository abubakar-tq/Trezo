import { createWalletClient, http, parseEther } from "https://esm.sh/viem@2.17.4";
import { privateKeyToAccount } from "https://esm.sh/viem@2.17.4/accounts";
import { arbitrumSepolia, baseSepolia, sepolia } from "https://esm.sh/viem@2.17.4/chains";

/**
 * viem's privateKeyToAccount is strict — it requires the `0x` prefix and throws
 * without it. Secrets in this project are conventionally stored WITHOUT `0x`
 * (deployer/relayer keys), and Foundry/ethers tolerate that, so we normalize
 * here to match — same approach as submit-recovery-operation's normalizePrivateKey.
 */
function normalizePrivateKey(raw: string): `0x${string}` {
  const t = raw.trim();
  const prefixed = (t.startsWith("0x") ? t : `0x${t}`).toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(prefixed)) {
    throw new Error("TREASURY_PRIVATE_KEY must be a 32-byte hex private key (with or without 0x)");
  }
  return prefixed as `0x${string}`;
}

/**
 * TestnetFulfillmentService
 *
 * Why this exists: Transak's STAGING environment never delivers the real asset
 * to the user's wallet — native tokens (ETH) deliver nothing, ERC-20s deliver a
 * Transak Test Token (TRNSK). So for a testnet demo where funds must actually
 * land in the user's wallet, *we* deliver them: a Trezo-operated treasury EOA
 * sends real testnet ETH after a Transak payment has been cryptographically
 * verified (see TransakProvider JWT verification + onramp-webhook).
 *
 * This is a TESTNET-DEMO-ONLY shim. On mainnet Transak delivers the purchased
 * asset itself, so this service is hard-gated off in production. It mirrors the
 * shape of the existing Anvil LocalFulfillmentService and the recovery relayer
 * EOA pattern (ADR-0010).
 *
 * SECURITY: only ever called from onramp-webhook AFTER a verified completion.
 * The guards below are defence-in-depth, not the primary gate.
 */

interface TestnetChainConfig {
  // viem chain object
  // deno-lint-ignore no-explicit-any
  chain: any;
  rpcEnv: string;
  defaultRpc: string;
}

const TESTNET_CHAINS: Record<number, TestnetChainConfig> = {
  84532: {
    chain: baseSepolia,
    rpcEnv: "BASE_SEPOLIA_RPC_URL",
    defaultRpc: "https://sepolia.base.org",
  },
  11155111: {
    chain: sepolia,
    rpcEnv: "SEPOLIA_RPC_URL",
    defaultRpc: "https://ethereum-sepolia-rpc.publicnode.com",
  },
  421614: {
    chain: arbitrumSepolia,
    rpcEnv: "ARB_SEPOLIA_RPC_URL",
    defaultRpc: "https://sepolia-rollup.arbitrum.io/rpc",
  },
};

export class TestnetFulfillmentService {
  private treasuryKey: string;
  private isEnabled: boolean;
  private maxEth: number;

  constructor() {
    this.treasuryKey = Deno.env.get("TREASURY_PRIVATE_KEY") || "";
    this.isEnabled = Deno.env.get("TESTNET_DEMO_FULFILLMENT") === "true";
    // Hard cap per order so a verified order can never drain the treasury.
    this.maxEth = Number(Deno.env.get("TESTNET_DEMO_MAX_ETH") || "0.01");
  }

  /** Chains this service knows how to fund. */
  static isTestnetChain(chainId: number): boolean {
    return chainId in TESTNET_CHAINS;
  }

  /**
   * Send real testnet ETH from the treasury EOA to the user's wallet.
   * Returns the tx hash, or null when a guard short-circuits (not an error).
   */
  async fulfill(params: {
    walletAddress: string;
    fiatAmount: number;
    cryptoCurrency: string;
    chainId: number;
  }): Promise<`0x${string}` | null> {
    // ── Guard 1: Feature flag must be on ──────────────────────────────────────
    if (!this.isEnabled) {
      console.log("[TestnetFulfillment] Skipped: TESTNET_DEMO_FULFILLMENT != true");
      return null;
    }

    // ── Guard 2: Never run in production (Transak delivers the real asset there)─
    if (Deno.env.get("TRANSAK_ENV") === "PRODUCTION") {
      console.log("[TestnetFulfillment] Skipped: TRANSAK_ENV=PRODUCTION");
      return null;
    }

    // ── Guard 3: Only known testnets ──────────────────────────────────────────
    const cfg = TESTNET_CHAINS[params.chainId];
    if (!cfg) {
      console.log(`[TestnetFulfillment] Skipped: chainId=${params.chainId} is not a supported testnet`);
      return null;
    }

    if (!this.treasuryKey) {
      throw new Error("[TestnetFulfillment] TREASURY_PRIVATE_KEY is not set");
    }

    const rpcUrl = Deno.env.get(cfg.rpcEnv) || cfg.defaultRpc;

    // Demo subsidy: convert fiat → ETH at a rough rate, then cap. This is a demo
    // grant, not a real quote — the user paid Transak in staging (no real money).
    const estimate = this.estimateEth(params.fiatAmount, params.cryptoCurrency);
    const amountEth = Math.min(estimate, this.maxEth);
    const value = parseEther(amountEth.toFixed(6));

    console.log(
      `[TestnetFulfillment] Funding ${params.walletAddress} with ${amountEth.toFixed(6)} ETH ` +
      `on chain ${params.chainId} (cap ${this.maxEth}) via ${rpcUrl}`
    );

    try {
      const account = privateKeyToAccount(normalizePrivateKey(this.treasuryKey));
      const walletClient = createWalletClient({
        account,
        chain: cfg.chain,
        transport: http(rpcUrl),
      });

      const hash = await walletClient.sendTransaction({
        to: params.walletAddress as `0x${string}`,
        value,
      });

      console.log(`[TestnetFulfillment] ✅ Sent: ${hash}`);
      return hash;
    } catch (error) {
      console.error("[TestnetFulfillment] ❌ Failed:", error);
      throw error;
    }
  }

  /**
   * Rough fiat→ETH estimate for the demo grant. Not a price oracle.
   *
   * v1 always grants native ETH regardless of the asset the user selected
   * (ERC-20 grants are future work), so we always size the grant off the ETH
   * rate to keep the amount small and faucet-friendly. The `_crypto` arg is
   * kept for the future ERC-20 path.
   */
  private estimateEth(fiatAmount: number, _crypto: string): number {
    const ETH_USD = 2500;
    return fiatAmount / ETH_USD;
  }
}
