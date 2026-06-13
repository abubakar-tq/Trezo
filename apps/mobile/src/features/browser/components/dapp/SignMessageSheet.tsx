import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { TrezoBottomSheet } from "@shared/components/sheets";
import { useAppTheme } from "@theme";

export type SignMessageHandle = {
  ask: (origin: string, hexMessage: string) => Promise<boolean>;
};

function decodeHexMessage(hex: string): string {
  try {
    const cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
    const bytes = new Uint8Array(
      cleaned.match(/.{1,2}/g)?.map((b) => parseInt(b, 16)) ?? [],
    );
    const decoded = new TextDecoder("utf-8").decode(bytes);
    // Only treat as text if it's mostly printable ASCII / UTF-8
    if (/^[\x20-\x7E\t\n\r -￿]*$/.test(decoded)) return decoded;
  } catch {
    // fall through
  }
  return hex;
}

export const SignMessageSheet = forwardRef<SignMessageHandle>((_, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [origin, setOrigin] = useState("");
  const [message, setMessage] = useState("");
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const { theme } = useAppTheme();
  const { colors } = theme;

  useImperativeHandle(ref, () => ({
    ask: (o, hex) =>
      new Promise<boolean>((resolve) => {
        setOrigin(o);
        setMessage(decodeHexMessage(hex));
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
        <Text style={[styles.title, { color: colors.textPrimary }]}>Sign Message</Text>
        <Text style={[styles.origin, { color: colors.textMuted }]}>{origin}</Text>
        <ScrollView
          style={[styles.messageBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          contentContainerStyle={styles.messageContent}
        >
          <Text style={[styles.messageText, { color: colors.textPrimary }]}>{message}</Text>
        </ScrollView>
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
            <Text style={{ color: "#000", fontWeight: "700" }}>Approve</Text>
          </Pressable>
        </View>
      </View>
    </TrezoBottomSheet>
  );
});

SignMessageSheet.displayName = "SignMessageSheet";

const styles = StyleSheet.create({
  body: { gap: 12, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: "600" },
  origin: { fontSize: 13 },
  messageBox: {
    maxHeight: 160,
    borderRadius: 12,
    borderWidth: 1,
  },
  messageContent: { padding: 12 },
  messageText: { fontFamily: "monospace", fontSize: 13, lineHeight: 20 },
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
