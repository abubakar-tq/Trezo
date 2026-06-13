// Discover → News feed.
//
// Reads free public RSS feeds from major crypto outlets server-side and returns
// normalized JSON. Running this server-side (not from the app) is deliberate:
//   • Browsers can't fetch third-party RSS directly (no CORS on the feeds);
//     this function adds `Access-Control-Allow-Origin: *` so Expo web works.
//   • No third-party API key is ever required — RSS feeds are open.
//   • The source list can be swapped here without shipping an app update.
//
// Public function: `verify_jwt = false` in config.toml (no secrets, read-only).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      // Let the CDN/edge cache for 10 min; news doesn't need to be real-time.
      "cache-control": "public, max-age=600",
      ...(init.headers || {}),
    },
    ...init,
  });

type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  image: string; // article thumbnail URL, or "" if the feed had none
  publishedAt: string; // ISO 8601, or "" if the feed omitted a date
};

const FEEDS: { source: string; url: string }[] = [
  { source: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml" },
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed" },
];

// ── Tiny in-memory cache ──────────────────────────────────────────────────────
// Warm edge instances reuse module scope, so we avoid re-fetching every request.
let cache: { at: number; items: NewsItem[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x2019;/gi, "’")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/<[^>]+>/g, "") // strip any stray inline tags
    .trim();
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? decodeEntities(m[1]) : "";
}

function extractLink(block: string): string {
  // RSS 2.0: <link>https://…</link>. Atom fallback: <link href="https://…"/>.
  const rss = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
  if (rss && rss[1].trim()) return decodeEntities(rss[1]);
  const atom = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return atom ? atom[1] : "";
}

// Image, in order of preference across the feeds we read:
//   media:content / media:thumbnail (Cointelegraph, Decrypt)
//   enclosure type="image/*"        (Cointelegraph, Decrypt)
//   first <img> in content/description (Bitcoin Magazine)
function extractImage(block: string): string {
  const m =
    block.match(/<media:(?:content|thumbnail)[^>]*\burl=["']([^"']+)["']/i) ||
    block.match(/<enclosure[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\//i) ||
    block.match(/<enclosure[^>]*\btype=["']image\/[^"']*["'][^>]*\burl=["']([^"']+)["']/i) ||
    block.match(/<img[^>]*\bsrc=["']([^"']+)["']/i);
  return m ? m[1].replace(/&amp;/g, "&").trim() : "";
}

function parseRss(xml: string, source: string): NewsItem[] {
  const out: NewsItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  for (const block of blocks) {
    const title = extractTag(block, "title");
    const url = extractLink(block);
    if (!title || !url) continue;
    const rawDate = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated");
    let publishedAt = "";
    if (rawDate) {
      const t = Date.parse(rawDate);
      if (!Number.isNaN(t)) publishedAt = new Date(t).toISOString();
    }
    out.push({ id: url, title, url, source, image: extractImage(block), publishedAt });
  }
  return out;
}

async function fetchFeed(feed: { source: string; url: string }): Promise<NewsItem[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "user-agent": "TrezoWallet/1.0 (+news)", accept: "application/rss+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    return parseRss(await res.text(), feed.source);
  } catch (e) {
    console.warn(`[news] feed failed: ${feed.source}`, (e as Error)?.message);
    return [];
  }
}

async function getNews(): Promise<NewsItem[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.items;

  const results = await Promise.all(FEEDS.map(fetchFeed));
  const seen = new Set<string>();
  const merged: NewsItem[] = [];
  for (const item of results.flat()) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    merged.push(item);
  }
  // Newest first; dateless items sink to the bottom.
  merged.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
  const items = merged.slice(0, 30);

  // Only cache a non-empty result so a transient all-feeds-down blip self-heals.
  if (items.length > 0) cache = { at: Date.now(), items };
  return items;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const items = await getNews();
    return json({ items });
  } catch (e) {
    console.error("[news] handler error", (e as Error)?.message);
    return json({ items: [] }, { status: 200 });
  }
});
