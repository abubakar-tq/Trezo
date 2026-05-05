export type NotificationCategory =
  | "incoming_transfer"
  | "outgoing_tx"
  | "swap"
  | "security"
  | "recovery"
  | "system";

export type NotificationStatus = "unread" | "read";

export type NotificationDeeplink = {
  screen: string;
  params?: Record<string, unknown>;
};

export type NotificationPayload = {
  tx_id?: string;
  tx_hash?: string | null;
  user_op_hash?: string | null;
  chain_id?: number;
  token_address?: string | null;
  token_symbol?: string | null;
  token_decimals?: number | null;
  amount_raw?: string | null;
  amount_display?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  direction?: "incoming" | "outgoing" | "self";
  type?: string;
  status?: string;
  deeplink?: NotificationDeeplink;
  [key: string]: unknown;
};

export type AppNotification = {
  id: string;
  userId: string;
  aaWalletId: string | null;
  category: NotificationCategory;
  status: NotificationStatus;
  title: string;
  body: string;
  icon: string | null;
  accent: string | null;
  relatedTxId: string | null;
  payload: NotificationPayload;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
};

export type NotificationPreferences = {
  pushEnabled: boolean;
  txAlerts: boolean;
  swapAlerts: boolean;
  securityAlerts: boolean;
  marketing: boolean;
  updatedAt?: string;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  txAlerts: true,
  swapAlerts: true,
  securityAlerts: true,
  marketing: false,
};
