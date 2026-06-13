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

export function ConnectedDAppsScreen() {
  const { theme } = useAppTheme();
  const sessions = useDAppSessionsStore((s) => s.sessions);
  const remove = useDAppSessionsStore((s) => s.removeSession);

  if (sessions.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Feather
          name="link"
          size={32}
          color={theme.colors.textSecondary}
        />
        <Text
          style={[
            styles.emptyText,
            { color: theme.colors.textSecondary },
          ]}
        >
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
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: theme.colors.textPrimary,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              {hostnameOf(item.origin)}
            </Text>
            <Text
              style={{
                color: theme.colors.textSecondary,
                fontSize: 12,
                marginTop: 2,
              }}
            >
              Connected{" "}
              {new Date(item.approvedAt).toLocaleDateString()}
            </Text>
          </View>
          <Pressable
            onPress={() => remove(item.origin)}
            hitSlop={8}
          >
            <Text
              style={{
                color: theme.colors.danger,
                fontSize: 14,
                fontWeight: "600",
              }}
            >
              {LABELS.disconnectDApp}
            </Text>
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
    paddingVertical: 12,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
});
