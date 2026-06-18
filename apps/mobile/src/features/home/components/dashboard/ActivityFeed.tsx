import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { FontFamilies } from "@shared/components/TokenRegistry";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TransactionHistoryService } from "@/src/features/transactions/services/TransactionHistoryService";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { resolveNetworkKey, type NetworkKey } from "@/src/integration/networks";
import type { SupportedChainId } from "@/src/integration/chains";
import { useUserStore } from "@/src/store/useUserStore";
import { getSupabaseClient } from "@/src/lib/supabase";

interface ActivityFeedProps {
  limit?: number;
}

const relativeTime = (iso: string): string => {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "-";
  const delta = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86_400)}d ago`;
};

const getTypeLabel = (tx: WalletTransaction): string => {
  if (tx.direction === "incoming") {
    return "Received";
  }
  switch (tx.type) {
    case "send_native":
      return "Send Native";
    case "send_erc20":
      return "Send Token";
    default:
      return tx.type.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
};

const getIcon = (tx: WalletTransaction): keyof typeof Feather.glyphMap => {
  if (tx.direction === "incoming") return "arrow-down-left";
  if (tx.type === "send_native" || tx.type === "send_erc20") return "arrow-up-right";
  if (tx.type === "swap" || tx.type === "cross_chain_swap") return "repeat";
  if (tx.type === "bridge") return "shuffle";
  if (tx.type === "module_install") return "tool";
  if (tx.type === "recovery") return "shield";
  return "activity";
};

const getStatusColor = (status: WalletTransaction["status"], success: string, warning: string, danger: string, muted: string): string => {
  if (status === "confirmed") return success;
  if (status === "pending" || status === "submitted" || status === "signing") return warning;
  if (status === "failed" || status === "cancelled" || status === "dropped") return danger;
  return muted;
};

const FAILED_STATUSES: readonly WalletTransaction["status"][] = [
  "failed",
  "cancelled",
  "dropped",
];

const isFailedStatus = (status: WalletTransaction["status"]): boolean =>
  FAILED_STATUSES.includes(status);

const getNetworkKey = (chainId: number): NetworkKey | null => {
  try {
    return resolveNetworkKey(chainId as SupportedChainId);
  } catch {
    return null;
  }
};

const getAmount = (tx: WalletTransaction): string => {
  if (!tx.amountDisplay || !tx.tokenSymbol) return "-";
  if (isFailedStatus(tx.status)) {
    return tx.amountDisplay;
  }
  const sign = tx.direction === "outgoing" ? "-" : tx.direction === "incoming" ? "+" : "";
  return `${sign}${tx.amountDisplay}`;
};

import { PushPermissionBanner } from "@/src/features/notifications/components/PushPermissionBanner";

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ limit = 3 }) => {
  const navigation = useNavigation<any>();
  const { theme } = useAppTheme();
  const { colors } = theme;

  const user = useUserStore((state) => state.user);
  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);

  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const walletAddress = aaAccount?.predictedAddress ?? smartAccountAddress;

  const load = useCallback(async (silent = false) => {
    if (!user?.id || !walletAddress) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const chainId = activeChainId ?? aaAccount?.chainId;
      const networkKey = chainId ? getNetworkKey(chainId) : null;
      if (!silent) setLoading(true);
      const result = await TransactionHistoryService.listForWallet({
        userId: user.id,
        walletAddress: walletAddress as `0x${string}`,
        limit,
        backfillIfEmpty: networkKey && chainId
          ? { aaWalletId: aaAccount?.id ?? null, networkKey, chainId }
          : undefined,
      });
      setRows(result);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [aaAccount?.chainId, aaAccount?.id, aaAccount?.predictedAddress, activeChainId, limit, walletAddress, user?.id]);

  // Reload on tab focus
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: re-fetch silently when a new wallet_transactions row lands for this wallet
  useEffect(() => {
    if (!user?.id || !walletAddress) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`activity-feed-${walletAddress}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "wallet_transactions",
          filter: `wallet_address=eq.${(walletAddress as string).toLowerCase()}`,
        },
        () => { load(true); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, walletAddress, load]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (rows.length === 0) {
    // Spec §5.1: real EmptyState block, NOT 12px muted text
    return (
      <View style={[styles.emptyWrap, { borderColor: colors.glassBorder }]}>
        <View style={[styles.emptyIconBox, { backgroundColor: `${colors.accent}14`, borderColor: `${colors.accent}22` }]}>
          <Feather name="activity" size={22} color={colors.accent} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No activity yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Your transactions will appear here after your first send or swap.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PushPermissionBanner />
      <View style={styles.list}>
        {rows.map((tx, index) => (
          <TouchableOpacity
            key={tx.id}
            style={[
              styles.item,
              index !== rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("TransactionStatus", { transactionId: tx.id })}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBox, { backgroundColor: colors.glass, borderColor: colors.glassBorder }]}> 
                <Feather name={getIcon(tx)} size={16} color={colors.accent} strokeWidth={1.5} />
              </View>
              <View style={styles.textContainer}>
                <Text
                  style={[styles.typeText, { color: colors.textPrimary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {getTypeLabel(tx)} {tx.tokenSymbol ?? ""}
                </Text>
                <Text style={[styles.timeText, { color: colors.textSecondary }]}>{relativeTime(tx.createdAt)}</Text>
              </View>
            </View>

            <View style={styles.itemRight}>
              {isFailedStatus(tx.status) ? (
                <View style={[styles.failedBadge, { backgroundColor: colors.dangerSoft }]}>
                  <Text style={[styles.failedBadgeText, { color: colors.danger }]}>Failed</Text>
                </View>
              ) : null}
              <Text
                style={[
                  styles.amountText,
                  {
                    color: isFailedStatus(tx.status) ? colors.textMuted : colors.textPrimary,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {getAmount(tx)}
              </Text>
              <View
                style={[
                  styles.statusIndicator,
                  {
                    backgroundColor: getStatusColor(
                      tx.status,
                      colors.success,
                      colors.warning,
                      colors.danger,
                      colors.textMuted,
                    ),
                  },
                ]}
              />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  list: {
    gap: 0,
  },
  loadingWrap: {
    paddingVertical: 16,
  },
  emptyWrap: {
    paddingVertical: 28,
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  emptyIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    minHeight: 64,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  iconBox: {
    width: 44,
    height: 44,
    // Spec §3: radius scale — 12 for token chips/icons (was offending 14)
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  typeText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  itemRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    flexShrink: 0,
    paddingLeft: 12,
  },
  amountText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: FontFamilies.mono,
    textAlign: "right",
  },
  statusIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  failedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  failedBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
