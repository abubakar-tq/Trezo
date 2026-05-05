import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { WalletTransactionStatus } from "@/src/features/transactions/types/transaction";

const getStatusLabel = (status: WalletTransactionStatus): string => {
  switch (status) {
    case "draft":
      return "Draft";
    case "prepared":
      return "Prepared";
    case "signing":
      return "Signing";
    case "signed":
      return "Signed";
    case "submitted":
      return "Submitted";
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    case "dropped":
      return "Dropped";
    default:
      return status;
  }
};

type StatusColorPalette = {
  success: string;
  danger: string;
  warning: string;
  textMuted: string;
};

const getStatusColor = (status: WalletTransactionStatus, colors: StatusColorPalette): string => {
  switch (status) {
    case "confirmed":
      return colors.success;
    case "failed":
    case "cancelled":
    case "dropped":
      return colors.danger;
    case "pending":
    case "submitted":
    case "signing":
      return colors.warning;
    default:
      return colors.textMuted;
  }
};

export const TransactionStatusBadge: React.FC<{ status: WalletTransactionStatus }> = ({ status }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const tone = getStatusColor(status, colors);

  return (
    <View
      style={[
        styles.badge,
        {
          borderColor: withAlpha(tone, 0.3),
          backgroundColor: withAlpha(tone, 0.12),
        },
      ]}
    >
      <Text style={[styles.text, { color: tone }]}>{getStatusLabel(status)}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});

export default TransactionStatusBadge;
