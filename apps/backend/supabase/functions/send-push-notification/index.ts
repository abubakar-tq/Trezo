// Supabase Edge Function: send-push-notification
//
// Invoked by a Supabase Database Webhook on INSERT into public.notifications.
// Fetches the user's notification preferences + active Expo push tokens, gates
// delivery on the per-category opt-in, and dispatches via the Expo push API.
//
// Environment:
//   SUPABASE_URL                 (provided automatically)
//   SUPABASE_SERVICE_ROLE_KEY    (provided automatically)
//   EXPO_ACCESS_TOKEN            (optional, recommended for higher rate limits)

import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type NotificationCategory =
  | "incoming_transfer"
  | "outgoing_tx"
  | "swap"
  | "security"
  | "recovery"
  | "system";

type NotificationRecord = {
  id: string;
  user_id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
  status: string;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: NotificationRecord;
  old_record?: NotificationRecord | null;
};

type Preferences = {
  push_enabled: boolean;
  tx_alerts: boolean;
  swap_alerts: boolean;
  security_alerts: boolean;
  marketing: boolean;
};

type DeviceToken = {
  id: string;
  token: string;
  platform: "ios" | "android";
};

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default";
  channelId?: string;
  priority?: "default" | "high";
};

type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

type ExpoResponse = { data?: ExpoTicket[] };

const EXPO_PUSH_ENDPOINT = "https://exp.host/--/api/v2/push/send";
const DEFAULT_PREFERENCES: Preferences = {
  push_enabled: true,
  tx_alerts: true,
  swap_alerts: true,
  security_alerts: true,
  marketing: false,
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[send-push-notification] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const admin = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null;

const isCategoryAllowed = (category: NotificationCategory, prefs: Preferences): boolean => {
  if (!prefs.push_enabled) return false;
  switch (category) {
    case "incoming_transfer":
    case "outgoing_tx":
      return prefs.tx_alerts;
    case "swap":
      return prefs.swap_alerts;
    case "security":
    case "recovery":
      return prefs.security_alerts;
    case "system":
      return true;
    default:
      return true;
  }
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const sendToExpo = async (messages: ExpoMessage[]): Promise<ExpoTicket[]> => {
  const tickets: ExpoTicket[] = [];
  for (const batch of chunk(messages, 100)) {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    };
    if (expoAccessToken) headers.Authorization = `Bearer ${expoAccessToken}`;

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    });
    if (!response.ok) {
      console.error("[send-push-notification] expo push failed", response.status, await response.text());
      continue;
    }
    const body = (await response.json()) as ExpoResponse;
    if (Array.isArray(body.data)) tickets.push(...body.data);
  }
  return tickets;
};

const disableInvalidTokens = async (
  client: ReturnType<typeof createClient>,
  pairs: Array<{ tokenId: string; reason: string }>,
): Promise<void> => {
  if (pairs.length === 0) return;
  const ids = pairs.map((p) => p.tokenId);
  const { error } = await client
    .from("device_push_tokens")
    .update({ enabled: false })
    .in("id", ids);
  if (error) {
    console.error("[send-push-notification] failed to disable tokens", error.message);
  }
};

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!admin) {
    return new Response("Server misconfigured", { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "notifications") {
    return new Response(JSON.stringify({ skipped: "non-notification-insert" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const record = payload.record;
  if (!record?.user_id || !record.category) {
    return new Response("Missing required notification fields", { status: 400 });
  }

  const { data: prefsRow } = await admin
    .from("notification_preferences")
    .select("push_enabled,tx_alerts,swap_alerts,security_alerts,marketing")
    .eq("user_id", record.user_id)
    .maybeSingle();

  const prefs: Preferences = (prefsRow as Preferences | null) ?? DEFAULT_PREFERENCES;

  if (!isCategoryAllowed(record.category, prefs)) {
    return new Response(JSON.stringify({ skipped: "category-disabled" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: tokenRows, error: tokensError } = await admin
    .from("device_push_tokens")
    .select("id,token,platform")
    .eq("user_id", record.user_id)
    .eq("enabled", true);

  if (tokensError) {
    console.error("[send-push-notification] failed to load tokens", tokensError.message);
    return new Response("Failed to load tokens", { status: 500 });
  }

  const tokens = (tokenRows ?? []) as DeviceToken[];
  if (tokens.length === 0) {
    return new Response(JSON.stringify({ skipped: "no-tokens" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data: Record<string, unknown> = {
    notification_id: record.id,
    category: record.category,
    ...((record.payload as Record<string, unknown> | null) ?? {}),
  };

  const messages: ExpoMessage[] = tokens.map((t) => ({
    to: t.token,
    title: record.title,
    body: record.body,
    data,
    sound: "default",
    priority: "high",
    channelId: "default",
  }));

  const tickets = await sendToExpo(messages);

  const invalid: Array<{ tokenId: string; reason: string }> = [];
  tickets.forEach((ticket, idx) => {
    if (ticket.status === "error") {
      const code = ticket.details?.error;
      if (code === "DeviceNotRegistered" || code === "InvalidCredentials") {
        const tokenRow = tokens[idx];
        if (tokenRow) invalid.push({ tokenId: tokenRow.id, reason: code });
      }
    }
  });

  await disableInvalidTokens(admin, invalid);

  return new Response(
    JSON.stringify({
      delivered: tickets.filter((t) => t.status === "ok").length,
      errors: tickets.filter((t) => t.status === "error").length,
      disabled_tokens: invalid.length,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
