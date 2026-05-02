import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import {
  RecoveryApproval,
  RecoveryChainStatus,
  RecoveryRequest,
  RecoveryRequestService,
} from "@/src/features/wallet/services/RecoveryRequestService";
import { CHAINS, type SupportedChainId } from "@/src/integration/chains";

type RecoveryProgressRouteProp = RouteProp<RootStackParamList, "RecoveryProgress">;

const CHAIN_STATUS_LABELS: Record<RecoveryChainStatus["status"], string> = {
  pending: "Waiting for Approvals",
  wallet_undeployed: "Wallet Not Deployed",
  module_not_installed: "Module Not Installed",
  guardians_not_configured: "Guardians Not Set",
  scope_mismatch: "Invalid Scope",
  scheduling: "Scheduling...",
  scheduled: "Timelock Pending",
  timelock_pending: "Timelock Pending",
  ready_to_execute: "Ready to Execute",
  executing: "Executing...",
  executed: "Recovered",
  failed: "Failed",
  cancelled: "Cancelled",
};

const RecoveryProgressScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<RecoveryProgressRouteProp>();
  const requestId = route.params.requestId;

  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  const serviceRef = useRef(new RecoveryRequestService());
  const [request, setRequest] = useState<RecoveryRequest | null>(null);
  const [approvals, setApprovals] = useState<RecoveryApproval[]>([]);
  const [chainStatuses, setChainStatuses] = useState<RecoveryChainStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<"schedule" | "execute" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  // Live ticker for countdown accuracy
  useEffect(() => {
    const ticker = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(ticker);
  }, []);

  const threshold = request?.threshold ?? 0;
  const validApprovals = approvals.filter((approval) => approval.verification_status === "valid");
  const approvalsCount = validApprovals.length;
  const thresholdReached = threshold > 0 && approvalsCount >= threshold;
  const anyFailed = chainStatuses.some((status) => status.status === "failed");
  const allExecuted = chainStatuses.length > 0 && chainStatuses.every((status) => status.status === "executed");
  const schedulableChains = chainStatuses.filter(
    (status) => status.status === "pending" || status.status === "failed",
  );
  const executableChains = chainStatuses.filter((status) => {
    if (
      status.status !== "scheduled" &&
      status.status !== "timelock_pending" &&
      status.status !== "ready_to_execute"
    ) {
      return false;
    }
    if (!status.execute_after) {
      return status.status === "ready_to_execute";
    }
    return new Date(status.execute_after).getTime() <= now.getTime();
  });

  // Find the earliest executeAfter timestamp across all scheduled chains
  const earliestExecuteAfter = useMemo(() => {
    const pending = chainStatuses.filter(
      (s) => (s.status === "scheduled" || s.status === "timelock_pending") && s.execute_after,
    );
    if (!pending.length) return null;
    return pending.reduce((earliest, s) => {
      const t = new Date(s.execute_after!).getTime();
      return t < earliest ? t : earliest;
    }, Infinity);
  }, [chainStatuses]);

  const msToCountdown = (ms: number) => {
    if (ms <= 0) return "Ready now";
    const totalSec = Math.floor(ms / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const timelockCountdown = earliestExecuteAfter && earliestExecuteAfter !== Infinity
    ? msToCountdown(earliestExecuteAfter - now.getTime())
    : null;

  const deadline = request?.deadline ? new Date(request.deadline) : null;
  const deadlineRemainingLabel = useMemo(() => {
    if (!deadline || Number.isNaN(deadline.getTime())) {
      return "Unknown deadline";
    }
    const remainingMs = deadline.getTime() - now.getTime();
    if (remainingMs <= 0) {
      return `Expired at ${deadline.toLocaleString()}`;
    }
    const minutes = Math.floor(remainingMs / 60000);
    const days = Math.floor(minutes / (24 * 60));
    const hours = Math.floor((minutes % (24 * 60)) / 60);
    const mins = minutes % 60;
    return `${days}d ${hours}h ${mins}m remaining`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, request?.deadline]);
  const guardianApprovalMap = useMemo(() => {
    const map = new Map<string, RecoveryApproval>();
    for (const approval of approvals) {
      map.set(approval.guardian_address.toLowerCase(), approval);
    }
    return map;
  }, [approvals]);

  const loadRequestState = useCallback(async () => {
    const service = serviceRef.current;
    const [loadedRequest, loadedApprovals, loadedStatuses] = await Promise.all([
      service.getRecoveryRequest(requestId),
      service.listApprovals(requestId),
      service.listChainStatuses(requestId),
    ]);

    setRequest(loadedRequest);
    setApprovals(loadedApprovals);
    setChainStatuses(loadedStatuses);
  }, [requestId]);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      setLoading(true);
      setError(null);
      try {
        await loadRequestState();
      } catch (e) {
        if (isMounted) {
          setError(e instanceof Error ? e.message : "Failed to load recovery progress.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void initialize();

    const unsubscribeApprovals = serviceRef.current.subscribeToApprovals(requestId, (nextApprovals) => {
      if (!isMounted) {
        return;
      }
      setApprovals(nextApprovals);
    });

    const pollStatuses = setInterval(() => {
      void Promise.all([
        serviceRef.current.listChainStatuses(requestId),
        serviceRef.current.getRecoveryRequest(requestId),
      ])
        .then(([nextStatuses, nextRequest]) => {
          if (!isMounted) return;
          setChainStatuses(nextStatuses);
          setRequest(nextRequest);
        })
        .catch(() => {
          // Ignore polling failures; explicit refresh can recover state.
        });
    }, 6000);

    return () => {
      isMounted = false;
      unsubscribeApprovals();
      clearInterval(pollStatuses);
    };
  }, [loadRequestState, requestId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      await loadRequestState();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to refresh recovery progress.");
    } finally {
      setRefreshing(false);
    }
  }, [loadRequestState]);

  const handleSubmitAction = useCallback(
    async (action: "schedule" | "execute") => {
      const targetChains = action === "schedule" ? schedulableChains : executableChains;
      if (targetChains.length === 0) {
        return;
      }

      setSubmittingAction(action);
      setError(null);
      try {
        for (const status of targetChains) {
          const chainConfig = CHAINS[status.chain_id as SupportedChainId];
          if (!chainConfig?.rpcUrl) {
            throw new Error(`Missing RPC URL for chain ${status.chain_id}.`);
          }

          await serviceRef.current.submitRecoveryOperation({
            requestId,
            chainId: status.chain_id,
            action,
            rpcUrl: chainConfig.rpcUrl,
          });
        }

        await loadRequestState();
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to ${action} recovery.`);
      } finally {
        setSubmittingAction(null);
      }
    },
    [executableChains, loadRequestState, requestId, schedulableChains],
  );

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text style={styles.loaderText}>Loading recovery progress...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} tintColor={theme.colors.accent} />}
    >
      <View style={styles.card}>
        <Text style={styles.kicker}>Recovery Progress</Text>
        <Text style={styles.title}>Guardian approvals and chain execution</Text>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Approvals</Text>
            <Text style={styles.summaryValue}>{approvalsCount}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Threshold</Text>
            <Text style={styles.summaryValue}>{threshold}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Chains</Text>
            <Text style={styles.summaryValue}>{chainStatuses.length}</Text>
          </View>
        </View>

        <View style={styles.summaryBox}>
          <Text style={styles.summaryLabel}>Request Status</Text>
          <Text style={styles.summaryValueSmall}>{request?.status ?? "unknown"}</Text>
          <Text style={styles.rowMeta}>Deadline: {deadlineRemainingLabel}</Text>
        </View>

        {/* Timelock countdown — shown when recovery is scheduled and waiting */}
        {timelockCountdown && (
          <View style={[styles.statusBanner, { backgroundColor: theme.colors.accent + '14', borderColor: theme.colors.accent + '40' }]}>
            <Text style={[styles.statusBannerText, { color: theme.colors.accent }]}>
              ⏳ New passkey activates in: {timelockCountdown}
            </Text>
            <Text style={[styles.rowMeta, { marginTop: 4 }]}>
              Once the timelock expires you can execute recovery and the new passkey will become active on this device.
            </Text>
          </View>
        )}

        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>
            {allExecuted
              ? "All chains executed. You can finalize recovery now."
              : anyFailed
                ? "At least one chain failed execution. Retry or investigate tx hash details."
                : thresholdReached
                  ? "Approval threshold reached. Schedule execution on enabled chains."
                  : "Waiting for more guardian approvals."}
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Guardian Approvals</Text>
        {!request?.guardian_addresses?.length ? (
          <Text style={styles.emptyText}>No guardian addresses recorded in this request.</Text>
        ) : (
          request.guardian_addresses.map((guardianAddress) => {
            const approval = guardianApprovalMap.get(guardianAddress.toLowerCase());
            return (
              <View style={styles.row} key={guardianAddress}>
                <Text style={styles.rowTitle}>{guardianAddress}</Text>
                <Text style={styles.rowMeta}>
                  {approval?.verification_status === "valid"
                    ? `Approved${approval.sig_kind ? ` (${approval.sig_kind})` : ""}`
                    : approval?.verification_status === "invalid"
                      ? "Invalid signature"
                      : "Pending approval"}
                </Text>
                {approval?.created_at ? (
                  <Text style={styles.rowMeta}>Updated: {new Date(approval.created_at).toLocaleString()}</Text>
                ) : null}
              </View>
            );
          })
        )}

        {approvals.length > 0 ? (
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>Collected Signatures</Text>
            {approvals.map((approval) => (
              <Text style={styles.rowMeta} key={approval.id}>
                {approval.guardian_address} - {approval.verification_status}
              </Text>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Chains & Execution</Text>
        {chainStatuses.length === 0 ? (
          <Text style={styles.emptyText}>No chain status entries yet.</Text>
        ) : (
          chainStatuses.map((status) => {
            const isReady = status.status === "ready_to_execute";
            const isScheduled = status.status === "scheduled" || status.status === "timelock_pending";
            const executeAfterDate = status.execute_after ? new Date(status.execute_after) : null;
            const now = new Date();
            const waiting = executeAfterDate && executeAfterDate > now;

            return (
              <View style={styles.row} key={status.id}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowTitle}>
                    {CHAINS[status.chain_id as SupportedChainId]?.name ?? `Chain ${status.chain_id}`}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: status.status === "executed" ? theme.colors.success : theme.colors.surfaceMuted }]}>
                    <Text style={[styles.statusBadgeText, { color: status.status === "executed" ? theme.colors.textOnAccent : theme.colors.text }]}>
                      {CHAIN_STATUS_LABELS[status.status] ?? status.status}
                    </Text>
                  </View>
                </View>

                {isScheduled && executeAfterDate && (
                  <View style={styles.timeRow}>
                    <Text style={styles.rowMeta}>
                      {waiting
                        ? `Unlocks at ${executeAfterDate.toLocaleString()}`
                        : "Timelock expired. Ready to execute."}
                    </Text>
                  </View>
                )}

                {isReady && !executeAfterDate && (
                  <Text style={styles.rowMeta}>Ready to execute now.</Text>
                )}

                {status.schedule_tx_hash && (
                  <Text style={styles.rowMeta} numberOfLines={1}>Schedule Tx: {status.schedule_tx_hash}</Text>
                )}
                {status.execute_tx_hash && (
                  <Text style={styles.rowMeta} numberOfLines={1}>Execute Tx: {status.execute_tx_hash}</Text>
                )}
              </View>
            );
          })
        )}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!thresholdReached || schedulableChains.length === 0 || submittingAction !== null) && styles.disabledButton,
          ]}
          disabled={!thresholdReached || schedulableChains.length === 0 || submittingAction !== null}
          onPress={() => void handleSubmitAction("schedule")}
        >
          <Text style={styles.primaryButtonText}>
            {submittingAction === "schedule" ? "Scheduling..." : "Schedule Recovery"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (executableChains.length === 0 || submittingAction !== null) && styles.disabledButton,
          ]}
          disabled={executableChains.length === 0 || submittingAction !== null}
          onPress={() => void handleSubmitAction("execute")}
        >
          <Text style={styles.primaryButtonText}>
            {submittingAction === "execute" ? "Executing..." : "Execute Recovery"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton]}
          onPress={() => navigation.navigate("ShareRecoveryRequest", { requestId })}
        >
          <Text style={styles.secondaryButtonText}>Open Share Screen</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryButton]}
          onPress={() => navigation.navigate("RecoveryEntry")}
        >
          <Text style={styles.secondaryButtonText}>Back to Recovery Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, !allExecuted && styles.disabledButton]}
          disabled={!allExecuted}
          onPress={() => navigation.navigate("RecoveryComplete", { requestId })}
        >
          <Text style={styles.primaryButtonText}>Finalize Recovery</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 20,
      backgroundColor: colors.background,
    },
    loaderWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: colors.background,
    },
    loaderText: {
      color: colors.textMuted,
      fontSize: 15,
    },
    card: {
      borderRadius: 24,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      gap: 14,
    },
    kicker: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 1.6,
    },
    title: {
      color: colors.text,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: "800",
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
      lineHeight: 20,
    },
    summaryRow: {
      flexDirection: "row",
      gap: 10,
    },
    summaryBox: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: colors.surfaceMuted,
      gap: 4,
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 20,
      fontWeight: "700",
    },
    summaryValueSmall: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
    statusBanner: {
      borderRadius: 14,
      backgroundColor: colors.surfaceMuted,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statusBannerText: {
      color: colors.text,
      lineHeight: 20,
      fontSize: 14,
      fontWeight: "600",
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: "700",
      marginTop: 4,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
    },
    row: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 10,
      paddingHorizontal: 12,
      gap: 4,
    },
    rowTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "700",
    },
    rowMeta: {
      color: colors.textMuted,
      fontSize: 13,
    },
    rowHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 4,
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
    },
    statusBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    timeRow: {
      marginTop: 2,
    },
    primaryButton: {
      marginTop: 8,
      borderRadius: 16,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
    },
    secondaryButton: {
      marginTop: 4,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    disabledButton: {
      opacity: 0.45,
    },
    primaryButtonText: {
      color: colors.textOnAccent,
      fontSize: 16,
      fontWeight: "700",
    },
    secondaryButtonText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: "700",
    },
  });

export default RecoveryProgressScreen;
