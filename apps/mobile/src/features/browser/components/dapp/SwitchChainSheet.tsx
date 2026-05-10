import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { TrezoBottomSheet } from "@shared/components/sheets";
import { useAppTheme } from "@theme";
import { CHAINS } from "@/src/integration/chains";
import type { SupportedChainId } from "@/src/integration/chains";

export type SwitchChainHandle = {
  ask: (origin: string, targetChainId: number) => Promise<boolean>;
};

function chainName(chainId: number): string {
  const cfg = (CHAINS as Record<number, { name: string } | undefined>)[chainId];
  return cfg?.name ?? `Chain ${chainId}`;
}

export const SwitchChainSheet = forwardRef<SwitchChainHandle>((_, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [origin, setOrigin] = useState("");
  const [targetName, setTargetName] = useState("");
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const { theme } = useAppTheme();
  const { colors } = theme;

  useImperativeHandle(ref, () => ({
    ask: (o, cid) =>
      new Promise<boolean>((resolve) => {
        setOrigin(o);
        setTargetName(chainName(cid));
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
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Switch to {targetName}?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {origin} is requesting to switch the active network.
        </Text>
        <View style={styles.row}>
          <Pressable
            onPress={() => finish(false)}
            style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
          >
            <Text style={{ color: colors.textPrimary }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() => finish(true)}
            style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.accent }]}
          >
            <Text style={{ color: "#000", fontWeight: "700" }}>Switch</Text>
          </Pressable>
        </View>
      </View>
    </TrezoBottomSheet>
  );
});

SwitchChainSheet.displayName = "SwitchChainSheet";

const styles = StyleSheet.create({
  body: { gap: 16, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: "600" },
  subtitle: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 12, marginTop: 8 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  btnPrimary: {},
  btnSecondary: { borderWidth: 1 },
});
