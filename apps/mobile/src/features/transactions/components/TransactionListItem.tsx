import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getChainConfig } from "@/src/integration/chains";
import type { SupportedChainId } from "@/src/integration/chains";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import { TransactionStatusBadge } from "@/src/features/transactions/components/TransactionStatusBadge";
import { txRowLabel } from "@/src/features/transactions/utils/txFormatters";
import { FontFamilies } from "@shared/components/TokenRegistry";

const relativeTime = (iso: string): string => {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "-";
  const delta = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86_400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86_400)}d ago`;
};

/** Direction-aware icon bubble colour and arrow name. */
const getDirectionIcon = (
  tx: WalletTransaction,
): keyof typeof Feather.glyphMap => {
  if (tx.direction === "incoming") return "arrow-down-left";
  if (tx.type === "swap" || tx.type === "cross_chain_swap") return "repeat";
  if (tx.type === "bridge") return "shuffle";
  if (tx.type === "token_approval") return "check-circle";
  if (tx.type === "module_install") return "tool";
  if (tx.type === "recovery") return "shield";
  return "arrow-up-right";
};

// Pull a (decimals, symbol, rawAmount) tuple from a swap row's metadata
// so the activity feed can show what was BOUGHT next to what was SENT.
const formatBuySide = (tx: WalletTransaction): string | null => {
  if (tx.type !== "swap" && tx.type !== "cross_chain_swap") return null;
  const meta = (tx.metadata ?? {}) as Record<string, unknown>;
  const buyToken = meta.buyToken as { symbol?: string; decimals?: number } | undefined;
  const rawStr = (meta.estimatedBuyAmountRaw ?? meta.minimumBuyAmountRaw) as string | undefined;
  if (!buyToken?.symbol || typeof buyToken.decimals !== "number" || !rawStr) return null;
  let amount = 0;
  try {
    const raw = BigInt(rawStr);
    const divisor = 10n ** BigInt(buyToken.decimals);
    const whole = raw / divisor;
    const frac = raw % divisor;
    const fracStr = frac
      .toString()
      .padStart(buyToken.decimals, "0")
      .slice(0, 4)
      .replace(/0+$/, "");
    amount = parseFloat(`${whole}.${fracStr || "0"}`);
  } catch {
    return null;
  }
  return `+${amount} ${buyToken.symbol}`;
};

const getAmountText = (tx: WalletTransaction): string => {
  if (!tx.amountDisplay || !tx.tokenSymbol) return "-";
  const sign =
    tx.direction === "outgoing" ? "-" : tx.direction === "incoming" ? "+" : "";
  const sellSide = `${sign}${tx.amountDisplay} ${tx.tokenSymbol}`;
  const buySide = formatBuySide(tx);
  return buySide ? `${sellSide} → ${buySide}` : sellSide;
};

export const TransactionListItem: React.FC<{
  transaction: WalletTransaction;
  onPress?: (transaction: WalletTransaction) => void;
}> = ({ transaction, onPress }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const isIncoming = transaction.direction === "incoming";

  // Tint: green for incoming, accent for everything else
  const iconTint = isIncoming ? colors.success : colors.accent;

  let chainName = `Chain ${transaction.chainId}`;
  try {
    chainName = getChainConfig(transaction.chainId as SupportedChainId).name;
  } catch {
    chainName = `Chain ${transaction.chainId}`;
  }

  const primaryLabel = txRowLabel(
    transaction.direction,
    transaction.type,
    transaction.tokenSymbol,
  );
  const amountText = getAmountText(transaction);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? colors.surfaceElevated : colors.surfaceCard,
          borderColor: colors.border,
        },
      ]}
      onPress={() => onPress?.(transaction)}
    >
      {/* Left group: icon bubble + text column */}
      <View style={styles.leftGroup}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: `${iconTint}1F`,
              borderColor: `${iconTint}3D`,
            },
          ]}
        >
          <Feather name={getDirectionIcon(transaction)} size={15} color={iconTint} />
        </View>

        {/* Label + meta */}
        <View style={styles.textWrap}>
          <Text
            style={[styles.label, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {primaryLabel}
          </Text>
          <Text
            style={[styles.meta, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {chainName} · {relativeTime(transaction.createdAt)}
          </Text>
        </View>
      </View>

      {/* Right: status badge + amount, stacked and right-aligned */}
      <View style={styles.rightWrap}>
        <TransactionStatusBadge status={transaction.status} />
        <Text
          style={[
            styles.amount,
            {
              color: isIncoming ? colors.success : colors.textPrimary,
              fontFamily: FontFamilies.monoMedium,
            },
          ]}
          numberOfLines={1}
        >
          {amountText}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 10,
  },
  /** Groups the icon bubble + text column so they share a single flex:1 left slot. */
  leftGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  meta: {
    fontSize: 11,
    fontWeight: "500",
  },
  /** Right column: badge + amount stacked, right-aligned. Vertical centering
   *  comes from the parent row's alignItems: "center". */
  rightWrap: {
    alignItems: "flex-end",
    gap: 4,
    flexShrink: 0,
    paddingLeft: 8,
  },
  amount: {
    fontSize: 13,
    textAlign: "right",
  },
});

export default TransactionListItem;
