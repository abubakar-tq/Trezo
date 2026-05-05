import { Feather } from "@expo/vector-icons";
import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import { withAlpha } from "@utils/color";
import { CHAINS, type SupportedChainId } from "@/src/integration/chains";
import {
  EmailRecoveryGroupService,
  type ApprovalStatus,
  type ApprovalView,
  type ChainRequestStatus,
  type ChainRequestView,
  type ChainSubmissionStatus,
  type ChainSubmissionView,
  type EmailRecoveryGroupView,
} from "@/src/features/wallet/services/EmailRecoveryGroupService";

type GroupStatusRouteProp = RouteProp<RootStackParamList, "EmailRecoveryGroupStatus">;

const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  pending: "Waiting to Send",
  email_sent: "Email Sent — Awaiting Reply",
  guardian_replied: "Guardian Replied",
  proof_generated: "Approved",
  submitted_to_chains: "Submitted to Chain",
  confirmed: "Confirmed",
  failed: "Failed",
  rejected: "Rejected",
};

const CHAIN_STATUS_LABEL: Record<ChainRequestStatus, string> = {
  pending: "Waiting for Guardian Approvals",
  proofs_pending: "Awaiting Guardian Proof",
  proofs_submitted: "Proofs Submitted",
  threshold_reached: "Threshold Reached",
  timelock_pending: "Timelock Active",
  ready_to_execute: "Approved — Pending Execution",
  executing: "Executing...",
  executed: "Passkey Added",
  failed: "Failed",
  cancelled: "Cancelled",
};

const SUBMISSION_STATUS_LABEL: Record<ChainSubmissionStatus, string> = {
  pending: "Pending",
  request_sent: "Recovery Email Sent",
  proof_ready: "Guardian Approved",
  submitting: "Submitting...",
  submitted: "Submitted",
  confirmed: "Confirmed On-Chain",
  failed: "Failed",
};

function statusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case "executed":
    case "confirmed":
      return colors.success;
    case "failed":
    case "rejected":
      return colors.danger;
    case "proof_generated":
    case "ready_to_execute":
    case "threshold_reached":
      return colors.accentAlt;
    case "expired":
    case "cancelled":
      return colors.textMuted;
    default:
      return colors.textSecondary;
  }
}

const EmailRecoveryGroupStatusScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<GroupStatusRouteProp>();
  const groupId = route.params.groupId;

  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const [group, setGroup] = useState<EmailRecoveryGroupView | null>(null);
  const [chainRequests, setChainRequests] = useState<ChainRequestView[]>([]);
  const [approvals, setApprovals] = useState<ApprovalView[]>([]);
  const [submissions, setSubmissions] = useState<ChainSubmissionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const ticker = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const loadState = useCallback(async () => {
    try {
      const state = await EmailRecoveryGroupService.refreshGroupStatus(groupId);
      setGroup(state.group);
      setChainRequests(state.chainRequests);
      setApprovals(state.approvals);
      setSubmissions(state.submissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group status.");
    }
  }, [groupId]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      await loadState();
      if (isMounted) setLoading(false);
    };
    void init();
    return () => { isMounted = false; };
  }, [loadState]);

  useEffect(() => {
    const poll = setInterval(() => {
      void loadState();
    }, 8000);
    return () => clearInterval(poll);
  }, [loadState]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    await loadState();
    setRefreshing(false);
  }, [loadState]);

  const confirmedApprovals = useMemo(
    () => approvals.filter((a) => a.status === "confirmed" || a.status === "proof_generated" || a.status === "submitted_to_chains"),
    [approvals],
  );
  const failedApprovals = useMemo(
    () => approvals.filter((a) => a.status === "failed"),
    [approvals],
  );

  const thresholdInfo = useMemo(() => {
    if (!group) return { confirmed: 0, total: 0 };
    return { confirmed: confirmedApprovals.length, total: approvals.length };
  }, [group, confirmedApprovals.length, approvals.length]);

  const submissionsByChain = useMemo(() => {
    const map = new Map<number, ChainSubmissionView[]>();
    for (const sub of submissions) {
      const existing = map.get(sub.chainId) ?? [];
      existing.push(sub);
      map.set(sub.chainId, existing);
    }
    return map;
  }, [submissions]);

  const deadlineRemaining = useMemo(() => {
    if (!group?.deadline) return null;
    const dl = new Date(group.deadline);
    const remainingMs = dl.getTime() - now.getTime();
    if (remainingMs <= 0) return "Expired";
    const totalMin = Math.floor(remainingMs / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  }, [group?.deadline, now]);

  const allChainsExecuted = useMemo(
    () => chainRequests.length > 0 && chainRequests.every((cr) => cr.status === "executed"),
    [chainRequests],
  );

  const someChainsExecuted = useMemo(
    () => chainRequests.some((cr) => cr.status === "executed"),
    [chainRequests],
  );

  const readyChains = useMemo(
    () => chainRequests.filter((cr) => cr.status === "ready_to_execute"),
    [chainRequests],
  );

  const timelockPendingChains = useMemo(
    () => chainRequests.filter((cr) => cr.status === "timelock_pending"),
    [chainRequests],
  );

  const handleResendPending = useCallback(async () => {
    try {
      const failed = approvals.filter((a) => a.status === "failed" || a.status === "pending");
      if (failed.length > 0) {
        await EmailRecoveryGroupService.sendApprovals(groupId);
      }
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend approvals.");
    }
  }, [groupId, approvals, loadState]);

  const handleResendSingle = useCallback(async (approvalId: string) => {
    try {
      await EmailRecoveryGroupService.resendRecoveryRequest(groupId, approvalId);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend recovery request.");
    }
  }, [groupId, loadState]);

  const handleCancel = useCallback(async () => {
    try {
      await EmailRecoveryGroupService.cancelGroup(groupId);
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel group.");
    }
  }, [groupId, loadState]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recovery Status</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.accentAlt} />
          <Text style={styles.loadingText}>Loading recovery status...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recovery Status</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.colors.accentAlt} />
        }
      >
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recovery Request</Text>
          {group ? (
            <>
              <View style={styles.hashRow}>
                <Text style={styles.hashLabel}>Hash</Text>
                <Text style={styles.hashValue} numberOfLines={1} ellipsizeMode="middle">
                  {group.multichainRecoveryDataHash}
                </Text>
              </View>
              <View style={styles.hashRow}>
                <Text style={styles.hashLabel}>Deadline</Text>
                <Text style={[styles.hashValue, deadlineRemaining === "Expired" && styles.expiredText]}>
                  {deadlineRemaining ?? "Unknown"}
                </Text>
              </View>
              <View style={styles.statusBadge}>
                <Feather
                  name={allChainsExecuted ? "check-circle" : group?.status === "failed" ? "alert-circle" : "clock"}
                  size={16}
                  color={statusColor(group.status, theme.colors)}
                />
                <Text style={[styles.statusText, { color: statusColor(group.status, theme.colors) }]}>
                  {group.status.replace(/_/g, " ")}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>No recovery group data.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trusted Contact Approvals</Text>
          <Text style={styles.summaryLine}>
            {thresholdInfo.confirmed} of {thresholdInfo.total} confirmed
          </Text>
          {approvals.length === 0 ? (
            <Text style={styles.emptyText}>No approvals recorded yet.</Text>
          ) : (
            approvals.map((approval) => (
              <View key={approval.id} style={styles.approvalRow}>
                 <View style={styles.approvalIcon}>
                   <Feather
                     name={
                       approval.status === "confirmed" || approval.status === "submitted_to_chains"
                         ? "check-circle"
                         : approval.status === "failed" || approval.status === "rejected"
                           ? "x-circle"
                           : "clock"
                     }
                     size={18}
                     color={statusColor(approval.status, theme.colors)}
                   />
                 </View>
                 <View style={styles.approvalInfo}>
                   <Text style={styles.approvalEmail}>
                     {approval.maskedEmail ?? approval.guardianEmailHash.slice(0, 14) + "..."}
                   </Text>
                   <Text style={[styles.approvalStatus, { color: statusColor(approval.status, theme.colors) }]}>
                     {APPROVAL_STATUS_LABEL[approval.status] ?? approval.status}
                   </Text>
                 </View>
                 {approval.status === "failed" ? (
                   <TouchableOpacity
                     style={styles.resendIconButton}
                     onPress={() => void handleResendSingle(approval.id)}
                     activeOpacity={0.7}
                   >
                     <Feather name="refresh-cw" size={16} color={theme.colors.accentAlt} />
                   </TouchableOpacity>
                 ) : null}
               </View>
            ))
          )}
          {failedApprovals.length > 0 && (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void handleResendPending()} activeOpacity={0.85}>
              <Text style={styles.secondaryButtonText}>Resend Failed Approvals</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Proof Submissions</Text>
          <Text style={styles.cardDesc}>
            Per-chain proof tracking for each guardian approval.
          </Text>
          {chainRequests.length === 0 ? (
            <Text style={styles.emptyText}>No chain requests yet.</Text>
          ) : (
            chainRequests.map((cr) => {
              const chainSubs = submissionsByChain.get(cr.chainId) ?? [];
              const confirmedCount = chainSubs.filter((s) => s.status === "confirmed" || s.status === "submitted").length;
              const chainName = CHAINS[cr.chainId as SupportedChainId]?.name ?? `Chain ${cr.chainId}`;

              return (
                <View key={cr.id} style={styles.proofChainRow}>
                  <View style={styles.proofChainHeader}>
                    <Text style={styles.proofChainName}>{chainName}</Text>
                    <Text style={styles.proofChainCount}>
                      {confirmedCount}/{chainSubs.length} confirmed
                    </Text>
                  </View>
                  {chainSubs.length === 0 ? (
                    <Text style={styles.emptyText}>No submissions yet.</Text>
                  ) : (
                    chainSubs.map((sub) => (
                      <View key={sub.id} style={styles.submissionRow}>
                        <Feather
                          name={sub.status === "confirmed" || sub.status === "submitted" ? "check" : sub.status === "failed" ? "x" : "minus"}
                          size={14}
                          color={statusColor(sub.status, theme.colors)}
                        />
                        <Text style={[styles.submissionStatus, { color: statusColor(sub.status, theme.colors) }]}>
                          {SUBMISSION_STATUS_LABEL[sub.status] ?? sub.status}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chain Execution</Text>
          {chainRequests.length === 0 ? (
            <Text style={styles.emptyText}>No chain execution state yet.</Text>
          ) : (
            chainRequests.map((cr) => {
              const chainName = CHAINS[cr.chainId as SupportedChainId]?.name ?? `Chain ${cr.chainId}`;
              return (
                <View key={cr.id} style={styles.executionRow}>
                  <View style={styles.executionHeader}>
                    <Text style={styles.executionChainName}>{chainName}</Text>
                    <View style={[styles.executionBadge, { backgroundColor: withAlpha(statusColor(cr.status, theme.colors), 0.12) }]}>
                      <Text style={[styles.executionBadgeText, { color: statusColor(cr.status, theme.colors) }]}>
                        {CHAIN_STATUS_LABEL[cr.status] ?? cr.status}
                      </Text>
                    </View>
                  </View>
                  {cr.executeTxHash ? (
                    <Text style={styles.txHash} numberOfLines={1} ellipsizeMode="middle">
                      Tx: {cr.executeTxHash}
                    </Text>
                  ) : null}
                  {cr.lastError ? (
                    <Text style={styles.errorDetail}>{cr.lastError}</Text>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        {allChainsExecuted ? (
          <View style={styles.card}>
            <View style={styles.successBanner}>
              <Feather name="check-circle" size={24} color={theme.colors.success} />
              <View style={styles.successTextWrap}>
                <Text style={styles.successTitle}>Recovery Complete</Text>
                <Text style={styles.successDesc}>
                  Your new passkey has been added on all selected chains. You can now use it to sign transactions.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate("TabNavigation")}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>Return to Wallet</Text>
            </TouchableOpacity>
          </View>
        ) : someChainsExecuted ? (
          <View style={styles.card}>
            <View style={styles.partialBanner}>
              <Feather name="alert-circle" size={20} color={theme.colors.warning} />
              <Text style={styles.partialText}>
                Recovery is partially complete. Some chains are still processing. Keep this screen open to track progress.
              </Text>
            </View>
          </View>
        ) : null}

        {readyChains.length > 0 && !allChainsExecuted ? (
          <View style={styles.card}>
            <View style={styles.partialBanner}>
              <Feather name="clock" size={20} color={theme.colors.accentAlt} />
              <Text style={styles.partialText}>
                Recovery is approved and ready to execute. On testnet, the ZK Email relayer will submit the on-chain transaction automatically. On local Anvil, run `make mock-complete-email-recovery-local` with the required env vars.
              </Text>
            </View>
          </View>
        ) : null}

        {timelockPendingChains.length > 0 && !allChainsExecuted ? (
          <View style={styles.card}>
            <View style={styles.partialBanner}>
              <Feather name="clock" size={20} color={theme.colors.warning} />
              <Text style={styles.partialText}>
                Timelock is active. Recovery will be executable once the delay period ends. This is a security feature to give you time to cancel if needed.
              </Text>
            </View>
          </View>
        ) : null}

        {!allChainsExecuted && group && group.status !== "cancelled" && group.status !== "expired" ? (
          <TouchableOpacity style={styles.dangerButton} onPress={() => void handleCancel()} activeOpacity={0.85}>
            <Text style={styles.dangerButtonText}>Cancel Recovery Request</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
      gap: 16,
    },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
      color: colors.textMuted,
      fontSize: 15,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 12,
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    cardDesc: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    hashRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 12,
    },
    hashLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    hashValue: {
      color: colors.textSecondary,
      fontSize: 12,
      flex: 1,
      textAlign: "right",
    },
    expiredText: {
      color: colors.danger,
      fontWeight: "700",
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },
    statusText: {
      fontSize: 14,
      fontWeight: "700",
      textTransform: "capitalize",
    },
    summaryLine: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 13,
      fontStyle: "italic",
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      lineHeight: 20,
    },
    errorDetail: {
      color: colors.danger,
      fontSize: 11,
    },
    approvalRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 8,
    },
    approvalIcon: {
      width: 24,
      alignItems: "center",
    },
    approvalInfo: {
      flex: 1,
    },
    approvalEmail: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    approvalStatus: {
      fontSize: 12,
      fontWeight: "600",
    },
    resendIconButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.3),
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.accentAlt, 0.06),
    },
    proofChainRow: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 8,
      backgroundColor: withAlpha(colors.textPrimary, 0.03),
    },
    proofChainHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    proofChainName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    proofChainCount: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
    submissionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 2,
    },
    submissionStatus: {
      fontSize: 12,
      fontWeight: "600",
    },
    executionRow: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      gap: 6,
      backgroundColor: withAlpha(colors.textPrimary, 0.03),
    },
    executionHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    executionChainName: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    executionBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 10,
    },
    executionBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    txHash: {
      color: colors.textMuted,
      fontSize: 11,
      fontFamily: "monospace",
    },
    successBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    successTextWrap: {
      flex: 1,
      gap: 4,
    },
    successTitle: {
      color: colors.success,
      fontSize: 16,
      fontWeight: "700",
    },
    successDesc: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    partialBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    partialText: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      flex: 1,
    },
    primaryButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledButton: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
    },
    secondaryButton: {
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.3),
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: withAlpha(colors.accentAlt, 0.08),
    },
    secondaryButtonText: {
      color: colors.accentAlt,
      fontSize: 14,
      fontWeight: "700",
    },
    dangerButton: {
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.3),
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: withAlpha(colors.danger, 0.06),
    },
    dangerButtonText: {
      color: colors.danger,
      fontSize: 14,
      fontWeight: "700",
    },
  });

export default EmailRecoveryGroupStatusScreen;
