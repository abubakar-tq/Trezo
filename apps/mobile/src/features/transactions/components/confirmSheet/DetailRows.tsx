import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@theme";
import type { GasFee, TxPreview } from "@features/transactions/types/txPreview";

export function DetailRows({ preview, gasFee }: { preview: TxPreview; gasFee?: GasFee }) {
  const { theme } = useAppTheme();
  const c = theme.colors;

  function Row({ k, children }: { k: string; children: React.ReactNode }) {
    return (
      <View style={[styles.row, { borderTopColor: c.borderMuted }]}>
        <Text style={[styles.k, { color: c.textSecondary }]}>{k}</Text>
        <View style={styles.vBox}>{children}</View>
      </View>
    );
  }

  function V({ children }: { children: React.ReactNode }) {
    return <Text style={[styles.v, { color: c.textPrimary }]}>{children}</Text>;
  }

  return (
    <View style={styles.wrap}>
      {preview.recipientDisplay ? (
        <Row k="To">
          <V>{preview.recipientDisplay}</V>
        </Row>
      ) : null}
      {preview.slippageBps != null ? (
        <Row k={`Min received · ${(preview.slippageBps / 100).toFixed(1)}%`}>
          <V>{preview.minReceivedDisplay}</V>
        </Row>
      ) : null}
      {(preview.extraNotes ?? []).map((n) => (
        <Row key={n} k=" ">
          <V>{n}</V>
        </Row>
      ))}
      <Row k="Network">
        <V>{preview.network.name}</V>
      </Row>
      <Row k="Network fee">
        {gasFee?.sponsored ? (
          <View
            style={[
              styles.chip,
              { backgroundColor: c.successSoft, borderColor: c.success },
            ]}
          >
            <Text style={[styles.chipTxt, { color: c.success }]}>Sponsored</Text>
          </View>
        ) : (
          <V>
            {gasFee
              ? `${gasFee.nativeDisplay}${gasFee.fiatDisplay ? ` · ${gasFee.fiatDisplay}` : ""}`
              : "—"}
          </V>
        )}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  k: { fontSize: 13 },
  vBox: { alignItems: "flex-end" },
  v: { fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
  chip: {
    borderRadius: 99,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  chipTxt: { fontSize: 11, fontWeight: "600" },
});
