import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const COINCAP_API_KEY = Deno.env.get("COINCAP_API_KEY")
const BINANCE_API_KEY = Deno.env.get("BINANCE_API_KEY")
const MORALIS_API_KEY = Deno.env.get("MORALIS_API_KEY")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } })
  }

  try {
    const url = new URL(req.url);
    // Path looks like: /functions/v1/crypto-prices/moralis/erc20/...
    const pathParts = url.pathname.split('/');
    const providerIndex = pathParts.findIndex(p => p === 'crypto-prices') + 1;
    const provider = pathParts[providerIndex];
    const targetPath = '/' + pathParts.slice(providerIndex + 1).join('/') + url.search;

    let targetUrl = "";
    let headers = new Headers(req.headers);
    headers.delete('host'); // Don't forward original host
    headers.delete('origin');
    headers.delete('referer');

    if (provider === "coincap") {
      targetUrl = `https://api.coincap.io/v2${targetPath}`
      if (COINCAP_API_KEY) headers.set("Authorization", `Bearer ${COINCAP_API_KEY}`)
    } else if (provider === "binance") {
      targetUrl = `https://api.binance.com${targetPath}`
      if (BINANCE_API_KEY) headers.set("X-MBX-APIKEY", BINANCE_API_KEY)
    } else if (provider === "moralis") {
      targetUrl = `https://deep-index.moralis.io/api/v2.2${targetPath}`
      if (MORALIS_API_KEY) headers.set("X-API-Key", MORALIS_API_KEY)
    } else {
      throw new Error("Invalid provider in path: " + provider)
    }

    const bodyText = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : undefined;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: bodyText
    })

    const data = await response.text()

    const resHeaders = new Headers(response.headers);
    resHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(data, {
      headers: resHeaders,
      status: response.status
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 400
    })
  }
})
