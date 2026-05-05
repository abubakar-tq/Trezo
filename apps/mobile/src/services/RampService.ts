import { getSupabaseClient } from '../lib/supabase';
import { CreateOnRampSessionParams, OnRampSession, RampOrder } from '../types/ramp';

// ─── Row mapper (DB snake_case → TS camelCase) ────────────────────────────────
function mapRow(d: any): RampOrder {
  return {
    id: d.id,
    userId: d.user_id,
    walletAddress: d.wallet_address,
    chainId: d.chain_id,
    provider: d.provider,
    providerOrderId: d.provider_order_id ?? undefined,
    providerStatus: d.provider_status,
    internalStatus: d.internal_status,
    rampType: d.ramp_type ?? 'buy',
    fiatCurrency: d.fiat_currency,
    fiatAmount: Number(d.fiat_amount),
    cryptoCurrency: d.crypto_currency,
    cryptoAmount: d.crypto_amount != null ? Number(d.crypto_amount) : undefined,
    txHash: d.tx_hash ?? undefined,
    localFulfillmentTxHash: d.local_fulfillment_tx_hash ?? undefined,
    rawPayload: d.raw_payload ?? undefined,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// ─── RampService ──────────────────────────────────────────────────────────────

export class RampService {
  private static async getAuthToken(): Promise<string | undefined> {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  private static async callFunction<T = unknown>(name: string, body: unknown): Promise<T> {
    const supabase = getSupabaseClient();
    const token = await this.getAuthToken();

    const { data, error } = await supabase.functions.invoke(name, {
      body: body as Record<string, unknown>,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) {
      console.error(`[RampService] Function ${name} failed:`, error);
      throw error;
    }
    return data as T;
  }

  /**
   * Create a new on-ramp session via the onramp-session edge function.
   * Returns the orderId, provider, status, and (for Transak) the widget URL.
   */
  static async createSession(params: CreateOnRampSessionParams): Promise<OnRampSession> {
    return this.callFunction<OnRampSession>('onramp-session', params);
  }

  /**
   * Fetch a single order by ID directly from the ramp_orders table (via RLS).
   */
  static async getOrder(orderId: string): Promise<RampOrder> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ramp_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) throw error;
    return mapRow(data);
  }

  /**
   * Complete a mock order by directly sending ETH from the Anvil funder wallet
   * to the target wallet address — runs CLIENT-SIDE on the mobile device.
   *
   * This avoids the cloud edge-function → tunnel → local Anvil path entirely.
   * The funder key is Anvil's well-known account #1 (safe for local dev only).
   */
  static async completeMockOrder(orderId: string): Promise<{ success: boolean; localTxHash?: string }> {
    const supabase = getSupabaseClient();

    // 1. Load the order
    const { data: order, error: fetchErr } = await supabase
      .from('ramp_orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchErr || !order) throw new Error('Order not found');
    if (order.provider !== 'mock') throw new Error('Only mock orders can be completed this way');

    // 2. Estimate ETH amount from fiat (same logic as backend)
    const prices: Record<string, number> = {
      ETH: 2500, BTC: 65000, MATIC: 0.85, BNB: 580, USDC: 1, USDT: 1,
    };
    const price = prices[(order.crypto_currency as string).toUpperCase()] ?? 2500;
    const ethAmount = (Number(order.fiat_amount) / price).toFixed(6);

    // 3. Send ETH directly on Anvil from the well-known funder private key
    //    Anvil account #1 private key — NEVER use outside local dev
    const ANVIL_FUNDER_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

    try {
      const { ethers } = await import('ethers');
      const { getRpcUrl } = await import('../core/network/chain');

      const rpcUrl = getRpcUrl();
      console.log(`[RampService] Mock fulfill: ${ethAmount} ETH → ${order.wallet_address} via ${rpcUrl}`);

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const funder = new ethers.Wallet(ANVIL_FUNDER_KEY, provider);
      const tx = await funder.sendTransaction({
        to: order.wallet_address,
        value: ethers.parseEther(ethAmount),
      });
      await tx.wait(); // wait for block inclusion
      const localTxHash = tx.hash;
      console.log(`[RampService] Mock fulfill ✅ txHash: ${localTxHash}`);

      // 4. Update the order in Supabase (requires UPDATE RLS policy on ramp_orders)
      const { error: updateErr } = await supabase
        .from('ramp_orders')
        .update({
          internal_status: 'local_mock_completed',
          provider_status: 'COMPLETED',
          local_fulfillment_tx_hash: localTxHash,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (updateErr) {
        // ETH already sent — log but don't fail the whole operation
        console.error('[RampService] DB update failed (ETH was sent!):', updateErr);
        throw new Error(`DB update failed: ${updateErr.message}. ETH was sent (txHash: ${localTxHash})`);
      }

      console.log('[RampService] DB updated to local_mock_completed ✅');
      return { success: true, localTxHash };

    } catch (err: any) {
      console.error('[RampService] Mock fulfill failed:', err);
      throw new Error(err.message ?? 'Anvil transaction failed');
    }
  }


  /**
   * Called by TransakWebViewModal when TRANSAK_ORDER_SUCCESSFUL fires.
   * Forwards the event to onramp-webhook so the DB order status is updated
   * without needing Transak to have our webhook URL registered.
   */
  static async notifyWebhook(orderId: string, transakData: any): Promise<void> {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke('onramp-webhook', {
      body: {
        eventID: transakData.status || 'ORDER_COMPLETED',
        data: {
          partnerOrderId: orderId,
          status: transakData.status ?? 'ORDER_COMPLETED',
          cryptoAmount: transakData.cryptoAmount,
          transactionHash: transakData.transactionHash,
        },
      },
    });
    if (error) console.error('[RampService] notifyWebhook failed:', error);
  }

  /**
   * List recent orders for the current authenticated user.
   */
  static async listOrders(limit = 10): Promise<RampOrder[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ramp_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapRow);
  }

  /**
   * List orders for a specific wallet address.
   */
  static async getOrdersByWallet(walletAddress: string, limit = 20): Promise<RampOrder[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ramp_orders')
      .select('*')
      .eq('wallet_address', walletAddress)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map(mapRow);
  }
}
