import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { TrezoBottomSheet } from "@shared/components/sheets";
import { useAppTheme } from "@theme";

export type SignTypedDataHandle = {
  ask: (origin: string, typedData: unknown) => Promise<boolean>;
};

export const SignTypedDataSheet = forwardRef<SignTypedDataHandle>((_, ref) => {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [origin, setOrigin] = useState("");
  const [domainName, setDomainName] = useState("");
  const [primaryType, setPrimaryType] = useState("");
  const [messageJson, setMessageJson] = useState("");
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);
  const { theme } = useAppTheme();
  const { colors } = theme;

  useImperativeHandle(ref, () => ({
    ask: (o, td) =>
      new Promise<boolean>((resolve) => {
        setOrigin(o);
        const data = td as Record<string, unknown>;
        const domain = (data?.domain ?? {}) as Record<string, unknown>;
        setDomainName(String(domain?.name ?? ""));
        setPrimaryType(String(data?.primaryType ?? ""));
        setMessageJson(
          JSON.stringify(data?.message ?? data, null, 2).slice(0, 800),
        );
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
        <Text style={[styles.title, { color: colors.textPrimary }]}>Sign Typed Data</Text>
        <Text style={[styles.origin, { color: colors.textMuted }]}>{origin}</Text>
        {domainName ? (
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            Domain: {domainName}  {primaryType ? `· Type: ${primaryType}` : ""}
          </Text>
        ) : null}
        <ScrollView
          style={[styles.messageBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          contentContainerStyle={styles.messageContent}
        >
          <Text style={[styles.messageText, { color: colors.textPrimary }]}>{messageJson}</Text>
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

SignTypedDataSheet.displayName = "SignTypedDataSheet";

const styles = StyleSheet.create({
  body: { gap: 12, paddingVertical: 12 },
  title: { fontSize: 18, fontWeight: "600" },
  origin: { fontSize: 13 },
  meta: { fontSize: 13, fontWeight: "500" },
  messageBox: {
    maxHeight: 160,
    borderRadius: 12,
    borderWidth: 1,
  },
  messageContent: { padding: 12 },
  messageText: { fontFamily: "monospace", fontSize: 12, lineHeight: 18 },
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
