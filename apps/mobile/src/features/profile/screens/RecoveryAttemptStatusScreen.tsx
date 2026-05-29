import { Feather } from "@expo/vector-icons";
import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import type { Address } from "viem";

import { getSupabaseClient } from "@lib/supabase";
import { RootStackParamList } from "@/src/types/navigation";
import { useAppTheme } from "@theme";
import type { ThemeColors } from "@theme";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import {
  useRecoveryAttemptState,
  type ProveEmailStatus,
  type RecoveryAttemptState,
} from "@/src/features/wallet/hooks/useRecoveryAttemptState";
import { EmailRecoveryGroupService } from "@/src/features/wallet/services/EmailRecoveryGroupService";

type StatusRouteProp = RouteProp<RootStackParamList, "RecoveryAttemptStatus">;

// ─── Phase → copy ────────────────────────────────────────────────────────────

function statusPillLabel(state: RecoveryAttemptState): string {
  switch (state.phase) {
    case "awaiting-vote": return "Awaiting guardian reply";
    case "vote-landed-pre-execute": {
      const secsLeft = state.executeAfter - Math.floor(Date.now() / 1000);
      if (secsLeft > 60) return `Vote landed — installing in ${Math.ceil(secsLeft / 60)}m`;
      return `Vote landed — installing in ${Math.max(0, secsLeft)}s`;
    }
    case "executable": return "Ready to install new passkey";
    case "executing": return "Installing new passkey…";
    case "executed": return "Recovery complete ✓";
    case "expired": return "Recovery Attempt expired";
    case "error": return `Error: ${state.reason}`;
    default: return "Checking status…";
  }
}

function statusPillColor(state: RecoveryAttemptState, colors: ThemeColors): string {
  switch (state.phase) {
    case "executed": return colors.success;
    case "expired":
    case "error": return colors.danger;
    case "executable":
    case "vote-landed-pre-execute": return colors.accentAlt;
    case "executing": return colors.accent;
    default: return colors.textSecondary;
  }
}

// ─── Per-guardian state badge ─────────────────────────────────────────────────

function guardianBadgeLabel(s: ProveEmailStatus["proofStatus"]): string {
  switch (s) {
    case "email_sent": return "Awaiting reply";
    case "email_received": return "Reply received, proof pending";
    case "proof_generated": return "Voted ✓";
    case "failed": return "Failed — Retry";
    default: return "Awaiting reply";
  }
}

function guardianBadgeColor(s: ProveEmailStatus["proofStatus"], colors: ThemeColors): string {
  switch (s) {
    case "proof_generated": return colors.success;
    case "failed": return colors.danger;
    case "email_received": return colors.accentAlt;
    default: return colors.textMuted;
  }
}

// ─── Per-chain step chips ─────────────────────────────────────────────────────

type StepState = "done" | "active" | "pending";

function chainSteps(phase: RecoveryAttemptState["phase"]): StepState[] {
  switch (phase) {
    case "awaiting-vote": return ["active", "pending", "pending", "pending"];
    case "vote-landed-pre-execute": return ["done", "active", "pending", "pending"];
    case "executable": return ["done", "done", "active", "pending"];
    case "executing": return ["done", "done", "done", "active"];
    case "executed": return ["done", "done", "done", "done"];
    default: return ["pending", "pending", "pending", "pending"];
  }
}

const STEP_LABELS = ["Vote", "Delay", "Execute", "Done"];

// ─── Screen ───────────────────────────────────────────────────────────────────

const RecoveryAttemptStatusScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const route = useRoute<StatusRouteProp>();
  const { attemptId } = route.params;

  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(theme.colors), [theme.colors]);

  // ── Load group metadata from Supabase ────────────────────────────────────
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<SupportedChainId>(DEFAULT_CHAIN_ID as SupportedChainId);
  const [approvals, setApprovals] = useState<Array<{ id: string; guardianEmailHash: string; maskedEmail: string | null; relayerRequestId: string | null }>>([]);
  const [debugInfo, setDebugInfo] = useState<string>("");
  const [metaLoading, setMetaLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseClient();
    void (async () => {
      try {
        const { data } = await supabase
          .from("email_recovery_groups")
          .select("smart_account_address, chain_ids, multichain_recovery_data_hash, email_recovery_approvals(id, guardian_email_hash, masked_email, relayer_request_id)")
          .eq("id", attemptId)
          .single();
        if (!data) return;
        setSmartAccountAddress(data.smart_account_address as Address);
        const firstChain = (data.chain_ids as number[])?.[0] ?? DEFAULT_CHAIN_ID;
        setChainId(firstChain as SupportedChainId);
        setApprovals(
          ((data as any).email_recovery_approvals ?? []).map((a: any) => ({
            id: a.id,
            guardianEmailHash: a.guardian_email_hash,
            maskedEmail: a.masked_email ?? null,
            relayerRequestId: a.relayer_request_id ?? null,
          })),
        );
        setDebugInfo(
          `Attempt: ${attemptId}\nAccount: ${data.smart_account_address}\nChain: ${firstChain}\nHash: ${data.multichain_recovery_data_hash}`,
        );
      } finally {
        setMetaLoading(false);
      }
    })();
  }, [attemptId]);

  // ── On-chain hook ─────────────────────────────────────────────────────────
  const { state, triggerExecute, triggerCancelExpired, refetch } = useRecoveryAttemptState({
    smartAccountAddress: smartAccountAddress ?? ("0x0000000000000000000000000000000000000000" as Address),
    chainId,
    attemptId,
  });

  // ── Auto-execute: fire once when phase becomes 'executable' ──────────────
  // ADR-0011: fire-and-forget, non-blocking. See CONTEXT.md "Recovery Attempt".
  const autoExecutedRef = useRef(false);
  useEffect(() => {
    if (state.phase === "executable" && !autoExecutedRef.current && smartAccountAddress) {
      autoExecutedRef.current = true;
      Alert.alert(
        "Installing new passkey",
        `Submitting completeRecovery on-chain…`,
        [{ text: "OK" }],
        { cancelable: true },
      );
      triggerExecute().catch((err) => {
        Alert.alert("Auto-execute failed", err instanceof Error ? err.message : "Unknown error");
      });
    }
  }, [state.phase, smartAccountAddress, triggerExecute]);

  // ── Merge hook relayer statuses with local approval rows ─────────────────
  const guardianRows = useMemo(() => {
    const hookStatuses =
      state.phase === "awaiting-vote" ? state.relayerStatuses : ([] as ProveEmailStatus[]);
    return approvals.map((a) => {
      const match = hookStatuses.find((s) => s.guardianEmailHash === a.guardianEmailHash);
      return {
        ...a,
        proofStatus: match?.proofStatus ?? ("pending" as const),
        error: match?.error ?? null,
      };
    });
  }, [approvals, state]);

  const confirmedCount = guardianRows.filter((r) => r.proofStatus === "proof_generated").length;

  // ── Overflow menu ─────────────────────────────────────────────────────────
  const handleOverflow = useCallback(() => {
    const options = ["Copy debug info", "Cancel Recovery Attempt", "Dismiss"];
    const cancelIdx = 2;
    const destructiveIdx = 1;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIdx, destructiveButtonIndex: destructiveIdx },
        (idx) => {
          if (idx === 0) void Clipboard.setStringAsync(debugInfo);
          if (idx === 1) handleCancel();
        },
      );
    } else {
      Alert.alert("Recovery Attempt options", undefined, [
        { text: "Copy debug info", onPress: () => void Clipboard.setStringAsync(debugInfo) },
        {
          text: "Cancel Recovery Attempt",
          style: "destructive",
          onPress: handleCancel,
        },
        { text: "Dismiss", style: "cancel" },
      ]);
    }
  }, [debugInfo]);

  const handleCancel = useCallback(() => {
    Alert.alert(
      "Cancel Recovery Attempt?",
      "This will clear the on-chain vote and delete the pending Recovery Attempt. You can start a new one at any time.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel Attempt",
          style: "destructive",
          onPress: async () => {
            try {
              await EmailRecoveryGroupService.cancelGroup(attemptId);
              navigation.goBack();
            } catch (err) {
              Alert.alert("Cancel failed", err instanceof Error ? err.message : "Unknown error");
            }
          },
        },
      ],
    );
  }, [attemptId, navigation]);

  const handleResend = useCallback(async (approvalId: string) => {
    try {
      await EmailRecoveryGroupService.resendRecoveryRequest(attemptId, approvalId);
      void refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Resend failed";
      // Detect "Account code already used" from prove.email
      if (msg.toLowerCase().includes("account code already used")) {
        Alert.alert("Already sent", "This guardian has already received an approval email. Ask them to check their inbox.");
      } else {
        Alert.alert("Resend failed", msg);
      }
    }
  }, [attemptId, refetch]);

  if (metaLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.accentAlt} />
      </View>
    );
  }

  const steps = chainSteps(state.phase);
  const pillColor = statusPillColor(state, theme.colors);

  return (
    <View style={styles.container}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recovery Attempt</Text>
        <TouchableOpacity onPress={handleOverflow}>
          <Feather name="more-horizontal" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Block 1: Status pill ────────────────────────────────────────── */}
        <View style={[styles.pillRow, { borderColor: `${pillColor}40`, backgroundColor: `${pillColor}12` }]}>
          <View style={[styles.pillDot, { backgroundColor: pillColor }]} />
          <Text style={[styles.pillLabel, { color: pillColor }]}>
            {statusPillLabel(state)}
          </Text>
          {(state.phase === "awaiting-vote" || state.phase === "vote-landed-pre-execute") && (
            <TouchableOpacity onPress={() => void refetch()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="refresh-cw" size={14} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Block 2: Per-guardian section ───────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guardians</Text>
          <Text style={styles.sectionSub}>
            {confirmedCount} of {guardianRows.length} confirmed
          </Text>
          {guardianRows.map((g) => (
            <View key={g.id} style={[styles.guardianRow, { borderColor: theme.colors.border }]}>
              <View style={styles.guardianLeft}>
                <Text style={[styles.guardianEmail, { color: theme.colors.textPrimary }]}>
                  {g.maskedEmail ?? "••••@•••.•••"}
                </Text>
                <Text style={[styles.guardianStatus, { color: guardianBadgeColor(g.proofStatus, theme.colors) }]}>
                  {guardianBadgeLabel(g.proofStatus)}
                </Text>
              </View>
              {(g.proofStatus === "failed" || (g.proofStatus === "pending" && !g.relayerRequestId)) && (
                <TouchableOpacity
                  style={[styles.resendBtn, { borderColor: theme.colors.accentAlt }]}
                  onPress={() => void handleResend(g.id)}
                >
                  <Feather name="refresh-cw" size={13} color={theme.colors.accentAlt} />
                  <Text style={[styles.resendLabel, { color: theme.colors.accentAlt }]}>Retry</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* ── Block 3: Per-chain inline progress (v1: Base Sepolia only) ───── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chain progress</Text>
          <View style={styles.stepsRow}>
            {STEP_LABELS.map((label, i) => {
              const s = steps[i];
              const dotColor =
                s === "done" ? theme.colors.success
                : s === "active" ? theme.colors.accentAlt
                : theme.colors.border;
              const labelColor =
                s === "pending" ? theme.colors.textMuted : theme.colors.textPrimary;
              return (
                <React.Fragment key={label}>
                  <View style={styles.stepChip}>
                    <View style={[styles.stepDot, { backgroundColor: dotColor }]}>
                      {s === "done" && <Feather name="check" size={10} color="#fff" />}
                      {s === "active" && <ActivityIndicator size="small" color="#fff" style={{ transform: [{ scale: 0.55 }] }} />}
                    </View>
                    <Text style={[styles.stepLabel, { color: labelColor }]}>{label}</Text>
                  </View>
                  {i < STEP_LABELS.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: steps[i] === "done" ? theme.colors.success : theme.colors.border }]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* ── DEV: extended debug ─────────────────────────────────────────── */}
        {__DEV__ && (
          <View style={[styles.section, styles.devSection]}>
            <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>Debug</Text>
            <Text style={[styles.devText, { color: theme.colors.textMuted }]}>{debugInfo}</Text>
            <Text style={[styles.devText, { color: theme.colors.textMuted }]}>Phase: {state.phase}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { justifyContent: "center", alignItems: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 17, fontWeight: "600", color: colors.textPrimary },
    scroll: { flex: 1 },
    scrollContent: { padding: 20, gap: 20 },
    pillRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
    },
    pillDot: { width: 8, height: 8, borderRadius: 4 },
    pillLabel: { flex: 1, fontSize: 14, fontWeight: "500" },
    section: { gap: 10 },
    sectionTitle: { fontSize: 13, fontWeight: "600", color: colors.textPrimary, textTransform: "uppercase", letterSpacing: 0.5 },
    sectionSub: { fontSize: 12, color: colors.textMuted, marginTop: -4 },
    guardianRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surfaceCard,
      gap: 10,
    },
    guardianLeft: { flex: 1, gap: 3 },
    guardianEmail: { fontSize: 14, fontWeight: "500" },
    guardianStatus: { fontSize: 12 },
    resendBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
    },
    resendLabel: { fontSize: 12, fontWeight: "500" },
    stepsRow: { flexDirection: "row", alignItems: "center" },
    stepChip: { alignItems: "center", gap: 6, flex: 1 },
    stepDot: {
      width: 24, height: 24, borderRadius: 12,
      alignItems: "center", justifyContent: "center",
    },
    stepLabel: { fontSize: 11, fontWeight: "500" },
    stepLine: { height: 2, flex: 0.5, marginBottom: 14 },
    devSection: { opacity: 0.6 },
    devText: { fontSize: 11, fontFamily: "monospace" },
  });

export default RecoveryAttemptStatusScreen;
