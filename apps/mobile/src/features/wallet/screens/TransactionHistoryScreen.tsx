import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

import { useUserStore } from "@/src/store/useUserStore";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { TransactionHistoryService } from "@/src/features/send/services/TransactionHistoryService";
import { TransactionReceiptTracker } from "@/src/features/send/services/TransactionReceiptTracker";
import type { TransactionRecord } from "@/src/features/send/types/send";

const shorten = (value?: string | null, chars = 8): string => {
  if (!value) return "-";
  if (value.length <= chars * 2) return value;
  return `${value.slice(0, chars)}...${value.slice(-chars)}`;
};

const relativeTime = (iso: string): string => {
  const date = new Date(iso).getTime();
  const deltaSeconds = Math.max(1, Math.floor((Date.now() - date) / 1000));

  if (deltaSeconds < 60) return `${deltaSeconds}s ago`;
  if (deltaSeconds < 3600) return `${Math.floor(deltaSeconds / 60)}m ago`;
  if (deltaSeconds < 86400) return `${Math.floor(deltaSeconds / 3600)}h ago`;
  return `${Math.floor(deltaSeconds / 86400)}d ago`;
};

const statusColor = (status: TransactionRecord["status"], success: string, warning: string, danger: string, muted: string) => {
  if (status === "confirmed") return success;
  if (status === "pending" || status === "submitted" || status === "signing") return warning;
  if (status === "failed" || status === "cancelled" || status === "dropped") return danger;
  return muted;
};

interface TransactionHistoryScreenProps {
  isDark?: boolean;
}

export const TransactionHistoryScreen: React.FC<TransactionHistoryScreenProps> = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const user = useUserStore((state) => state.user);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);

  const [rows, setRows] = useState<TransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = aaAccount?.predictedAddress ?? null;
  const chainId = (aaAccount?.chainId ?? activeChainId) || undefined;

  const loadRows = useCallback(async (withResume: boolean) => {
    if (!user?.id || !walletAddress) {
      setRows([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      if (withResume) {
        await TransactionReceiptTracker.resumePendingForWallet(user.id, walletAddress, chainId, {
          timeoutMs: 1_000,
          pollIntervalMs: 500,
        });
      }

      const next = await TransactionHistoryService.listForWallet(user.id, walletAddress, chainId);
      setRows(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [chainId, user?.id, walletAddress]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadRows(true);
    }, [loadRows]),
  );

  const totals = useMemo(() => {
    const confirmed = rows.filter((row) => row.status === "confirmed").length;
    const pending = rows.filter((row) => row.status === "pending" || row.status === "submitted" || row.status === "signing").length;
    const failed = rows.filter((row) => row.status === "failed" || row.status === "cancelled" || row.status === "dropped").length;
    return {
      total: rows.length,
      confirmed,
      pending,
      failed,
    };
  }, [rows]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.accent}
            onRefresh={() => {
              setRefreshing(true);
              loadRows(true);
            }}
          />
        }
      >
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Transaction History</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Real lifecycle rows from wallet transactions.</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.7), borderColor: withAlpha(colors.border, 0.2) }]}>
            <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{totals.total}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Total</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.7), borderColor: withAlpha(colors.border, 0.2) }]}>
            <Text style={[styles.summaryValue, { color: colors.success }]}>{totals.confirmed}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Confirmed</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.7), borderColor: withAlpha(colors.border, 0.2) }]}>
            <Text style={[styles.summaryValue, { color: colors.warning }]}>{totals.pending}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Pending</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.centeredBlock}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading history...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: withAlpha(colors.danger, 0.12), borderColor: withAlpha(colors.danger, 0.3) }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {!loading && rows.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.7), borderColor: withAlpha(colors.border, 0.2) }]}>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No transactions yet</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Your send activity will appear here once submitted.</Text>
          </View>
        ) : null}

        {rows.map((row) => (
          <View
            key={row.id}
            style={[styles.rowCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.75), borderColor: withAlpha(colors.border, 0.2) }]}
          >
            <View style={styles.rowTop}>
              <View>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Sent {row.tokenSymbol}</Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>{relativeTime(row.createdAt)}</Text>
              </View>
              <Text
                style={[
                  styles.statusBadge,
                  {
                    color: statusColor(row.status, colors.success, colors.warning, colors.danger, colors.textMuted),
                    borderColor: withAlpha(statusColor(row.status, colors.success, colors.warning, colors.danger, colors.textMuted), 0.4),
                    backgroundColor: withAlpha(statusColor(row.status, colors.success, colors.warning, colors.danger, colors.textMuted), 0.12),
                  },
                ]}
              >
                {row.status}
              </Text>
            </View>

            <Text style={[styles.rowAmount, { color: colors.textPrimary }]}>-{row.amountDisplay} {row.tokenSymbol}</Text>
            <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>To: {shorten(row.toAddress)}</Text>
            <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>UserOp: {shorten(row.userOpHash)}</Text>
            <Text style={[styles.rowMeta, { color: colors.textSecondary }]}>Tx: {shorten(row.transactionHash)}</Text>
            {row.errorMessage ? (
              <Text style={[styles.rowMeta, { color: colors.danger }]}>Error: {row.errorMessage}</Text>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  centeredBlock: {
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 12,
    textAlign: "center",
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 5,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: "800",
  },
  rowMeta: {
    fontSize: 11,
    fontWeight: "500",
  },
  statusBadge: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});

export default TransactionHistoryScreen;
