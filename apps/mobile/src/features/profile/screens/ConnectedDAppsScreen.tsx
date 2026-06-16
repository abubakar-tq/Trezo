import React from "react";
import { FlatList, Pressable, Text, View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useDAppSessionsStore } from "@features/browser/store/useDAppSessionsStore";
import { useAppTheme } from "@theme";
import { LABELS } from "@shared/copy/labels";

function hostnameOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function faviconLetter(origin: string): string {
  return hostnameOf(origin).charAt(0).toUpperCase();
}

export function ConnectedDAppsScreen() {
  const { theme } = useAppTheme();
  const sessions = useDAppSessionsStore((s) => s.sessions);
  const remove = useDAppSessionsStore((s) => s.removeSession);

  if (sessions.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.colors.background }]}>
        <Feather name="link" size={32} color={theme.colors.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          No connected dApps yet.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sessions}
      keyExtractor={(s) => s.id}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={
        <View style={styles.listHeader}>
          <Text style={[styles.listHeaderTitle, { color: theme.colors.textPrimary }]}>
            Connected Sites
          </Text>
          <Text style={[styles.listHeaderCount, { color: theme.colors.textSecondary }]}>
            {sessions.length} {sessions.length === 1 ? "site" : "sites"} have access to your wallet
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View
          style={[
            styles.row,
            {
              backgroundColor: theme.colors.surfaceCard,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Site avatar */}
          <View style={[styles.avatar, { backgroundColor: `${theme.colors.accent}22` }]}>
            <Text style={[styles.avatarLetter, { color: theme.colors.accent }]}>
              {faviconLetter(item.origin)}
            </Text>
          </View>

          {/* Site info */}
          <View style={styles.siteInfo}>
            <Text style={[styles.hostname, { color: theme.colors.textPrimary }]} numberOfLines={1}>
              {hostnameOf(item.origin)}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.connectedDot, { backgroundColor: theme.colors.success }]} />
              <Text style={[styles.metaText, { color: theme.colors.textSecondary }]}>
                Connected · {new Date(item.approvedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* Disconnect */}
          <Pressable
            onPress={() => remove(item.origin)}
            hitSlop={12}
            style={[styles.disconnectBtn, { borderColor: `${theme.colors.danger}40` }]}
          >
            <Feather name="x" size={14} color={theme.colors.danger} />
          </Pressable>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 10,
  },
  listHeader: {
    paddingTop: 40,
    paddingBottom: 16,
    gap: 4,
  },
  listHeaderTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  listHeaderCount: {
    fontSize: 13,
    fontWeight: "400",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    gap: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: "700",
  },
  siteInfo: {
    flex: 1,
    gap: 6,
  },
  hostname: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  connectedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "400",
  },
  disconnectBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
