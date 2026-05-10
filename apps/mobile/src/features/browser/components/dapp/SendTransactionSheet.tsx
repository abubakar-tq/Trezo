import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { formatEther } from "viem";
import { TrezoBottomSheet } from "@shared/components/sheets";
import { useAppTheme } from "@theme";

export type SendTransactionHandle = {
  ask: (
    origin: string,
    tx: { to: `0x${string}`; data?: `0x${string}`; value?: `0x${string}` },
  ) => Promise<boolean>;
};

function formatValue(hex: `0x${string}` | undefined): string {
  if (!hex || hex === "0x" || hex === "0x0") return "0 ETH";
  try {
    return `${formatEther(BigInt(hex))} ETH`;
  } catch {
    return hex;
  }
}

function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function dataLabel(data: `0x${string}` | undefined): string {
  if (!data || data === "0x") return "Native transfer";
  const byteLen = Math.floor((data.length - 2) / 2);
  return `Contract call (${byteLen} bytes)`;
}

export const SendTransactionSheet = forwardRef<SendTransactionHandle>((_, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [origin, setOrigin] = useState("");
  const [to, setTo] = useState("");
  const [value, setValue] = useState("");
  const [data, setData] = useState("");
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const { theme } = useAppTheme();
  const { colors } = theme;

  useImperativeHandle(ref, () => ({
    ask: (o, tx) =>
      new Promise<boolean>((resolve) => {
        setOrigin(o);
        setTo(truncateAddress(tx.to));
        setValue(formatValue(tx.value));
        setData(dataLabel(tx.data));
        resolverRef.current = resolve;
        sheetRef.current?.present();
      }),
  }));

  const finish = (ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    sheetRef.current?.dismiss();
  };

  return (
    <TrezoBottomSheet
      ref={sheetRef}
      enableDynamicSizing
      onDismiss={() => {
        if (resolverRef.current) finish(false);
      }}
    >
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Send Transaction</Text>
        <Text style={[styles.origin, { color: colors.textMuted }]}>{origin}</Text>
        <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Row label="To" value={to} colors={colors} />
          <Row label="Value" value={value} colors={colors} />
          <Row label="Data" value={data} colors={colors} last />
        </View>
        <View style={styles.row}>
          <Pressable
            onPress={() => finish(false)}
            style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.textPrimary }}>Reject</Text>
          </Pressable>
          <Pressable
            onPress={() => finish(true)}
            style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: "#000", fontWeight: "700" }}>Approve</Text>
          </Pressable>
        </View>
      </View>
    </TrezoBottomSheet>
  );
});

SendTransactionSheet.displayName = "SendTransactionSheet";

function Row({
  label,
  value,
  colors,
  last,
}: {
  label: string;
  value: string;
  colors: { textSecondary: string; textPrimary: string; border: string };
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.dataRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
      ]}
    >
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: "600" },
  origin: { fontSize: 13 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  label: { fontSize: 13, fontWeight: "500" },
  value: { fontSize: 13, fontWeight: "600", maxWidth: "60%", textAlign: "right" },
  row: { flexDirection: "row", gap: 12, marginTop: 4 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  btnPrimary: {},
  btnSecondary: { borderWidth: 1 },
});
