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

type Tile = {
  key: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  color: string; // decorative per-action accent (reads on both light & dark)
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

    const tiles: Tile[] = [
      { key: "reload", icon: "rotate-cw", label: "Reload", color: "#06B6D4", onPress: run(onReload) },
      { key: "forward", icon: "arrow-right", label: "Forward", color: "#7C3AED", onPress: run(onForward), disabled: !canGoForward },
      { key: "copy", icon: "copy", label: "Copy link", color: "#3B82F6", onPress: run(onCopyLink) },
      { key: "share", icon: "share-2", label: "Share", color: "#10B981", onPress: run(onShare) },
      { key: "newtab", icon: "plus-square", label: "New tab", color: "#F59E0B", onPress: run(onNewTab) },
      { key: "settings", icon: "settings", label: "Settings", color: "#8B8B98", onPress: run(onOpenSettings) },
    ];

    return (
      <TrezoBottomSheet ref={sheetRef} enableDynamicSizing backgroundColor={colors.background}>
        <View style={styles.body}>
          {/* Site header */}
          <View style={[styles.header, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View
              style={[
                styles.favicon,
                { backgroundColor: connected ? colors.successSoft : colors.surfaceMuted },
              ]}
            >
              <Feather name="globe" size={20} color={connected ? colors.success : colors.textMuted} />
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

          {/* Colorful action grid */}
          <View style={styles.grid}>
            {tiles.map((tile) => (
              <Pressable
                key={tile.key}
                onPress={tile.onPress}
                disabled={tile.disabled}
                style={({ pressed }) => [
                  styles.tile,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    opacity: tile.disabled ? 0.4 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View style={[styles.tileChip, { backgroundColor: `${tile.color}22` }]}>
                  <Feather name={tile.icon} size={20} color={tile.color} />
                </View>
                <Text style={[styles.tileLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                  {tile.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </TrezoBottomSheet>
    );
  },
);

BrowserMenuSheet.displayName = "BrowserMenuSheet";

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
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 9,
  },
  tileChip: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 12.5, fontWeight: "600" },
});
