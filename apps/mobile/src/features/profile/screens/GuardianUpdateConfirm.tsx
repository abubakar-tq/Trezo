import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Address, Hex } from "viem";
import { useUserStore } from "@store/useUserStore";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { SocialRecoveryService } from "@/src/features/wallet/services/SocialRecoveryService";
import { shouldSponsor } from "@/src/core/paymaster/policy";
import type { SupportedChainId } from "@/src/integration/chains";
import type { GuardianUpdateOp, GuardianUpdatePlan } from "../hooks/useGuardianUpdatePlan";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  plan: GuardianUpdatePlan;
  currentThreshold: bigint;
  proposedThreshold: bigint;
  smartAccountAddress: Address;
  chainId: number;
}

type Phase =
  | { kind: "idle" }
  | { kind: "signing"; step: number; total: number }
  | { kind: "submitting"; step: number; total: number }
  | { kind: "waiting"; step: number; total: number; hash: Hex }
  | { kind: "success" }
  | { kind: "failed"; step: number; total: number; message: string };

export const GuardianUpdateConfirm: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
  plan,
  currentThreshold,
  proposedThreshold,
  smartAccountAddress,
  chainId,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const user = useUserStore((s) => s.user);

  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [completedSteps, setCompletedSteps] = useState(0);

  const allAdded = plan.ops.flatMap((o) => (o.kind === "add" ? o.guardians : []));
  const allRemoved = plan.ops.flatMap((o) => (o.kind === "remove" ? o.guardians : []));

  const runOp = async (op: GuardianUpdateOp, stepIdx: number, totalSteps: number): Promise<void> => {
    if (!user?.id) throw new Error("No authenticated user");
    const passkey = await PasskeyService.getPasskey(user.id);
    if (!passkey) throw new Error("No passkey found on this device");

    setPhase({ kind: "signing", step: stepIdx + 1, total: totalSteps });
    const usePaymaster = shouldSponsor("update-guardians", chainId);

    const buildArgs = {
      smartAccountAddress,
      guardians: op.guardians,
      threshold: op.threshold,
      passkeyId: passkey.credentialIdRaw as Hex,
      chainId: chainId as SupportedChainId,
      usePaymaster,
    };

    const { userOp, userOpHash } =
      op.kind === "add"
        ? await SocialRecoveryService.buildAddGuardiansUserOp(buildArgs)
        : await SocialRecoveryService.buildRemoveGuardiansUserOp(buildArgs);

    const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
    const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
    const signedUserOp = { ...userOp, signature: encodedSignature };

    setPhase({ kind: "submitting", step: stepIdx + 1, total: totalSteps });
    const operationHash = await SocialRecoveryService.submitGuardianUserOp({
      signedUserOp,
      chainId: chainId as SupportedChainId,
    });

    setPhase({ kind: "waiting", step: stepIdx + 1, total: totalSteps, hash: operationHash });
    const receipt = await SocialRecoveryService.waitForGuardianReceipt(operationHash, chainId as SupportedChainId);
    if (!receipt.success) {
      throw new Error(`UserOp reverted on-chain (step ${stepIdx + 1}/${totalSteps})`);
    }
  };

  const handleSign = async () => {
    try {
      for (let i = completedSteps; i < plan.ops.length; i++) {
        await runOp(plan.ops[i], i, plan.ops.length);
        setCompletedSteps(i + 1);
      }
      setPhase({ kind: "success" });
      Alert.alert("Guardians Updated", "On-chain guardian set updated successfully.");
      onSuccess();
    } catch (err: any) {
      const message = err?.message ?? "Unknown error";
      console.error("[GuardianUpdateConfirm] failed:", err);
      setPhase({ kind: "failed", step: completedSteps + 1, total: plan.ops.length, message });
    }
  };

  const phaseLabel = (() => {
    switch (phase.kind) {
      case "idle": return null;
      case "signing": return `Step ${phase.step} of ${phase.total}: signing with passkey…`;
      case "submitting": return `Step ${phase.step} of ${phase.total}: submitting…`;
      case "waiting": return `Step ${phase.step} of ${phase.total}: waiting for confirmation…`;
      case "success": return "Done.";
      case "failed": return `Step ${phase.step} of ${phase.total} failed: ${phase.message}`;
    }
  })();

  const isBusy = phase.kind === "signing" || phase.kind === "submitting" || phase.kind === "waiting";

  const buttonLabel =
    phase.kind === "failed"
      ? completedSteps > 0
        ? `Retry step ${completedSteps + 1}`
        : "Retry"
      : "Sign with Passkey";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} disabled={isBusy}>
            <Feather name="chevron-left" size={22} color={isBusy ? colors.textMuted : colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Confirm Changes</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {allRemoved.length > 0 && (
            <View style={styles.diffSection}>
              <Text style={[styles.diffLabel, { color: colors.danger }]}>REMOVING</Text>
              {allRemoved.map((a, i) => (
                <View key={`r-${i}`} style={[styles.diffRow, { backgroundColor: `${colors.danger}10` }]}>
                  <Feather name="minus-circle" size={14} color={colors.danger} />
                  <Text style={[styles.diffAddr, { color: colors.danger }]} numberOfLines={1}>{a}</Text>
                </View>
              ))}
            </View>
          )}

          {allAdded.length > 0 && (
            <View style={styles.diffSection}>
              <Text style={[styles.diffLabel, { color: colors.success }]}>ADDING</Text>
              {allAdded.map((a, i) => (
                <View key={`a-${i}`} style={[styles.diffRow, { backgroundColor: `${colors.success}10` }]}>
                  <Feather name="plus-circle" size={14} color={colors.success} />
                  <Text style={[styles.diffAddr, { color: colors.success }]} numberOfLines={1}>{a}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.diffSection}>
            <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>THRESHOLD</Text>
            <View style={[styles.diffRow, { backgroundColor: colors.surfaceCard }]}>
              <Text style={[styles.diffAddr, { color: colors.textPrimary }]}>
                {currentThreshold.toString()} → {proposedThreshold.toString()}
              </Text>
            </View>
          </View>

          <View style={[styles.feeRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.feeLabel, { color: colors.textMuted }]}>Network fee</Text>
            <Text style={[styles.feeValue, { color: colors.success }]}>Sponsored</Text>
          </View>

          <Text style={[styles.sigCount, { color: colors.textMuted }]}>
            {plan.signatureCount === 1
              ? "Requires 1 passkey signature."
              : "Requires 2 passkey signatures (remove first, then add)."}
          </Text>

          {phaseLabel && (
            <View
              style={[
                styles.phaseBox,
                {
                  backgroundColor:
                    phase.kind === "failed"
                      ? `${colors.danger}1A`
                      : phase.kind === "success"
                      ? `${colors.success}1A`
                      : `${colors.accent}1A`,
                },
              ]}
            >
              {isBusy && <ActivityIndicator size="small" color={colors.accent} />}
              <Text
                style={[
                  styles.phaseText,
                  {
                    color:
                      phase.kind === "failed"
                        ? colors.danger
                        : phase.kind === "success"
                        ? colors.success
                        : colors.textPrimary,
                  },
                ]}
              >
                {phaseLabel}
              </Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.signBtn, { backgroundColor: isBusy ? colors.surfaceMuted : colors.accent }]}
            onPress={handleSign}
            disabled={isBusy || phase.kind === "success"}
          >
            {isBusy ? (
              <ActivityIndicator color={colors.textOnAccent} />
            ) : (
              <>
                <Feather name="key" size={16} color={colors.textOnAccent} />
                <Text style={[styles.signBtnText, { color: colors.textOnAccent }]}>{buttonLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 17, fontWeight: "700" },
  body: { padding: 20, paddingBottom: 100 },
  diffSection: { marginBottom: 20 },
  diffLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 10 },
  diffRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  diffAddr: { flex: 1, fontSize: 13, fontWeight: "600" },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  feeLabel: { fontSize: 13, fontWeight: "600" },
  feeValue: { fontSize: 13, fontWeight: "800" },
  sigCount: { fontSize: 12, fontWeight: "500", marginTop: 16, textAlign: "center" },
  phaseBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  phaseText: { flex: 1, fontSize: 13, fontWeight: "600" },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  signBtn: {
    height: 52,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signBtnText: { fontSize: 16, fontWeight: "800" },
});
