import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useAppTheme } from "@theme";
import type { SimulationStatus } from "@features/transactions/types/txPreview";

type Props = { loading: boolean; status?: SimulationStatus; revertReason?: string };

export function SimulationStatusPill({ loading, status, revertReason }: Props) {
  const { theme } = useAppTheme();
  const c = theme.colors;

  if (loading) {
    return (
      <Pill bg={c.accentSoft} fg={c.accent}>
        <ActivityIndicator size="small" color={c.accent} />
        <Label fg={c.accent}>Simulating on-chain…</Label>
      </Pill>
    );
  }

  if (status === "revert") {
    return (
      <Pill bg={c.dangerSoft} fg={c.danger}>
        <Label fg={c.danger}>Will fail: {revertReason ?? "reverts"}</Label>
      </Pill>
    );
  }

  if (status === "unknown") {
    return (
      <Pill bg={c.warningSoft} fg={c.warning}>
        <Label fg={c.warning}>{"Couldn't simulate changes — proceed with care"}</Label>
      </Pill>
    );
  }

  return (
    <Pill bg={c.successSoft} fg={c.success}>
      <Label fg={c.success}>✓ Simulation passed</Label>
    </Pill>
  );
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: fg }]}>{children}</View>
  );
}

function Label({ fg, children }: { fg: string; children: React.ReactNode }) {
  return (
    <Text style={[styles.txt, { color: fg }]} numberOfLines={2}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  txt: { fontSize: 13, fontWeight: "600" },
});
