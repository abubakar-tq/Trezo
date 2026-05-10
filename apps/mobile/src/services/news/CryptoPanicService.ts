// Free public CryptoPanic API. No paid news APIs per brief §3.2.
// Token via EXPO_PUBLIC_CRYPTOPANIC_TOKEN (free, register at cryptopanic.com).

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
};

const BASE = "https://cryptopanic.com/api/v1/posts/";

export const CryptoPanicService = {
  async fetchTop(limit = 12): Promise<NewsItem[]> {
    const token = process.env.EXPO_PUBLIC_CRYPTOPANIC_TOKEN;
    if (!token) return [];
    try {
      const res = await fetch(`${BASE}?auth_token=${token}&public=true&kind=news`);
      if (!res.ok) return [];
      const json = await res.json();
      return ((json.results ?? []) as any[]).slice(0, limit).map((r) => ({
        id: String(r.id),
        title: String(r.title ?? ""),
        url: String(r.url ?? ""),
        source: String(r.source?.title ?? ""),
        publishedAt: String(r.published_at ?? ""),
      }));
    } catch {
      return [];
    }
  },
};
