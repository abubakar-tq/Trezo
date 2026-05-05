import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getChainConfig } from "@/src/integration/chains";
import type { SupportedChainId } from "@/src/integration/chains";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import { TransactionStatusBadge } from "@/src/features/transactions/components/TransactionStatusBadge";

const shorten = (value?: string | null, head = 6, tail = 4): string => {
  if (!value) return "-";
  if (value.length <= head + tail) return value;
  return `${value.slice(0, head)}...${value.slice(-tail)}`;
};

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
    case "token_approval":
      return "Token Approval";
    case "cross_chain_swap":
      return "Cross-chain Swap";
    case "module_install":
      return "Module Install";
    default:
      return tx.type.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
};

const getIcon = (tx: WalletTransaction): keyof typeof Feather.glyphMap => {
  if (tx.type === "send_native" || tx.type === "send_erc20") return "arrow-up-right";
  if (tx.type === "swap" || tx.type === "cross_chain_swap") return "repeat";
  if (tx.type === "bridge") return "shuffle";
  if (tx.type === "token_approval") return "check-circle";
  if (tx.type === "module_install") return "tool";
  if (tx.type === "recovery") return "shield";
  return "activity";
};

const getAmountText = (tx: WalletTransaction): string => {
  if (!tx.amountDisplay || !tx.tokenSymbol) return "-";
  const sign = tx.direction === "outgoing" ? "-" : tx.direction === "incoming" ? "+" : "";
  return `${sign}${tx.amountDisplay} ${tx.tokenSymbol}`;
};

export const TransactionListItem: React.FC<{
  transaction: WalletTransaction;
  onPress?: (transaction: WalletTransaction) => void;
}> = ({ transaction, onPress }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  let chainName = `Chain ${transaction.chainId}`;
  try {
    chainName = getChainConfig(transaction.chainId as SupportedChainId).name;
  } catch {
    chainName = `Chain ${transaction.chainId}`;
  }
  const counterparty = transaction.toAddress ?? transaction.targetAddress ?? transaction.fromAddress;
  const hash = transaction.transactionHash ?? transaction.userOpHash;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: withAlpha(colors.surfaceCard, pressed ? 0.9 : 0.78),
          borderColor: withAlpha(colors.border, 0.24),
        },
      ]}
      onPress={() => onPress?.(transaction)}
    >
      <View style={styles.topRow}>
        <View style={styles.titleWrap}>
          <View style={[styles.iconWrap, { backgroundColor: withAlpha(colors.accent, 0.12), borderColor: withAlpha(colors.accent, 0.24) }]}>
            <Feather name={getIcon(transaction)} size={14} color={colors.accent} />
          </View>
          <View style={styles.titleTextWrap}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{getTypeLabel(transaction)}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>{chainName} • {relativeTime(transaction.createdAt)}</Text>
          </View>
        </View>
        <TransactionStatusBadge status={transaction.status} />
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.leftCol}>
          <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>To {shorten(counterparty)}</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>Hash {shorten(hash)}</Text>
        </View>
        <Text style={[styles.amount, { color: colors.textPrimary }]} numberOfLines={1}>{getAmountText(transaction)}</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleTextWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
  },
  meta: {
    fontSize: 11,
    fontWeight: "500",
  },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 10,
  },
  leftCol: {
    flex: 1,
    gap: 2,
  },
  amount: {
    fontSize: 14,
    fontWeight: "700",
    maxWidth: "45%",
    textAlign: "right",
  },
});

export default TransactionListItem;
