import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useNotificationStore } from "@features/notifications/store/useNotificationStore";
import { TabScreenContainer } from "@shared/components";
import { useAppTheme } from "@theme";
import React, { useCallback, useEffect } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";

import { useUserStore } from "@/src/store/useUserStore";

const NotificationSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;

  const userId = useUserStore((state) => state.user?.id ?? null);
  const preferences = useNotificationStore((state) => state.preferences);
  const hydrate = useNotificationStore((state) => state.hydrate);
  const savePreferences = useNotificationStore((state) => state.savePreferences);

  useEffect(() => {
    if (userId) {
      hydrate(userId).catch(() => undefined);
    }
  }, [userId, hydrate]);

  const onChange = useCallback(
    (key: "pushEnabled" | "txAlerts" | "swapAlerts" | "marketing", value: boolean) => {
      savePreferences({ [key]: value }).catch(() => undefined);
    },
    [savePreferences],
  );

  const pushOff = !preferences.pushEnabled;

  return (
    <TabScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Global Settings</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="bell" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Push Notifications</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Receive alerts on this device</Text>
              </View>
            </View>
            <Switch
              value={preferences.pushEnabled}
              onValueChange={(v) => onChange("pushEnabled", v)}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Activity Alerts</Text>
          <View style={[styles.settingRow, pushOff && styles.disabledRow]}>
            <View style={styles.settingInfo}>
              <Feather name="repeat" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Transactions</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Incoming and outgoing transfers</Text>
              </View>
            </View>
            <Switch
              value={preferences.txAlerts && preferences.pushEnabled}
              onValueChange={(v) => onChange("txAlerts", v)}
              disabled={pushOff}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />

          <View style={[styles.settingRow, pushOff && styles.disabledRow]}>
            <View style={styles.settingInfo}>
              <Feather name="shuffle" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Swaps</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>DEX swap completions and failures</Text>
              </View>
            </View>
            <Switch
              value={preferences.swapAlerts && preferences.pushEnabled}
              onValueChange={(v) => onChange("swapAlerts", v)}
              disabled={pushOff}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderMuted }]} />

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="shield" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Security Alerts</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Login attempts and recovery changes</Text>
              </View>
            </View>
            <Switch
              value={true}
              disabled={true}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Promotions</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="gift" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>News & Offers</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Stay updated with Trezo ecosystem</Text>
              </View>
            </View>
            <Switch
              value={preferences.marketing}
              onValueChange={(v) => onChange("marketing", v)}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>
      </ScrollView>
    </TabScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    padding: 20,
    gap: 20,
  },
  section: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
    opacity: 0.8,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  disabledRow: {
    opacity: 0.55,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingSub: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
});

export default NotificationSettingsScreen;
