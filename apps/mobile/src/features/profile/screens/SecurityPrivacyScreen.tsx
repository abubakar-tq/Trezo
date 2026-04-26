import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { TabScreenContainer } from "@shared/components";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Switch } from "react-native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

const SecurityPrivacyScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;

  const [biometricsEnabled, setBiometricsEnabled] = React.useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);

  return (
    <TabScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Security & Privacy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Biometrics</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="unlock" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Enable Biometrics</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Use FaceID or Fingerprint to unlock</Text>
              </View>
            </View>
            <Switch 
              value={biometricsEnabled} 
              onValueChange={setBiometricsEnabled}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Authentication</Text>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="shield" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Two-Factor Auth (2FA)</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Add an extra layer of security</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Privacy</Text>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="eye-off" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Incognito Mode</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Hide balances from main screen</Text>
              </View>
            </View>
            <Switch value={false} trackColor={{ false: colors.border, true: colors.accent }} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </TabScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    fontWeight: '700',
    marginBottom: 16,
    opacity: 0.8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingSub: {
    fontSize: 13,
    marginTop: 2,
  },
});

export default SecurityPrivacyScreen;
