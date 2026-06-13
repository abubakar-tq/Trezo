import { useFocusEffect, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "@theme";

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Address } from "viem";

import { TransactionListItem } from "@/src/features/transactions/components/TransactionListItem";
import { TransactionHistoryService } from "@/src/features/transactions/services/TransactionHistoryService";
import { TransactionReceiptTracker } from "@/src/features/transactions/services/TransactionReceiptTracker";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { useUserStore } from "@/src/store/useUserStore";
import type { RootStackParamList } from "@/src/types/navigation";

type TransactionHistoryRoute = RouteProp<RootStackParamList, "TransactionHistory">;

/** Number of rows to show by default before the user scrolls. */
const DEFAULT_LIMIT = 20;

export const TransactionHistoryScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const navigation = useNavigation<any>();
  const route = useRoute<TransactionHistoryRoute>();
  const insets = useSafeAreaInsets();

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
        limit: DEFAULT_LIMIT,
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

  const containerPaddingTop = insets.top + 14;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: containerPaddingTop }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Transactions</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.errorCard, { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}4D` }]}>
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : null}

      {!loading && rows.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No transactions yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Your send, swap, and recovery activity will appear here.
          </Text>
        </View>
      ) : null}

      {!loading && rows.length > 0 ? (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          style={styles.list}
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
    gap: 10,
  },
});

export default TransactionHistoryScreen;
