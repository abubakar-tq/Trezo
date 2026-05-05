import { useRoute, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TransactionHistoryService } from "@/src/features/transactions/services/TransactionHistoryService";
import { TransactionReceiptTracker } from "@/src/features/transactions/services/TransactionReceiptTracker";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import type { RootStackParamList } from "@/src/types/navigation";

type TransactionDetailRoute = RouteProp<RootStackParamList, "TransactionDetail">;

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }
  return String(value);
};

export const TransactionDetailScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const route = useRoute<TransactionDetailRoute>();

  const [row, setRow] = useState<WalletTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (withRefresh: boolean) => {
    try {
      setError(null);
      if (withRefresh) {
        await TransactionReceiptTracker.refreshTransactionStatus({
          transactionId: route.params.transactionId,
        });
      }

      const next = await TransactionHistoryService.getById(route.params.transactionId);
      if (!next) {
        setRow(null);
        setError("Transaction not found.");
        return;
      }
      setRow(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction details.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [route.params.transactionId]);

  useEffect(() => {
    setLoading(true);
    load(false);
  }, [load]);

  const detailRows = useMemo(() => {
    if (!row) return [] as { label: string; value: unknown }[];

    return [
      { label: "ID", value: row.id },
      { label: "Type", value: row.type },
      { label: "Status", value: row.status },
      { label: "Chain", value: row.chainId },
      { label: "Wallet", value: row.walletAddress },
      { label: "Direction", value: row.direction },
      { label: "From", value: row.fromAddress },
      { label: "To", value: row.toAddress },
      { label: "Target", value: row.targetAddress },
      { label: "Token Type", value: row.tokenType },
      { label: "Token", value: row.tokenAddress },
      { label: "Token Symbol", value: row.tokenSymbol },
      { label: "Token Decimals", value: row.tokenDecimals },
      { label: "Amount (display)", value: row.amountDisplay },
      { label: "Amount (raw)", value: row.amountRaw },
      { label: "Value (raw)", value: row.valueRaw },
      { label: "Calldata", value: row.calldata },
      { label: "UserOp", value: row.userOpHash },
      { label: "Tx Hash", value: row.transactionHash },
      { label: "Block", value: row.blockNumber },
      { label: "Bundler", value: row.bundlerUrl },
      { label: "EntryPoint", value: row.entryPoint },
      { label: "Fee mode", value: row.feeMode },
      { label: "Paymaster used", value: row.paymasterUsed },
      { label: "Intent ID", value: row.intentId },
      { label: "Parent Tx", value: row.parentTransactionId },
      { label: "Sequence", value: row.sequenceIndex },
      { label: "Metadata", value: row.metadata },
      { label: "Error code", value: row.errorCode },
      { label: "Error message", value: row.errorMessage },
      { label: "Debug", value: row.debugContext },
      { label: "Created", value: row.createdAt },
      { label: "Prepared", value: row.preparedAt },
      { label: "Signing started", value: row.signingStartedAt },
      { label: "Signed", value: row.signedAt },
      { label: "Submitted", value: row.submittedAt },
      { label: "Confirmed", value: row.confirmedAt },
      { label: "Failed", value: row.failedAt },
      { label: "Updated", value: row.updatedAt },
    ];
  }, [row]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Transaction Detail</Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Loading details...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: withAlpha(colors.danger, 0.12), borderColor: withAlpha(colors.danger, 0.3) }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {detailRows.map((item) => (
          <View key={item.label} style={[styles.row, { borderColor: withAlpha(colors.border, 0.2), backgroundColor: withAlpha(colors.surfaceCard, 0.78) }]}>
            <Text style={[styles.key, { color: colors.textMuted }]}>{item.label}</Text>
            <Text style={[styles.value, { color: colors.textPrimary }]}>{formatValue(item.value)}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={() => {
            setRefreshing(true);
            load(true);
          }}
        >
          <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>{refreshing ? "Refreshing..." : "Refresh"}</Text>
        </TouchableOpacity>
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
    gap: 10,
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    marginBottom: 2,
  },
  centered: {
    alignItems: "center",
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
  },
  errorText: {
    fontSize: 12,
    fontWeight: "600",
  },
  row: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  key: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  value: {
    fontSize: 12,
    fontWeight: "500",
  },
  button: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});

export default TransactionDetailScreen;
