import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PIMLICO_API_KEY = Deno.env.get("PIMLICO_API_KEY")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    // Expected path: /functions/v1/pimlico-relay/v2/<chain>/<service>
    const v2Index = pathParts.findIndex(p => p === 'v2');
    if (v2Index === -1 || v2Index + 2 >= pathParts.length) {
      throw new Error("Invalid RPC path format")
    }

    const chain = pathParts[v2Index + 1];
    const service = pathParts[v2Index + 2];
    const pimlicoUrl = `https://api.pimlico.io/v2/${chain}/${service}?apikey=${PIMLICO_API_KEY}`

    const bodyText = await req.text()
    
    const response = await fetch(pimlicoUrl, {
      method: req.method,
      headers: { "Content-Type": "application/json" },
      body: bodyText ? bodyText : undefined
    })

    const data = await response.text()

    return new Response(data, {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: response.status
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 400
    })
  }
})
