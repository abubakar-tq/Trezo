import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  Easing,
} from "react-native-reanimated";
import { useAppTheme } from "@theme";
import { TokenIcon } from "@shared/components/visuals/TokenIcon";
import type { AssetDelta } from "@features/transactions/types/txPreview";

type Props = { deltas: AssetDelta[]; label: string; scanning?: boolean };

export function BalanceChangesCard({ deltas, label, scanning = false }: Props) {
  const { theme } = useAppTheme();
  const c = theme.colors;

  const y = useSharedValue(0);

  React.useEffect(() => {
    if (scanning) {
      y.value = 0;
      y.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        -1,
        false,
      );
    } else {
      // reset position when done, no animation needed
      y.value = 0;
    }
  }, [scanning, y]);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value * 84 }],
    opacity: scanning ? 0.5 : 0,
  }));

  return (
    <View>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <View style={[styles.card, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
        {/* Scan overlay band — visible only while scanning */}
        <Animated.View
          pointerEvents="none"
          style={[styles.scan, scanStyle, { backgroundColor: c.accent }]}
        />

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
  // Scan band: positioned at the top of the card, translates down across it
  scan: { position: "absolute", left: 0, right: 0, top: 0, height: 24, zIndex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  meta: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600" },
  sub: { fontSize: 12, marginTop: 1 },
  amtBox: { alignItems: "flex-end" },
  amt: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  fiat: { fontSize: 11, marginTop: 2, fontVariant: ["tabular-nums"] },
});
