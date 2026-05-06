import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { TransactionStatusBadge } from "@/src/features/transactions/components/TransactionStatusBadge";
import { TransactionHistoryService } from "@/src/features/transactions/services/TransactionHistoryService";
import { TransactionReceiptTracker } from "@/src/features/transactions/services/TransactionReceiptTracker";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import type { RootStackParamList } from "@/src/types/navigation";

type TransactionStatusRoute = RouteProp<RootStackParamList, "TransactionStatus">;

const shorten = (value?: string | null, head = 8, tail = 6): string => {
  if (!value) return "-";
  if (value.length <= head + tail) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
};

const getTypeLabel = (type: WalletTransaction["type"]): string => {
  if (type === "send_native") return "Send Native";
  if (type === "send_erc20") return "Send Token";
  return type.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
};

export const TransactionStatusScreen: React.FC = () => {
  const route = useRoute<TransactionStatusRoute>();
  const navigation = useNavigation<any>();
  const { theme } = useAppTheme();
  const { colors } = theme;

  const [row, setRow] = useState<WalletTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async (withRefresh: boolean) => {
    try {
      setError(null);
      if (withRefresh) {
        await TransactionReceiptTracker.refreshTransactionStatus({
          transactionId: route.params.transactionId,
        });
      }

      const next = await TransactionHistoryService.getById(route.params.transactionId);
      if (!next) {
        setError("Transaction not found.");
        setRow(null);
        return;
      }
      setRow(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transaction status.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [route.params.transactionId]);

  useEffect(() => {
    setLoading(true);
    loadStatus(false);
  }, [loadStatus]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <TouchableOpacity
        accessibilityLabel="Close"
        style={styles.closeButton}
        onPress={() => navigation.popToTop()}
        hitSlop={8}
      >
        <Feather name="x" size={22} color={colors.textPrimary} />
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }, { paddingLeft: 48 }]}>Transaction Status</Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Loading status...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={[styles.errorCard, { backgroundColor: withAlpha(colors.danger, 0.12), borderColor: withAlpha(colors.danger, 0.3) }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {row ? (
          <View style={[styles.card, { backgroundColor: withAlpha(colors.surfaceCard, 0.78), borderColor: withAlpha(colors.border, 0.24) }]}>
            <View style={styles.cardTop}>
              <View>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{getTypeLabel(row.type)}</Text>
                <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>ID {shorten(row.id)}</Text>
              </View>
              <TransactionStatusBadge status={row.status} />
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Amount</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{row.amountDisplay ?? "-"} {row.tokenSymbol ?? ""}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>UserOp</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{shorten(row.userOpHash)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Tx Hash</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{shorten(row.transactionHash)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Block</Text>
              <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{row.blockNumber ? row.blockNumber.toString() : "-"}</Text>
            </View>
            {row.errorMessage ? (
              <View style={[styles.errorInline, { backgroundColor: withAlpha(colors.danger, 0.12) }]}> 
                <Feather name="alert-circle" size={14} color={colors.danger} />
                <Text style={[styles.errorInlineText, { color: colors.danger }]}>{row.errorMessage}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.accent }]}
          onPress={() => {
            setRefreshing(true);
            loadStatus(true);
          }}
        >
          <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>{refreshing ? "Refreshing..." : "Refresh Status"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: withAlpha(colors.border, 0.35), backgroundColor: withAlpha(colors.surfaceCard, 0.75) }]}
          onPress={() => navigation.navigate("TransactionDetail", { transactionId: route.params.transactionId })}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Open Details</Text>
        </TouchableOpacity>

        {row && (
          <TouchableOpacity
            style={[styles.doneButton, { backgroundColor: withAlpha(colors.surfaceCard, 0.75), borderColor: withAlpha(colors.border, 0.35) }]}
            onPress={() => navigation.popToTop()}
          >
            <Text style={[styles.doneButtonText, { color: colors.textPrimary }]}>
              {["confirmed", "failed", "cancelled", "dropped"].includes(String(row.status)) ? "Done" : "Close"}
            </Text>
          </TouchableOpacity>
        )}
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
    fontSize: 25,
    fontWeight: "800",
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
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  cardMeta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
    maxWidth: "70%",
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
  errorInline: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorInlineText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  closeButton: {
    position: "absolute",
    top: 14,
    left: 12,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  doneButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  doneButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});

export default TransactionStatusScreen;
