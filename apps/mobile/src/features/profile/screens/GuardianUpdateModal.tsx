import { Feather } from "@expo/vector-icons";
import { useAppTheme } from "@theme";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { isAddress, type Address } from "viem";
import { planGuardianUpdate } from "../hooks/useGuardianUpdatePlan";
import { GuardianUpdateConfirm } from "./GuardianUpdateConfirm";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  smartAccountAddress: Address;
  currentGuardians: readonly Address[];
  currentThreshold: bigint;
  chainId: number;
}

type Row = { id: string; address: string; existing: boolean; removed: boolean };

export const GuardianUpdateModal: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
  smartAccountAddress,
  currentGuardians,
  currentThreshold,
  chainId,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;

  const initialRows = useMemo<Row[]>(
    () => currentGuardians.map((a, i) => ({ id: `existing-${i}`, address: a, existing: true, removed: false })),
    [currentGuardians],
  );
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [thresholdInput, setThresholdInput] = useState(currentThreshold.toString());
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (visible) {
      setRows(initialRows);
      setThresholdInput(currentThreshold.toString());
      setShowConfirm(false);
    }
  }, [visible, initialRows, currentThreshold]);

  const proposedAddrs = useMemo(
    () => rows.filter((r) => !r.removed && r.address.trim().length > 0).map((r) => r.address.trim() as Address),
    [rows],
  );

  const proposedThreshold = useMemo(() => {
    const n = parseInt(thresholdInput, 10);
    return Number.isFinite(n) && n > 0 ? BigInt(n) : 0n;
  }, [thresholdInput]);

  const planResult = useMemo(() => {
    if (proposedThreshold === 0n) return null;
    if (proposedAddrs.some((a) => !isAddress(a))) return null;
    return planGuardianUpdate({
      current: currentGuardians,
      currentThreshold,
      proposed: proposedAddrs,
      proposedThreshold,
    });
  }, [currentGuardians, currentThreshold, proposedAddrs, proposedThreshold]);

  const canContinue = planResult?.ok === true;
  const errorMsg = planResult && !planResult.ok ? planResult.error.message : null;

  const toggleRemove = (id: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, removed: !r.removed } : r)));
  };
  const updateAddress = (id: string, value: string) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, address: value } : r)));
  };
  const addRow = () => {
    setRows((rs) => [...rs, { id: `new-${Date.now()}`, address: "", existing: false, removed: false }]);
  };
  const removeNewRow = (id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
  };

  const activeCount = rows.filter((r) => !r.removed && r.address.trim().length > 0).length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={8}>
            <Feather name="x" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Update Guardians</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>GUARDIANS</Text>
          {rows.map((r) => (
            <View
              key={r.id}
              style={[
                styles.row,
                {
                  backgroundColor: r.removed ? `${colors.danger}1A` : colors.surfaceCard,
                  borderColor: r.removed ? colors.danger : colors.border,
                  opacity: r.removed ? 0.7 : 1,
                },
              ]}
            >
              {r.existing ? (
                <Text
                  style={[
                    styles.addrText,
                    {
                      color: r.removed ? colors.danger : colors.textPrimary,
                      textDecorationLine: r.removed ? "line-through" : "none",
                    },
                  ]}
                  numberOfLines={1}
                >
                  {r.address}
                </Text>
              ) : (
                <TextInput
                  style={[styles.addrInput, { color: colors.textPrimary }]}
                  value={r.address}
                  onChangeText={(v) => updateAddress(r.id, v)}
                  placeholder="0x… new guardian address"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              )}
              {r.existing ? (
                <TouchableOpacity onPress={() => toggleRemove(r.id)} hitSlop={8}>
                  <Feather
                    name={r.removed ? "rotate-ccw" : "trash-2"}
                    size={18}
                    color={r.removed ? colors.warning : colors.danger}
                  />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => removeNewRow(r.id)} hitSlop={8}>
                  <Feather name="x" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity style={[styles.addBtn, { borderColor: colors.accent }]} onPress={addRow}>
            <Feather name="plus" size={16} color={colors.accent} />
            <Text style={[styles.addBtnText, { color: colors.accent }]}>Add guardian</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: 24 }]}>
            REQUIRED SIGNATURES (THRESHOLD)
          </Text>
          <View style={[styles.thresholdRow, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
            <TextInput
              style={[styles.thresholdInput, { color: colors.textPrimary }]}
              value={thresholdInput}
              onChangeText={setThresholdInput}
              keyboardType="number-pad"
              maxLength={3}
            />
            <Text style={[styles.thresholdSuffix, { color: colors.textMuted }]}>of {activeCount}</Text>
          </View>

          {errorMsg && <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>}
          {planResult?.ok && (
            <Text style={[styles.previewText, { color: colors.textMuted }]}>
              {planResult.plan.signatureCount === 1
                ? "This change requires 1 signature."
                : "This change requires 2 signatures (remove first, then add)."}
            </Text>
          )}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.continueBtn,
              { backgroundColor: canContinue ? colors.accent : colors.surfaceMuted },
            ]}
            disabled={!canContinue}
            onPress={() => setShowConfirm(true)}
          >
            <Text
              style={[
                styles.continueBtnText,
                { color: canContinue ? colors.textOnAccent : colors.textMuted },
              ]}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>

        {showConfirm && planResult?.ok && (
          <GuardianUpdateConfirm
            visible={showConfirm}
            onClose={() => setShowConfirm(false)}
            onSuccess={() => {
              setShowConfirm(false);
              onSuccess();
            }}
            plan={planResult.plan}
            currentThreshold={currentThreshold}
            proposedThreshold={proposedThreshold}
            smartAccountAddress={smartAccountAddress}
            chainId={chainId}
          />
        )}
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
  sectionLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 8,
  },
  addrText: { flex: 1, fontSize: 13, fontWeight: "600" },
  addrInput: { flex: 1, fontSize: 13, fontWeight: "500", padding: 0 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 4,
  },
  addBtnText: { fontSize: 14, fontWeight: "700" },
  thresholdRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  thresholdInput: { fontSize: 20, fontWeight: "800", minWidth: 40 },
  thresholdSuffix: { fontSize: 14, fontWeight: "600" },
  errorText: { fontSize: 13, fontWeight: "600", marginTop: 12 },
  previewText: { fontSize: 12, fontWeight: "500", marginTop: 12 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  continueBtn: { height: 52, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  continueBtnText: { fontSize: 16, fontWeight: "800" },
});
