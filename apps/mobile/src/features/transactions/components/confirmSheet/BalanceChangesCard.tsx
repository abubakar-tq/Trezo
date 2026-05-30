import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@theme";
import { TokenIcon } from "@shared/components/visuals/TokenIcon";
import type { AssetDelta } from "@features/transactions/types/txPreview";

export function BalanceChangesCard({ deltas, label }: { deltas: AssetDelta[]; label: string }) {
  const { theme } = useAppTheme();
  const c = theme.colors;
  return (
    <View>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <View style={[styles.card, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
        {deltas.map((d, i) => (
          <View
            key={`${d.symbol}-${i}`}
            style={[
              styles.row,
              i > 0 && { borderTopColor: c.borderMuted, borderTopWidth: StyleSheet.hairlineWidth },
            ]}
          >
            <TokenIcon symbol={d.symbol} address={d.iconAddress} size={38} />
            <View style={styles.meta}>
              <Text style={[styles.name, { color: c.textPrimary }]}>{d.name ?? d.symbol}</Text>
              <Text style={[styles.sub, { color: c.textSecondary }]}>
                {d.direction === "out" ? "You pay" : "You receive"}
              </Text>
            </View>
            <View style={styles.amtBox}>
              <Text
                style={[styles.amt, { color: d.direction === "out" ? c.danger : c.success }]}
                numberOfLines={1}
              >
                {d.direction === "out" ? "−" : "+"}
                {d.amountDisplay}
              </Text>
              {d.fiatDisplay ? (
                <Text style={[styles.fiat, { color: c.textSecondary }]}>{d.fiatDisplay}</Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 2,
  },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  meta: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  sub: { fontSize: 12, marginTop: 1 },
  amtBox: { alignItems: "flex-end" },
  amt: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  fiat: { fontSize: 11, marginTop: 2, fontVariant: ["tabular-nums"] },
});
