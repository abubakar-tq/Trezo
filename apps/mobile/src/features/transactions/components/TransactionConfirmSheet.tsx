import React, { forwardRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "@theme";
import { TrezoBottomSheet } from "@shared/components/sheets";
import type { GasFee, SimulationResult, TxPreview } from "@features/transactions/types/txPreview";
import { BalanceChangesCard } from "./confirmSheet/BalanceChangesCard";
import { SimulationStatusPill } from "./confirmSheet/SimulationStatusPill";
import { DetailRows } from "./confirmSheet/DetailRows";

type Props = {
  preview?: TxPreview;
  simulation?: SimulationResult;
  gasFee?: GasFee;
  loading: boolean;
  onApprove: () => void;
  onReject: () => void;
  /** Fires when the sheet finishes closing for ANY reason (button, pan-down, backdrop). */
  onDismiss: () => void;
};

const changesLabel = (kind?: string) =>
  kind === "dapp"
    ? "Simulated balance changes"
    : kind === "send"
      ? "Balance change"
      : "Estimated balance changes";

export const TransactionConfirmSheet = forwardRef<BottomSheetModal, Props>(
  ({ preview, simulation, gasFee, loading, onApprove, onReject, onDismiss }, ref) => {
    const { theme } = useAppTheme();
    const c = theme.colors;
    const deltas = simulation?.assetDeltas ?? preview?.assetDeltas ?? [];
    const blocked = loading || simulation?.status === "revert";

    return (
      <TrezoBottomSheet
        ref={ref}
        enableDynamicSizing
        onDismiss={onDismiss}
        backgroundColor={c.surfaceElevated}
      >
        {preview ? (
          <View>
            {/* Header */}
            <View style={styles.head}>
              <View>
                <Text style={[styles.title, { color: c.textPrimary }]}>{preview.title}</Text>
                {preview.contextLabel ? (
                  <Text style={[styles.ctx, { color: c.textSecondary }]}>
                    {preview.contextLabel}
                  </Text>
                ) : null}
              </View>
              <View style={[styles.netBadge, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
                <Text style={[styles.netTxt, { color: c.accent }]}>{preview.network.name}</Text>
              </View>
            </View>

            {/* Hero: balance changes */}
            <BalanceChangesCard deltas={deltas} label={changesLabel(preview.kind)} scanning={loading} />

            {/* Approval warnings */}
            {(simulation?.warnings ?? []).map((w) => (
              <View key={w} style={[styles.warn, { backgroundColor: c.warningSoft }]}>
                <Text style={[styles.warnTxt, { color: c.warning }]}>⚠ {w}</Text>
              </View>
            ))}

            {/* Detail rows */}
            <DetailRows preview={preview} gasFee={gasFee ?? simulation?.gasFee} />

            {/* Simulation status pill */}
            <SimulationStatusPill
              loading={loading}
              status={simulation?.status}
              revertReason={simulation?.revertReason}
            />

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                onPress={onReject}
                style={[
                  styles.btn,
                  styles.reject,
                  { backgroundColor: c.accentSoft, borderColor: c.border },
                ]}
              >
                <Text style={[styles.btnTxt, { color: c.textPrimary }]}>Reject</Text>
              </Pressable>
              <Pressable
                onPress={onApprove}
                disabled={blocked}
                style={[styles.btn, styles.approve, blocked && styles.blocked]}
              >
                <LinearGradient
                  colors={theme.gradients.brand}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={[styles.btnTxt, { color: c.textOnAccent }]}>Approve</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </TrezoBottomSheet>
    );
  },
);

TransactionConfirmSheet.displayName = "TransactionConfirmSheet";

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    marginTop: 4,
  },
  title: { fontSize: 19, fontWeight: "700" },
  ctx: { fontSize: 12, marginTop: 3 },
  netBadge: {
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  netTxt: { fontSize: 12, fontWeight: "600" },
  warn: { borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, marginTop: 10 },
  warnTxt: { fontSize: 11.5, fontWeight: "600" },
  actions: { flexDirection: "row", gap: 11, marginTop: 18 },
  btn: {
    height: 54,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reject: { flex: 0.72, borderWidth: StyleSheet.hairlineWidth },
  approve: { flex: 1 },
  blocked: { opacity: 0.4 },
  btnTxt: { fontSize: 15, fontWeight: "700" },
});
