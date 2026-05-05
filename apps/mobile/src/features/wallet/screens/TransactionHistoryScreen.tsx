/**
 * TransactionHistoryScreen.tsx
 *
 * Display past transactions with details.
 *
 * Constraints Applied:
 * - F-Pattern: Summary top, transactions middle
 * - Empty state with CTA
 * - Transaction cards with icons and status
 * - No spinners for data (instant display)
 * - Trust markers: Status indicators
 */

import React, { useState } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import { Badge } from "../../../shared/components/Tier1/Badge";
import { CardLevel1, Surface } from "../../../shared/components/Tier1/Surface";
import {
    BodyText,
    CaptionText,
    HeadlineText,
    TitleText,
} from "../../../shared/components/Tier1/Text";
import { Spacing } from "../../../shared/components/TokenRegistry";
import { useAppTheme } from "@theme";

interface Transaction {
  id: string;
  type: "send" | "receive";
  asset: string;
  amount: number;
  to: string;
  from: string;
  status: "confirmed" | "pending" | "failed";
  timestamp: string;
  hash: string;
  gasUsed?: number;
}

interface TransactionHistoryScreenProps {}

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "1",
    type: "send",
    asset: "ETH",
    amount: 0.5,
    to: "0x742d35Cc6634...",
    from: "0x8b2f8f6e5c4d...",
    status: "confirmed",
    timestamp: "2 hours ago",
    hash: "0x123abc...",
    gasUsed: 0.0021,
  },
  {
    id: "2",
    type: "receive",
    asset: "USDC",
    amount: 1000,
    to: "You",
    from: "Alice Johnson",
    status: "confirmed",
    timestamp: "1 day ago",
    hash: "0x456def...",
  },
  {
    id: "3",
    type: "send",
    asset: "ETH",
    amount: 1.0,
    to: "Bob Smith",
    from: "You",
    status: "pending",
    timestamp: "5 minutes ago",
    hash: "0x789ghi...",
  },
  {
    id: "4",
    type: "send",
    asset: "DAI",
    amount: 500,
    to: "0x9c8b7a6f...",
    from: "You",
    status: "failed",
    timestamp: "3 days ago",
    hash: "0xabc123...",
  },
];

export const TransactionHistoryScreen: React.FC<
  TransactionHistoryScreenProps
> = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const confirmedCount = MOCK_TRANSACTIONS.filter(
    (t) => t.status === "confirmed",
  ).length;
  const pendingCount = MOCK_TRANSACTIONS.filter(
    (t) => t.status === "pending",
  ).length;

  const renderTransactionCard = (tx: Transaction) => (
    <CardLevel1 key={tx.id}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: Spacing.sp3,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            gap: Spacing.sp3,
            flex: 1,
            alignItems: "center",
          }}
        >
          <BodyText style={{ fontSize: 28 }}>
            {tx.type === "send" ? "📤" : "📥"}
          </BodyText>

          <View style={{ flex: 1, gap: Spacing.sp1 }}>
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sp2,
                alignItems: "center",
              }}
            >
              <BodyText style={{ fontWeight: "600", flex: 1 }}>
                {tx.type === "send" ? "Sent" : "Received"} {tx.asset}
              </BodyText>
              <Badge
                status={
                  tx.status === "confirmed"
                    ? "success"
                    : tx.status === "pending"
                      ? "warning"
                      : "danger"
                }
                label={
                  tx.status === "confirmed"
                    ? "✓"
                    : tx.status === "pending"
                      ? "⟳"
                      : "✗"
                }
              />
            </View>

            <BodyText
              color={colors.textMuted}
              style={{ fontSize: 12 }}
            >
              {tx.type === "send" ? `To: ${tx.to}` : `From: ${tx.from}`}
            </BodyText>

            <BodyText
              color={colors.textMuted}
              style={{ fontSize: 11 }}
            >
              {tx.timestamp}
            </BodyText>
          </View>
        </View>

        <BodyText style={{ fontWeight: "600", fontSize: 14 }}>
          {tx.type === "send" ? "-" : "+"}
          {tx.amount} {tx.asset}
        </BodyText>
      </View>
    </CardLevel1>
  );

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.sp4,
          paddingVertical: Spacing.sp6,
          gap: Spacing.sp6,
          paddingBottom: Spacing.sp8,
        }}
      >
        {/* HEADER */}
        <View style={{ gap: Spacing.sp2 }}>
          <HeadlineText>Transaction History</HeadlineText>
          <BodyText
            color={colors.textSecondary}
          >
            Your complete transaction log.
          </BodyText>
        </View>

        {/* SUMMARY STATS */}
        <View style={{ flexDirection: "row", gap: Spacing.sp2 }}>
          <Surface elevation={1} style={{ flex: 1 }}>
            <View style={{ alignItems: "center", gap: Spacing.sp1 }}>
              <BodyText
                style={{ fontSize: 28, fontWeight: "bold" }}
              >
                {MOCK_TRANSACTIONS.length}
              </BodyText>
              <CaptionText color={colors.accent}>Total</CaptionText>
            </View>
          </Surface>

          <Surface elevation={1} style={{ flex: 1 }}>
            <View style={{ alignItems: "center", gap: Spacing.sp1 }}>
              <BodyText
                style={{
                  fontSize: 28,
                  fontWeight: "bold",
                  color: colors.success,
                }}
              >
                {confirmedCount}
              </BodyText>
              <CaptionText color={colors.success}>Confirmed</CaptionText>
            </View>
          </Surface>

          <Surface elevation={1} style={{ flex: 1 }}>
            <View style={{ alignItems: "center", gap: Spacing.sp1 }}>
              <BodyText
                style={{
                  fontSize: 28,
                  fontWeight: "bold",
                  color: colors.warning,
                }}
              >
                {pendingCount}
              </BodyText>
              <CaptionText color={colors.warning}>Pending</CaptionText>
            </View>
          </Surface>
        </View>

        {/* TRANSACTIONS LIST */}
        {MOCK_TRANSACTIONS.length > 0 ? (
          <View style={{ gap: Spacing.sp3 }}>
            <CaptionText color={colors.accent}>RECENT ACTIVITY</CaptionText>
            {MOCK_TRANSACTIONS.map((tx) => renderTransactionCard(tx))}
          </View>
        ) : (
          <Surface elevation={1}>
            <View
              style={{
                alignItems: "center",
                gap: Spacing.sp3,
                paddingVertical: Spacing.sp6,
              }}
            >
              <BodyText style={{ fontSize: 48 }}>
                📭
              </BodyText>
              <View style={{ alignItems: "center", gap: Spacing.sp2 }}>
                <TitleText>No transactions yet</TitleText>
                <BodyText
                  color={colors.textSecondary}
                  style={{ fontSize: 13, textAlign: "center" }}
                >
                  Your transactions will appear here once you send or receive
                  funds
                </BodyText>
              </View>
            </View>
          </Surface>
        )}

        {/* INFO SECTION */}
        <CardLevel1>
          <View style={{ gap: Spacing.sp2 }}>
            <TitleText>Transaction Details</TitleText>
            <BodyText
              color={colors.textSecondary}
              style={{ fontSize: 13, lineHeight: 20 }}
            >
              • ✓ Confirmed transactions are final{"\n"}• ⟳ Pending transactions
              may take time{"\n"}• ✗ Failed transactions do not consume gas
              {"\n"}• All data is stored on blockchain
            </BodyText>
          </View>
        </CardLevel1>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TransactionHistoryScreen;
