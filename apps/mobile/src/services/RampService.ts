import { supabase } from '../lib/supabase';
import { CreateOnRampSessionParams, OnRampSession, RampOrder } from '../types/ramp';

export class RampService {
  private static async getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  }

  private static async callFunction(name: string, body: any) {
    const token = await this.getAuthToken();
    const { data, error } = await supabase.functions.invoke(name, {
      body,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) throw error;
    return data;
  }

  static async createSession(params: CreateOnRampSessionParams): Promise<OnRampSession> {
    return await this.callFunction('onramp-session', params);
  }

  static async getOrder(orderId: string): Promise<RampOrder> {
    const { data, error } = await supabase
      .from('ramp_orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error) throw error;
    
    // Map snake_case to camelCase
    return {
      id: data.id,
      userId: data.user_id,
      walletAddress: data.wallet_address,
      chainId: data.chain_id,
      provider: data.provider,
      providerOrderId: data.provider_order_id,
      providerStatus: data.provider_status,
      internalStatus: data.internal_status,
      rampType: data.ramp_type,
      fiatCurrency: data.fiat_currency,
      fiatAmount: Number(data.fiat_amount),
      cryptoCurrency: data.crypto_currency,
      cryptoAmount: data.crypto_amount ? Number(data.crypto_amount) : undefined,
      txHash: data.tx_hash,
      localFulfillmentTxHash: data.local_fulfillment_tx_hash,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  static async completeMockOrder(orderId: string): Promise<{ success: boolean; localTxHash?: string }> {
    return await this.callFunction('dev-mock-complete', { orderId });
  }

  static async listOrders(limit = 10): Promise<RampOrder[]> {
    const { data, error } = await supabase
      .from('ramp_orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data.map((d: any) => ({
      ...d,
      userId: d.user_id,
      walletAddress: d.wallet_address,
      chainId: d.chain_id,
      fiatAmount: Number(d.fiat_amount),
      cryptoAmount: d.crypto_amount ? Number(d.crypto_amount) : undefined,
    }));
  }
}
