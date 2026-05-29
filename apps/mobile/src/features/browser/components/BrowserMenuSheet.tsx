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

    return (
      <TrezoBottomSheet ref={sheetRef} enableDynamicSizing>
        <View style={styles.body}>
          <View style={[styles.header, { borderBottomColor: colors.borderMuted }]}>
            <View style={[styles.favicon, { backgroundColor: colors.surfaceElevated }]}>
              <Feather name="globe" size={18} color={colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                {title || hostname || "New Tab"}
              </Text>
              <Text
                style={[styles.status, { color: connected ? colors.success : colors.textMuted }]}
                numberOfLines={1}
              >
                {connected ? `Connected · ${hostname}` : "Not connected"}
              </Text>
            </View>
          </View>

          <MenuRow icon="rotate-cw" label="Reload" color={colors.textPrimary} onPress={run(onReload)} />
          <MenuRow
            icon="chevron-right"
            label="Forward"
            color={colors.textPrimary}
            disabled={!canGoForward}
            onPress={run(onForward)}
          />
          <MenuRow icon="link" label="Copy link" color={colors.textPrimary} onPress={run(onCopyLink)} />
          <MenuRow icon="share" label="Share" color={colors.textPrimary} onPress={run(onShare)} />
          <MenuRow icon="plus" label="New tab" color={colors.textPrimary} onPress={run(onNewTab)} />
          {connected && (
            <MenuRow icon="power" label="Disconnect dApp" color={colors.danger} onPress={run(onDisconnect)} />
          )}
          <MenuRow icon="settings" label="Browser settings" color={colors.textSecondary} onPress={run(onOpenSettings)} />
        </View>
      </TrezoBottomSheet>
    );
  },
);

BrowserMenuSheet.displayName = "BrowserMenuSheet";

function MenuRow({
  icon,
  label,
  color,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}
    >
      <Feather name={icon} size={18} color={color} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: 12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 14,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  favicon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "700" },
  status: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, paddingHorizontal: 4 },
  rowLabel: { fontSize: 15, fontWeight: "500" },
});
