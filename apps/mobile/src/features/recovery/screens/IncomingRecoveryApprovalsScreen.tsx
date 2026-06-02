import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "@theme";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Address, Hex } from "viem";

import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { getRecoveryRequestService, type IncomingApprovalRequest } from "@/src/features/wallet/services/RecoveryRequestService";
import { SocialRecoveryService } from "@/src/features/wallet/services/SocialRecoveryService";
import { shouldSponsor } from "@/src/core/paymaster/policy";
import { useUserStore } from "@store/useUserStore";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import {
  describePasskeyAuthority,
  usePasskeyAuthority,
} from "@/src/features/wallet/hooks/usePasskeyAuthority";

const recoveryService = getRecoveryRequestService();

type RowAction = "approve" | "submit-schedule" | "submit-execute" | "waiting" | "complete";

interface RowProps {
  request: IncomingApprovalRequest;
  onApprove: (request: IncomingApprovalRequest) => void;
  onSubmitSchedule: (request: IncomingApprovalRequest) => void;
  onSubmitExecute: (request: IncomingApprovalRequest) => void;
  busy: boolean;
}

function pickAction(request: IncomingApprovalRequest): RowAction {
  if (!request.already_approved) return "approve";
  switch (request.status) {
    case "collecting_approvals":
      return "waiting";
    case "threshold_reached":
      return "submit-schedule";
    case "scheduling":
    case "scheduled":
    case "timelock_pending" as any:
      return "waiting";
    case "ready_to_execute":
      return "submit-execute";
    case "executing":
      // The previous execute attempt didn't complete (record-tx failed, network
      // hiccup, etc). Treat as "needs execute" so the guardian can retry. The
      // contract will reject a true duplicate, and the next sync will flip the
      // row to "executed" once the on-chain tx lands.
      return "submit-execute";
    case "executed":
      return "complete";
    default:
      return "waiting";
  }
}

const RequestRow: React.FC<RowProps> = ({ request, onApprove, onSubmitSchedule, onSubmitExecute, busy }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const shortAddr = `${request.wallet_address.slice(0, 6)}…${request.wallet_address.slice(-4)}`;
  const deadlineMs = new Date(request.deadline).getTime();
  const hoursLeft = Math.max(0, Math.floor((deadlineMs - Date.now()) / 3_600_000));
  const guardianCount = request.guardian_addresses.length;

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconBubble, { backgroundColor: colors.surfaceMuted }]}>
          <Feather name="shield" size={18} color={colors.textSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Recovery request</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
            for {shortAddr}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            {
              backgroundColor:
                request.status === "threshold_reached" ? colors.successSoft : colors.warningSoft,
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: request.status === "threshold_reached" ? colors.success : colors.warning },
            ]}
          >
            {request.status === "threshold_reached" ? "READY" : "PENDING"}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Approvals</Text>
        <Text style={[styles.metaValue, { color: colors.textPrimary }]}>
          {request.approval_count} / {request.threshold} (of {guardianCount} guardians)
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.metaLabel, { color: colors.textMuted }]}>Expires in</Text>
        <Text style={[styles.metaValue, { color: hoursLeft < 6 ? colors.danger : colors.textPrimary }]}>
          ~{hoursLeft}h
        </Text>
      </View>
      {request.requester_note && (
        <View style={[styles.noteBox, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.noteText, { color: colors.textMuted }]} numberOfLines={3}>
            &quot;{request.requester_note}&quot;
          </Text>
        </View>
      )}

      {(() => {
        const action = pickAction(request);
        if (action === "complete") {
          return (
            <View style={[styles.approvedBanner, { backgroundColor: colors.successSoft }]}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.approvedText, { color: colors.success }]}>Recovery executed</Text>
            </View>
          );
        }
        if (action === "waiting") {
          return (
            <View style={[styles.approvedBanner, { backgroundColor: colors.successSoft }]}>
              <Feather name="check-circle" size={16} color={colors.success} />
              <Text style={[styles.approvedText, { color: colors.success }]}>
                {request.already_approved ? "Approved — waiting for next step" : "Waiting"}
              </Text>
            </View>
          );
        }
        const label =
          action === "approve" ? "Approve with Passkey"
          : action === "submit-schedule" ? "Submit Schedule On-Chain"
          : "Execute Recovery";
        const icon: "key" | "send" | "zap" =
          action === "approve" ? "key" : action === "submit-schedule" ? "send" : "zap";
        const handler =
          action === "approve" ? onApprove
          : action === "submit-schedule" ? onSubmitSchedule
          : onSubmitExecute;
        return (
          <TouchableOpacity
            style={[styles.approveBtn, { backgroundColor: busy ? colors.surfaceMuted : colors.accent }]}
            onPress={() => handler(request)}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <>
                <Feather name={icon} size={14} color={colors.textOnAccent} />
                <Text style={[styles.approveBtnText, { color: colors.textOnAccent }]}>{label}</Text>
              </>
            )}
          </TouchableOpacity>
        );
      })()}
    </View>
  );
};

const IncomingRecoveryApprovalsScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const user = useUserStore((s) => s.user);
  const smartAccountAddress = useUserStore((s) => s.smartAccountAddress) as Address | null;
  const activeChainId = useWalletStore((s) => s.activeChainId) as SupportedChainId | undefined;
  const resolvedChainId = (activeChainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;

  // Truth check: if my local passkey isn't actually registered on the wallet's
  // PasskeyValidator, then any UserOp I try to sign for it (approve, schedule,
  // execute) will be rejected by the bundler. Block actions and tell the user.
  const passkeyAuthority = usePasskeyAuthority({
    userId: user?.id,
    smartAccountAddress,
    chainId: resolvedChainId,
  });

  const [requests, setRequests] = useState<IncomingApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!smartAccountAddress) {
      setRequests([]);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const list = await recoveryService.listIncomingApprovalRequests(smartAccountAddress);
      setRequests(list);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load incoming approvals");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [smartAccountAddress]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchRequests();
  }, [fetchRequests]);

  const handleApprove = useCallback(
    async (request: IncomingApprovalRequest) => {
      if (!user?.id || !smartAccountAddress) {
        Alert.alert("Not Ready", "Your wallet is not active on this device.");
        return;
      }
      // Only block on a definitive negative answer. If the authority check is
      // still loading (or errored — we'd surface that elsewhere), proceed and
      // let the bundler validate. Blocking on loading creates a dead-end.
      if (
        !passkeyAuthority.loading &&
        passkeyAuthority.status !== "loading" &&
        passkeyAuthority.status !== "error" &&
        !passkeyAuthority.isAuthoritative
      ) {
        const desc = describePasskeyAuthority(passkeyAuthority.status);
        Alert.alert(desc.title, desc.body);
        return;
      }
      setBusyId(request.id);
      try {
        const passkey = await PasskeyService.getPasskey(user.id);
        if (!passkey) throw new Error("No passkey found on this device");

        // Find my index in the guardian array (lowercase compare).
        const myAddrLower = smartAccountAddress.toLowerCase();
        const guardianIndex = request.guardian_addresses.findIndex(
          (a) => a.toLowerCase() === myAddrLower,
        );
        if (guardianIndex < 0) {
          throw new Error("Your address is not listed as a guardian for this request");
        }

        // Build approveHash UserOp on the chain this request targets.
        const chainId = (request.target_chain_ids?.[0] ?? resolvedChainId) as SupportedChainId;
        const usePaymaster = shouldSponsor("update-guardians", chainId);

        const { userOp, userOpHash } = await SocialRecoveryService.buildApproveHashUserOp({
          smartAccountAddress,
          digest: request.digest as Hex,
          passkeyId: passkey.credentialIdRaw as Hex,
          chainId,
          usePaymaster,
        });

        const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
        const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
        const signedUserOp = { ...userOp, signature: encodedSignature };

        const operationHash = await SocialRecoveryService.submitGuardianUserOp({
          signedUserOp,
          chainId,
        });
        const receipt = await SocialRecoveryService.waitForGuardianReceipt(operationHash, chainId);
        if (!receipt.success) {
          throw new Error("approveHash UserOp reverted on-chain");
        }

        // Record approval in Supabase so the requester sees the count update.
        const submitResult = await recoveryService.submitGuardianApproval({
          requestId: request.id,
          guardianAddress: smartAccountAddress,
          guardianIndex,
          sigKind: "APPROVE_HASH",
          signature: "0x",
          approvalTxHash: receipt.receipt?.transactionHash ?? operationHash,
          chainId,
        });
        if (!submitResult.success) {
          throw new Error(submitResult.error ?? "Failed to record approval in Supabase");
        }

        Alert.alert(
          "Approval Recorded",
          "Your guardian approval is now on-chain. The recovering wallet's counter has been updated.",
        );
        await fetchRequests();
      } catch (err: any) {
        const message = err?.message ?? "Approval failed";
        console.error("[IncomingApprovals] approve failed:", err);
        Alert.alert("Approval Failed", message);
      } finally {
        setBusyId(null);
      }
    },
    [user?.id, smartAccountAddress, resolvedChainId, fetchRequests],
  );

  /**
   * Common helper to build + sign + submit a paymaster-sponsored UserOp from
   * the guardian's smart account that wraps a SocialRecovery raw call.
   */
  const runSponsoredRecoveryCall = useCallback(
    async (
      request: IncomingApprovalRequest,
      mode: "schedule" | "execute",
    ): Promise<void> => {
      if (!user?.id || !smartAccountAddress) {
        Alert.alert("Not Ready", "Your wallet is not active on this device.");
        return;
      }
      if (
        !passkeyAuthority.loading &&
        passkeyAuthority.status !== "loading" &&
        passkeyAuthority.status !== "error" &&
        !passkeyAuthority.isAuthoritative
      ) {
        const desc = describePasskeyAuthority(passkeyAuthority.status);
        Alert.alert(desc.title, desc.body);
        return;
      }
      setBusyId(request.id);
      try {
        const passkey = await PasskeyService.getPasskey(user.id);
        if (!passkey) throw new Error("No passkey found on this device");

        const chainId = (request.target_chain_ids?.[0] ?? resolvedChainId) as SupportedChainId;
        const usePaymaster = shouldSponsor("update-guardians", chainId);

        // 1. Backend builds the SocialRecovery call calldata (reads all guardian sigs).
        const prepared =
          mode === "schedule"
            ? await recoveryService.prepareScheduleRecovery({ requestId: request.id, chainId })
            : await recoveryService.prepareExecuteRecovery({ requestId: request.id, chainId });

        // If the recovery is already scheduled on-chain (e.g., a previous
        // attempt landed but Supabase didn't record it), don't submit again —
        // just sync Supabase from on-chain state and surface success.
        if (mode === "schedule" && (prepared as any).alreadyScheduled) {
          await recoveryService.syncRecoveryStateFromChain({ requestId: request.id, chainId });
          Alert.alert(
            "Already Scheduled",
            "This recovery was already scheduled on-chain. Syncing Supabase state — the timelock continues normally.",
          );
          await fetchRequests();
          return;
        }
        if (!prepared.calldata) {
          throw new Error(`prepare-${mode} returned no calldata and no alreadyScheduled flag`);
        }

        // 2. Mobile wraps in execute() and signs as the guardian's smart account.
        const { userOp, userOpHash } = await SocialRecoveryService.buildRawCallUserOp({
          smartAccountAddress,
          target: prepared.socialRecoveryAddress as Address,
          innerCalldata: prepared.calldata as Hex,  // ensured non-undefined by the alreadyScheduled guard above
          passkeyId: passkey.credentialIdRaw as Hex,
          chainId,
          usePaymaster,
        });

        const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
        const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
        const signedUserOp = { ...userOp, signature: encodedSignature };

        const operationHash = await SocialRecoveryService.submitGuardianUserOp({
          signedUserOp,
          chainId,
        });
        const receipt = await SocialRecoveryService.waitForGuardianReceipt(operationHash, chainId);
        if (!receipt.success) {
          throw new Error(`${mode} UserOp reverted on-chain`);
        }

        // 3. Tell the backend to record the tx hash and update Supabase state.
        await recoveryService.recordRecoveryTx({
          requestId: request.id,
          chainId,
          recordAction: mode,
          txHash: receipt.receipt?.transactionHash ?? operationHash,
        });

        Alert.alert(
          mode === "schedule" ? "Recovery Scheduled" : "Recovery Executed",
          mode === "schedule"
            ? "Schedule transaction confirmed on-chain. Timelock has started."
            : "Recovery executed. The new passkey is now active on the recovering wallet.",
        );
        await fetchRequests();
      } catch (err: any) {
        const message = err?.message ?? `${mode} failed`;
        console.error(`[IncomingApprovals] ${mode} failed:`, err);
        Alert.alert(mode === "schedule" ? "Schedule Failed" : "Execute Failed", message);
      } finally {
        setBusyId(null);
      }
    },
    [user?.id, smartAccountAddress, resolvedChainId, fetchRequests],
  );

  const handleSubmitSchedule = useCallback(
    (request: IncomingApprovalRequest) => void runSponsoredRecoveryCall(request, "schedule"),
    [runSponsoredRecoveryCall],
  );
  const handleSubmitExecute = useCallback(
    (request: IncomingApprovalRequest) => void runSponsoredRecoveryCall(request, "execute"),
    [runSponsoredRecoveryCall],
  );

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft, width: 60, height: 60, borderRadius: 9999 }]}>
        <Feather name="inbox" size={28} color={colors.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No pending approvals</Text>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        When someone you guard initiates a wallet recovery, their request will appear here.
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 4 }]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={8}>
          <Feather name="chevron-left" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Guardian Inbox</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.iconBtn} hitSlop={8}>
          <Feather name="rotate-cw" size={18} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={[styles.errorBanner, { backgroundColor: colors.dangerSoft }]}>
          <Feather name="alert-triangle" size={16} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
        </View>
      )}

      {!passkeyAuthority.loading
        && !passkeyAuthority.isAuthoritative
        && passkeyAuthority.status !== "loading"
        && passkeyAuthority.status !== "error"
        && (() => {
        const desc = describePasskeyAuthority(passkeyAuthority.status);
        const isError = desc.severity === "error";
        const bg = isError ? colors.dangerSoft : colors.warningSoft;
        const fg = isError ? colors.danger : colors.warning;
        return (
          <View style={[styles.errorBanner, { backgroundColor: bg, flexDirection: "column", alignItems: "flex-start", gap: 4 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="alert-octagon" size={16} color={fg} />
              <Text style={[styles.errorText, { color: fg, fontWeight: "600" }]}>{desc.title}</Text>
            </View>
            <Text style={[styles.errorText, { color: fg, fontSize: 12 }]}>{desc.body}</Text>
          </View>
        );
      })()}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            requests.length === 0
              ? styles.emptyContainer
              : { padding: 20, paddingBottom: insets.bottom + 40 }
          }
          renderItem={({ item }) => (
            <RequestRow
              request={item}
              onApprove={handleApprove}
              onSubmitSchedule={handleSubmitSchedule}
              onSubmitExecute={handleSubmitExecute}
              busy={busyId === item.id}
            />
          )}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "600" },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    margin: 16,
    borderRadius: 16,
  },
  errorText: { flex: 1, fontSize: 13, fontWeight: "600" },
  loadingState: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  emptyState: { alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "600", marginTop: 8 },
  emptyText: { fontSize: 14, fontWeight: "500", textAlign: "center", lineHeight: 20 },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "600" },
  cardSubtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  metaLabel: { fontSize: 12, fontWeight: "600" },
  metaValue: { fontSize: 13, fontWeight: "700" },
  noteBox: { padding: 10, borderRadius: 8, marginTop: 8 },
  noteText: { fontSize: 12, fontStyle: "italic" },
  approveBtn: {
    height: 44,
    borderRadius: 16,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  approveBtnText: { fontSize: 14, fontWeight: "600" },
  approvedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 16,
    marginTop: 12,
    justifyContent: "center",
  },
  approvedText: { fontSize: 13, fontWeight: "700" },
});

export default IncomingRecoveryApprovalsScreen;
