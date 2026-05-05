import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { TabScreenContainer } from "@shared/components";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { RootStackParamList } from "@/src/types/navigation";

const SecurityPrivacyScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const { colors } = theme;

  return (
    <TabScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Security & Privacy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}> 
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Access Management</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => navigation.navigate("DevicesPasskeys")}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.iconBadge, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                <Feather name="smartphone" size={20} color={colors.accent} />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Devices & Passkeys</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Manage your secure keys and paired devices</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}> 
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recovery Management</Text>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => navigation.navigate("BackupRecovery")}
          >
            <View style={styles.settingInfo}>
              <View style={[styles.iconBadge, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                <Feather name="shield" size={20} color={colors.accent} />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Backup & Recovery</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Guardians, Email Recovery, and Backup Kits</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}> 
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Authentication</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={[styles.iconBadge, { backgroundColor: withAlpha(colors.accentAlt, 0.1) }]}>
                <Feather name="lock" size={20} color={colors.accentAlt} />
              </View>
              <View style={styles.textContainer}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Biometric Authentication</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Required for sensitive actions and cannot be turned off</Text>
              </View>
            </View>
            <Feather name="check-circle" size={18} color={colors.success} />
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
    paddingTop: 60,
    paddingBottom: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
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
    paddingBottom: 40,
  },
  section: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  settingSub: {
    fontSize: 13,
    marginTop: 2,
    marginRight: 10,
  },
});

export default SecurityPrivacyScreen;
