import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Address } from "viem";

import { TransactionListItem } from "@/src/features/transactions/components/TransactionListItem";
import { TransactionHistoryService } from "@/src/features/transactions/services/TransactionHistoryService";
import { TransactionReceiptTracker } from "@/src/features/transactions/services/TransactionReceiptTracker";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useUserStore } from "@/src/store/useUserStore";
import type { RootStackParamList } from "@/src/types/navigation";

type TransactionHistoryRoute = RouteProp<RootStackParamList, "TransactionHistory">;

export const TransactionHistoryScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const navigation = useNavigation<any>();
  const route = useRoute<TransactionHistoryRoute>();

  const user = useUserStore((state) => state.user);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);

  const [rows, setRows] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = useMemo<Address | null>(() => {
    if (route.params?.walletAddress) return route.params.walletAddress;
    if (aaAccount?.predictedAddress) return aaAccount.predictedAddress as Address;
    return null;
  }, [aaAccount?.predictedAddress, route.params?.walletAddress]);

  const chainId = route.params?.chainId ?? aaAccount?.chainId ?? activeChainId;

  const loadRows = useCallback(async (withReconcile: boolean) => {
    if (!user?.id || !walletAddress) {
      setRows([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setError(null);
      if (withReconcile) {
        await TransactionReceiptTracker.reconcilePendingForWallet({
          userId: user.id,
          walletAddress,
          chainId,
          timeoutMs: 1_000,
          pollIntervalMs: 500,
        });
      }

      const nextRows = await TransactionHistoryService.listForWallet({
        userId: user.id,
        walletAddress,
        chainId,
        limit: 100,
      });
      setRows(nextRows);
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

  const summary = useMemo(() => {
    const confirmed = rows.filter((row) => row.status === "confirmed").length;
    const pending = rows.filter((row) => row.status === "pending" || row.status === "submitted").length;
    const failed = rows.filter((row) => row.status === "failed" || row.status === "cancelled" || row.status === "dropped").length;
    return { confirmed, pending, failed };
  }, [rows]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Transaction History</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Lifecycle rows from `wallet_transactions`.</Text>
      </View>

      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.75), borderColor: withAlpha(colors.border, 0.24) }]}> 
          <Text style={[styles.summaryValue, { color: colors.success }]}>{summary.confirmed}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Confirmed</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.75), borderColor: withAlpha(colors.border, 0.24) }]}> 
          <Text style={[styles.summaryValue, { color: colors.warning }]}>{summary.pending}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Pending</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.75), borderColor: withAlpha(colors.border, 0.24) }]}> 
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{summary.failed}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Failed</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Loading transactions...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorCard, { backgroundColor: withAlpha(colors.danger, 0.12), borderColor: withAlpha(colors.danger, 0.3) }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}

      {!loading && rows.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: withAlpha(colors.surfaceCard, 0.75), borderColor: withAlpha(colors.border, 0.22) }]}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No transactions yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>Your send, module, and recovery activity will appear here.</Text>
        </View>
      ) : null}

      {!loading && rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TransactionListItem
              transaction={item}
              onPress={(tx) => navigation.navigate("TransactionDetail", { transactionId: tx.id })}
            />
          )}
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
        />
      ) : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 25,
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
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
  },
  infoText: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "500",
  },
  errorCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
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
  listContent: {
    paddingBottom: 20,
    gap: 10,
  },
});

export default TransactionHistoryScreen;
