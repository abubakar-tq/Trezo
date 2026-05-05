import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { getRampProvider } from "../_shared/ramp/factory.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "content-type": "application/json", ...(init.headers || {}) },
    ...init,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const { walletAddress, chainId, fiatCurrency, fiatAmount, cryptoCurrency, provider: requestedProvider } = await req.json();

    if (!walletAddress || !chainId || !fiatCurrency || !fiatAmount || !cryptoCurrency) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    const provider = getRampProvider(requestedProvider);
    const session = await provider.createSession({
      userId: user.id,
      walletAddress,
      chainId,
      fiatCurrency,
      fiatAmount,
      cryptoCurrency,
    });

    return json({
      success: true,
      ...session
    });
  } catch (error) {
    console.error("OnRamp Session Error:", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
});
