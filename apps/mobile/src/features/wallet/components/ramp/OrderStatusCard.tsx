/**
 * OrderStatusCard.tsx
 *
 * Shows the real-time status of an active ramp order.
 * Handles all terminal and in-progress states.
 */
import { FontAwesome5, Ionicons } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { RampOrder, RampStatus } from "@/src/types/ramp";

interface Props {
  order: RampOrder;
  displayAddress: string;
  isProcessing: boolean;
  onCompleteMock: () => void;
  onDone: () => void;
}

export const OrderStatusCard: React.FC<Props> = ({
  order,
  displayAddress,
  isProcessing,
  onCompleteMock,
  onDone,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const getStatusColor = (status: RampStatus) => {
    switch (status) {
      case "completed":
      case "local_mock_completed":
        return colors.success;
      case "failed":
      case "expired":
        return colors.danger;
      case "processing":
        return colors.accent;
      default:
        return colors.textSecondary;
    }
  };

  const getStatusText = (status: RampStatus) => {
    switch (status) {
      case "created": return "Order Initiated";
      case "widget_opened": return "Awaiting Payment";
      case "payment_pending": return "Confirming Payment";
      case "processing": return "Funding Wallet...";
      case "completed": return "Funds Delivered";
      case "local_mock_completed": return "Mock Funding Successful";
      case "failed": return "Transaction Failed";
      case "refunded": return "Order Refunded";
      case "expired": return "Order Expired";
      default: return String(status).toUpperCase();
    }
  };

  const isTerminal = ["completed", "local_mock_completed", "failed", "expired", "refunded"].includes(
    order.internalStatus
  );
  const isSuccess = ["completed", "local_mock_completed"].includes(order.internalStatus);
  const isMockPending =
    order.provider === "mock" &&
    !["local_mock_completed", "completed", "failed"].includes(order.internalStatus);

  const statusColor = getStatusColor(order.internalStatus);
  const txHash = order.txHash || order.localFulfillmentTxHash;

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceCard }]}>
      {/* Icon */}
      <View style={[styles.iconWrap, { backgroundColor: withAlpha(statusColor, 0.12) }]}>
        {isSuccess ? (
          <Ionicons name="checkmark-circle" size={64} color={colors.success} />
        ) : order.internalStatus === "failed" || order.internalStatus === "expired" ? (
          <Ionicons name="close-circle" size={64} color={colors.danger} />
        ) : (
          <ActivityIndicator size="large" color={colors.accent} />
        )}
      </View>

      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {getStatusText(order.internalStatus)}
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        ${order.fiatAmount} {order.fiatCurrency} → {order.cryptoCurrency}
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Details */}
      <View style={styles.details}>
        <DetailRow label="Provider" value={order.provider} colors={colors} capitalize />
        <DetailRow label="Destination" value={displayAddress} colors={colors} />
        {txHash && (
          <DetailRow
            label="Transaction"
            value={`${txHash.slice(0, 10)}...${txHash.slice(-8)}`}
            colors={colors}
            accent
          />
        )}
        {order.cryptoAmount && (
          <DetailRow
            label="Amount Received"
            value={`${order.cryptoAmount} ${order.cryptoCurrency}`}
            colors={colors}
          />
        )}
      </View>

      {/* Mock complete button — DEV ONLY */}
      {isMockPending && (
        <TouchableOpacity
          style={[styles.mockBtn, { backgroundColor: colors.accent }]}
          onPress={onCompleteMock}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <FontAwesome5 name="magic" size={16} color="#fff" />
              <Text style={styles.mockBtnText}>Complete Mock Order</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Done button */}
      {isTerminal && (
        <TouchableOpacity
          style={[styles.doneBtn, { borderColor: colors.border }]}
          onPress={onDone}
        >
          <Text style={[styles.doneBtnText, { color: colors.textPrimary }]}>Done</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── Detail Row ────────────────────────────────────────────────────────────────
interface DetailRowProps {
  label: string;
  value: string;
  colors: any;
  capitalize?: boolean;
  accent?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, colors, capitalize, accent }) => (
  <View style={styles.row}>
    <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
    <Text
      style={[
        styles.rowValue,
        { color: accent ? colors.accent : colors.textPrimary },
        capitalize && { textTransform: "capitalize" },
      ]}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    borderRadius: 32,
    padding: 32,
    alignItems: "center",
    marginTop: 20,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 24,
  },
  divider: {
    width: "100%",
    height: 1,
    marginBottom: 24,
    opacity: 0.1,
  },
  details: {
    width: "100%",
    gap: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "700",
    maxWidth: "60%",
    textAlign: "right",
  },
  mockBtn: {
    width: "100%",
    height: 56,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 32,
  },
  mockBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  doneBtn: {
    width: "100%",
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
