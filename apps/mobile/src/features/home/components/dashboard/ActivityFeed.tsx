import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TransactionHistoryService } from "@/src/features/transactions/services/TransactionHistoryService";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useUserStore } from "@/src/store/useUserStore";

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

const getAmount = (tx: WalletTransaction): string => {
  if (!tx.amountDisplay || !tx.tokenSymbol) return "-";
  if (isFailedStatus(tx.status)) {
    return tx.amountDisplay;
  }
  const sign = tx.direction === "outgoing" ? "-" : tx.direction === "incoming" ? "+" : "";
  return `${sign}${tx.amountDisplay}`;
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ limit = 3 }) => {
  const navigation = useNavigation<any>();
  const { theme } = useAppTheme();
  const { colors } = theme;

  const user = useUserStore((state) => state.user);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);

  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const load = async () => {
        if (!user?.id || !aaAccount?.predictedAddress) {
          if (!cancelled) {
            setRows([]);
            setLoading(false);
          }
          return;
        }

        try {
          setLoading(true);
          const result = await TransactionHistoryService.listForWallet({
            userId: user.id,
            walletAddress: aaAccount.predictedAddress as `0x${string}`,
            chainId: aaAccount.chainId ?? activeChainId,
            limit,
          });

          if (!cancelled) {
            setRows(result);
          }
        } catch {
          if (!cancelled) {
            setRows([]);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

      load();

      return () => {
        cancelled = true;
      };
    }, [aaAccount?.chainId, aaAccount?.predictedAddress, activeChainId, limit, user?.id]),
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.accent} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent activity yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.list}>
        {rows.map((tx, index) => (
          <TouchableOpacity
            key={tx.id}
            style={[
              styles.item,
              index !== rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: withAlpha(colors.accent, 0.08) },
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
                <View style={[styles.failedBadge, { backgroundColor: withAlpha(colors.danger, 0.15) }]}>
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
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 12,
    fontWeight: "500",
  },
  item: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    minHeight: 80,
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 0.65,
    gap: 16,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    flex: 0.35,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
  },
  amountText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    fontFamily: "monospace",
    textAlign: "right",
  },
  statusIndicator: {
    width: 6,
    height: 14,
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
