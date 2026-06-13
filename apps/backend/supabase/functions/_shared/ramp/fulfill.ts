import { LocalFulfillmentService } from "./LocalFulfillmentService.ts";
import { TestnetFulfillmentService } from "./TestnetFulfillmentService.ts";

/**
 * Deliver funds for a completed order. Single source of truth shared by both
 * completion triggers (the signed webhook and the pull-verify function).
 *
 *   chainId 31337       → Anvil LocalFulfillmentService (existing local demo)
 *   known testnet chain → TestnetFulfillmentService (treasury grant)
 *   mainnet / other     → null (Transak itself delivered the asset)
 *
 * Returns the fulfillment tx hash, or null when no grant was made.
 * Callers must only invoke this for a VERIFIED `completed` order.
 */
/**
 * True when WE must deliver the funds (Transak staging/Anvil don't), so a
 * Transak "completed" should not be treated as final until our grant lands.
 * On mainnet this is false — Transak delivers the asset itself.
 */
export function needsTreasuryGrant(chainId: number): boolean {
  return chainId === 31337 || TestnetFulfillmentService.isTestnetChain(chainId);
}

// deno-lint-ignore no-explicit-any
export async function fulfillCompletedOrder(order: any): Promise<`0x${string}` | null> {
  const params = {
    walletAddress: order.wallet_address,
    fiatAmount: Number(order.fiat_amount),
    cryptoCurrency: order.crypto_currency,
    chainId: order.chain_id,
  };

  if (order.chain_id === 31337) {
    return await new LocalFulfillmentService().fulfill(params);
  }
  if (TestnetFulfillmentService.isTestnetChain(order.chain_id)) {
    return await new TestnetFulfillmentService().fulfill(params);
  }
  console.log(`[fulfill] chain ${order.chain_id}: no fulfillment (Transak delivers on mainnet)`);
  return null;
}
