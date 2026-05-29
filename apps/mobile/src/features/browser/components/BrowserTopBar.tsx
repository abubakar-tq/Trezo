import React from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ThemeColors } from "@theme";
import { getHostname } from "../utils/url";

export type BrowserTopBarProps = {
  url: string;
  text: string;
  onChangeText: (t: string) => void;
  onSubmit: () => void;
  editing: boolean;
  onBeginEdit: () => void;
  onEndEdit: () => void;
  canGoBack: boolean;
  onBack: () => void;
  tabCount: number;
  onOpenTabs: () => void;
  onOpenMenu: () => void;
  colors: ThemeColors;
};

const HIT = { top: 8, bottom: 8, left: 8, right: 8 };

export function BrowserTopBar({
  url,
  text,
  onChangeText,
  onSubmit,
  editing,
  onBeginEdit,
  onEndEdit,
  canGoBack,
  onBack,
  tabCount,
  onOpenTabs,
  onOpenMenu,
  colors,
}: BrowserTopBarProps) {
  const isSecure = /^https:\/\//i.test(url);
  const hostname = getHostname(url);

  return (
    <View style={styles.bar}>
      {editing ? (
        <View style={[styles.editWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.accent }]}>
          <Feather name="search" size={15} color={colors.textMuted} />
          <TextInput
            value={text}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            onBlur={onEndEdit}
            autoFocus
            selectTextOnFocus
            placeholder="Search or enter address"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={Platform.select({ ios: "url", default: "default" })}
            returnKeyType="go"
            style={[styles.input, { color: colors.textPrimary }]}
          />
          {text.length > 0 && (
            <TouchableOpacity onPress={() => onChangeText("")} hitSlop={HIT}>
              <Feather name="x" size={15} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {canGoBack && (
            <TouchableOpacity onPress={onBack} hitSlop={HIT} style={styles.iconBtn}>
              <Feather name="chevron-left" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.domainPill, { backgroundColor: colors.surfaceElevated }]}
            onPress={onBeginEdit}
            activeOpacity={0.7}
          >
            <Feather name={isSecure ? "lock" : "globe"} size={12} color={isSecure ? colors.success : colors.textMuted} />
            <Text style={[styles.domain, { color: colors.textPrimary }]} numberOfLines={1}>
              {hostname || "Search or enter address"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, { borderColor: colors.border }]}
            onPress={onOpenTabs}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabCount, { color: colors.textPrimary }]}>{tabCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onOpenMenu} hitSlop={HIT} style={styles.iconBtn}>
            <Feather name="more-horizontal" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
  },
  iconBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  domainPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: Platform.select({ ios: 9, default: 7 }),
  },
  domain: { fontSize: 13, fontWeight: "600", flexShrink: 1 },
  tabBtn: {
    minWidth: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabCount: { fontSize: 12, fontWeight: "700" },
  editWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.select({ ios: 9, default: 6 }),
  },
  input: { flex: 1, fontSize: 14, fontWeight: "500" },
});
