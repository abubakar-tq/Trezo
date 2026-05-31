import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import * as Clipboard from "expo-clipboard";
import * as WebBrowser from "expo-web-browser";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getChainConfig } from "@/src/integration/chains";
import type { SupportedChainId } from "@/src/integration/chains";
import { TransactionHistoryService } from "@/src/features/transactions/services/TransactionHistoryService";
import { TransactionReceiptTracker } from "@/src/features/transactions/services/TransactionReceiptTracker";
import { TransactionStatusBadge } from "@/src/features/transactions/components/TransactionStatusBadge";
import type { WalletTransaction } from "@/src/features/transactions/types/transaction";
import { txRowLabel, formatGasFee } from "@/src/features/transactions/utils/txFormatters";
import { FontFamilies } from "@shared/components/TokenRegistry";
import type { RootStackParamList } from "@/src/types/navigation";

type TransactionDetailRoute = RouteProp<RootStackParamList, "TransactionDetail">;

// ── helpers ──────────────────────────────────────────────────────────────────

const shorten = (value?: string | null, head = 8, tail = 6): string => {
  if (!value) return "-";
  if (value.length <= head + tail + 3) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
};

const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

// ── sub-components ────────────────────────────────────────────────────────────

type InfoRowProps = {
  label: string;
  value: string;
  mono?: boolean;
  copiable?: boolean;
  valueColor?: string;
};

const InfoRow: React.FC<InfoRowProps> = ({ label, value, mono, copiable, valueColor }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  return (
    <View style={detailStyles.infoRow}>
      <Text style={[detailStyles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={detailStyles.infoValueWrap}>
        <Text
          style={[
            detailStyles.infoValue,
            { color: valueColor ?? colors.textPrimary },
            mono ? { fontFamily: FontFamilies.mono, fontSize: 12 } : null,
          ]}
          selectable
        >
          {value}
        </Text>
        {copiable && value !== "-" ? (
          <TouchableOpacity
            hitSlop={8}
            onPress={() => void Clipboard.setStringAsync(value)}
            style={detailStyles.copyBtn}
          >
            <Feather name="copy" size={13} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

// ── main screen ───────────────────────────────────────────────────────────────

export const TransactionDetailScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const navigation = useNavigation<any>();
  const route = useRoute<TransactionDetailRoute>();
  const insets = useSafeAreaInsets();

  const [row, setRow] = useState<WalletTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  // Derived display values
  const derived = useMemo(() => {
    if (!row) return null;

    const chainCfg = (() => {
      try {
        return getChainConfig(row.chainId as SupportedChainId);
      } catch {
        return null;
      }
    })();

    const chainName = chainCfg?.name ?? `Chain ${row.chainId}`;

    const gasFeeEth = formatGasFee(row.gasUsed, row.effectiveGasPriceWei);

    const amountStr =
      row.amountDisplay && row.tokenSymbol
        ? `${row.amountDisplay} ${row.tokenSymbol}`
        : "-";

    const explorerUrl =
      chainCfg?.blockExplorerUrl && row.transactionHash
        ? `${chainCfg.blockExplorerUrl}/tx/${row.transactionHash}`
        : null;

    const explorerHost = chainCfg?.blockExplorerUrl
      ? (() => {
          try {
            return new URL(chainCfg.blockExplorerUrl).hostname;
          } catch {
            return "Explorer";
          }
        })()
      : "Explorer";

    const isFailed = ["failed", "cancelled", "dropped"].includes(row.status);

    const humanLabel = txRowLabel(row.direction, row.type, row.tokenSymbol);

    const dateStr = formatDate(row.confirmedAt ?? row.createdAt);

    return {
      chainName,
      gasFeeEth,
      amountStr,
      explorerUrl,
      explorerHost,
      isFailed,
      humanLabel,
      dateStr,
    };
  }, [row]);

  const closeButtonTop = insets.top + 8;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Close button — inset-aware */}
      <TouchableOpacity
        accessibilityLabel="Close"
        style={[styles.closeButton, { top: closeButtonTop }]}
        onPress={() => navigation.popToTop()}
        hitSlop={8}
      >
        <Feather name="x" size={22} color={colors.textPrimary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: closeButtonTop + 44 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>Loading details...</Text>
          </View>
        ) : null}

        {/* Error */}
        {error ? (
          <View style={[styles.errorCard, { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}4D` }]}>
            <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {row && derived ? (
          <>
            {/* ── Header ── */}
            <View style={styles.headerSection}>
              <Text style={[styles.txTitle, { color: colors.textPrimary }]}>
                {derived.humanLabel}
              </Text>
              <TransactionStatusBadge status={row.status} />
            </View>

            {/* ── Primary details card ── */}
            <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <InfoRow label="Status" value={row.status.charAt(0).toUpperCase() + row.status.slice(1)} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <InfoRow label="Date" value={derived.dateStr} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <InfoRow
                label="From"
                value={shorten(row.fromAddress ?? row.walletAddress)}
                mono
                copiable
              />
              {row.toAddress ?? row.targetAddress ? (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <InfoRow
                    label="To"
                    value={shorten(row.toAddress ?? row.targetAddress)}
                    mono
                    copiable
                  />
                </>
              ) : null}
              {row.sequenceIndex !== null && row.sequenceIndex !== undefined ? (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <InfoRow label="Nonce" value={String(row.sequenceIndex)} />
                </>
              ) : null}
              {row.tokenSymbol ? (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <InfoRow label="Asset" value={row.tokenSymbol} />
                </>
              ) : null}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <InfoRow label="Network" value={derived.chainName} />
            </View>

            {/* ── Amount / Gas / Total card ── */}
            <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.textMuted }]}>Summary</Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Amount</Text>
                <Text
                  style={[styles.summaryValue, { color: colors.textPrimary, fontFamily: FontFamilies.monoMedium }]}
                >
                  {derived.amountStr}
                </Text>
              </View>
              {derived.gasFeeEth ? (
                <>
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Gas fee</Text>
                    <Text
                      style={[styles.summaryValue, { color: colors.textSecondary, fontFamily: FontFamilies.mono }]}
                    >
                      {`${derived.gasFeeEth} ETH`}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            {/* ── Error card (failed txs only) ── */}
            {derived.isFailed && (row.errorCode ?? row.errorMessage) ? (
              <View style={[styles.card, styles.errorInfoCard, { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}4D` }]}>
                <Text style={[styles.cardTitle, { color: colors.danger }]}>Error</Text>
                {row.errorCode ? (
                  <Text style={[styles.errorInfoText, { color: colors.danger }]}>
                    Code: {row.errorCode}
                  </Text>
                ) : null}
                {row.errorMessage ? (
                  <Text style={[styles.errorInfoText, { color: colors.danger }]}>
                    {row.errorMessage}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* ── Explorer link ── */}
            {derived.explorerUrl ? (
              <TouchableOpacity
                style={[styles.explorerButton, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
                onPress={() =>
                  void WebBrowser.openBrowserAsync(derived.explorerUrl!, {
                    showTitle: true,
                    enableBarCollapsing: true,
                  })
                }
              >
                <Feather name="external-link" size={15} color={colors.accent} />
                <Text style={[styles.explorerButtonText, { color: colors.accent }]}>
                  {`View on ${derived.explorerHost}`}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* ── Advanced toggle ── */}
            <TouchableOpacity
              style={[styles.advancedToggle, { borderColor: colors.border }]}
              onPress={() => setAdvancedOpen((v) => !v)}
            >
              <Text style={[styles.advancedToggleText, { color: colors.textSecondary }]}>
                Advanced
              </Text>
              <Feather
                name={advancedOpen ? "chevron-up" : "chevron-down"}
                size={15}
                color={colors.textMuted}
              />
            </TouchableOpacity>

            {advancedOpen ? (
              <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                {[
                  { label: "ID", value: row.id },
                  { label: "UserOp Hash", value: row.userOpHash },
                  { label: "Tx Hash", value: row.transactionHash },
                  { label: "Block", value: row.blockNumber !== null ? String(row.blockNumber) : null },
                  { label: "Entry Point", value: row.entryPoint },
                  { label: "Bundler", value: row.bundlerUrl },
                  { label: "Paymaster Used", value: row.paymasterUsed ? "Yes" : "No" },
                  { label: "Fee Mode", value: row.feeMode },
                  { label: "Intent ID", value: row.intentId },
                  { label: "Sequence Index", value: row.sequenceIndex !== null ? String(row.sequenceIndex) : null },
                  { label: "Amount (raw)", value: row.amountRaw },
                  { label: "Value (raw)", value: row.valueRaw },
                  { label: "Gas Used", value: row.gasUsed },
                  { label: "Effective Gas Price", value: row.effectiveGasPriceWei },
                  { label: "Calldata", value: row.calldata ? shorten(row.calldata, 12, 6) : null },
                  { label: "Created", value: row.createdAt },
                  { label: "Prepared", value: row.preparedAt },
                  { label: "Signed", value: row.signedAt },
                  { label: "Submitted", value: row.submittedAt },
                  { label: "Confirmed", value: row.confirmedAt },
                  { label: "Failed", value: row.failedAt },
                  { label: "Updated", value: row.updatedAt },
                ].map((item, idx, arr) => (
                  <React.Fragment key={item.label}>
                    <InfoRow
                      label={item.label}
                      value={formatValue(item.value)}
                      mono
                    />
                    {idx < arr.length - 1 ? (
                      <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    ) : null}
                  </React.Fragment>
                ))}
              </View>
            ) : null}

            {/* ── Refresh ── */}
            <TouchableOpacity
              style={[styles.refreshButton, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}
              onPress={() => {
                setRefreshing(true);
                void load(true);
              }}
            >
              <Feather name="refresh-cw" size={14} color={colors.textSecondary} />
              <Text style={[styles.refreshButtonText, { color: colors.textSecondary }]}>
                {refreshing ? "Refreshing…" : "Refresh"}
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
};

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: "absolute",
    left: 12,
    zIndex: 10,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  headerSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 4,
  },
  txTitle: {
    fontSize: 22,
    fontWeight: "800",
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 14,
    textAlign: "right",
    flex: 1,
    marginLeft: 12,
  },
  errorInfoCard: {
    gap: 0,
  },
  errorInfoText: {
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  explorerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
  },
  explorerButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  advancedToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  advancedToggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: "600",
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
});

const detailStyles = StyleSheet.create({
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 12,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500",
    flexShrink: 0,
  },
  infoValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    justifyContent: "flex-end",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "500",
    textAlign: "right",
    flexShrink: 1,
  },
  copyBtn: {
    flexShrink: 0,
  },
});

export default TransactionDetailScreen;
