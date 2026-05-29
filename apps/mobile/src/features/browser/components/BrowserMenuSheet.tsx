import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Feather } from "@expo/vector-icons";
import { TrezoBottomSheet } from "@shared/components/sheets";
import type { ThemeColors } from "@theme";

export type BrowserMenuHandle = { present: () => void; dismiss: () => void };

export type BrowserMenuSheetProps = {
  title: string;
  hostname: string;
  connected: boolean;
  canGoForward: boolean;
  onReload: () => void;
  onForward: () => void;
  onCopyLink: () => void;
  onShare: () => void;
  onNewTab: () => void;
  onDisconnect: () => void;
  onOpenSettings: () => void;
  colors: ThemeColors;
};

type RowItem = {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export const BrowserMenuSheet = forwardRef<BrowserMenuHandle, BrowserMenuSheetProps>(
  (
    {
      title,
      hostname,
      connected,
      canGoForward,
      onReload,
      onForward,
      onCopyLink,
      onShare,
      onNewTab,
      onDisconnect,
      onOpenSettings,
      colors,
    },
    ref,
  ) => {
    const sheetRef = useRef<BottomSheetModal>(null);

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const run = (fn: () => void) => () => {
      sheetRef.current?.dismiss();
      fn();
    };

    const rows: RowItem[] = [
      { icon: "rotate-cw", label: "Reload", onPress: run(onReload) },
      { icon: "arrow-right", label: "Forward", onPress: run(onForward), disabled: !canGoForward },
      { icon: "copy", label: "Copy link", onPress: run(onCopyLink) },
      { icon: "share-2", label: "Share", onPress: run(onShare) },
      { icon: "plus-square", label: "New tab", onPress: run(onNewTab) },
      { icon: "settings", label: "Browser settings", onPress: run(onOpenSettings) },
    ];

    return (
      <TrezoBottomSheet ref={sheetRef} enableDynamicSizing>
        <View style={styles.body}>
          {/* Site header */}
          <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View
              style={[
                styles.favicon,
                { backgroundColor: connected ? colors.successSoft : colors.surfaceMuted },
              ]}
            >
              <Feather name="globe" size={19} color={connected ? colors.success : colors.textMuted} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {title || hostname || "New Tab"}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.dot, { backgroundColor: connected ? colors.success : colors.textMuted }]} />
                <Text
                  style={[styles.status, { color: connected ? colors.success : colors.textMuted }]}
                  numberOfLines={1}
                >
                  {connected ? hostname : "Not connected"}
                </Text>
              </View>
            </View>
            {connected && (
              <Pressable
                onPress={run(onDisconnect)}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.disconnectBtn,
                  { backgroundColor: colors.dangerSoft, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={[styles.disconnectText, { color: colors.danger }]}>Disconnect</Text>
              </Pressable>
            )}
          </View>

          {/* Actions */}
          <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
            {rows.map((item, i) => (
              <View key={item.label}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />}
                <MenuRow item={item} colors={colors} />
              </View>
            ))}
          </View>
        </View>
      </TrezoBottomSheet>
    );
  },
);

BrowserMenuSheet.displayName = "BrowserMenuSheet";

function MenuRow({ item, colors }: { item: RowItem; colors: ThemeColors }) {
  return (
    <Pressable
      onPress={item.onPress}
      disabled={item.disabled}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surfaceMuted : "transparent", opacity: item.disabled ? 0.4 : 1 },
      ]}
    >
      <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
        <Feather name={item.icon} size={17} color={colors.textSecondary} />
      </View>
      <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{item.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 8, gap: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  favicon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  status: { fontSize: 12, fontWeight: "500", flexShrink: 1 },
  disconnectBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 },
  disconnectText: { fontSize: 12, fontWeight: "700" },
  group: { borderRadius: 16, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, minHeight: 52 },
  chip: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { fontSize: 15, fontWeight: "600", flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
});
