// Discover → News feed.
//
// News comes from our own Supabase edge function (`news`), which aggregates free
// public RSS feeds server-side. No third-party API key, and it works on Expo web
// because the edge function adds CORS headers (the raw RSS feeds do not).
//
// Returns [] on any failure so the News section hides itself gracefully.
import { getSupabaseClient } from "../../lib/supabase";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  image: string;
  publishedAt: string;
};

export const NewsService = {
  async fetchTop(limit = 12): Promise<NewsItem[]> {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke<{ items: NewsItem[] }>("news");
      if (error || !data?.items?.length) return [];
      return data.items.slice(0, limit);
    } catch {
      return [];
    }
  },
};
