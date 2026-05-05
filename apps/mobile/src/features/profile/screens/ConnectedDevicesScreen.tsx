import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { TabScreenContainer } from "@shared/components";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

const ConnectedDevicesScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;

  const devices = [
    { id: '1', name: 'iPhone 15 Pro', lastActive: 'Active now', icon: 'smartphone', current: true },
    { id: '2', name: 'MacBook Pro 16"', lastActive: '2 hours ago', icon: 'monitor', current: false },
  ];

  return (
    <TabScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Connected Devices</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Manage devices that have access to your Trezo account.
        </Text>

        <View style={styles.deviceList}>
          {devices.map((device) => (
            <View key={device.id} style={[styles.deviceCard, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
              <View style={[styles.iconContainer, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                <Feather name={device.icon as any} size={22} color={colors.accent} />
              </View>
              <View style={styles.deviceInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.deviceName, { color: colors.textPrimary }]}>{device.name}</Text>
                  {device.current && (
                    <View style={[styles.currentBadge, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                      <Text style={[styles.currentText, { color: colors.success }]}>Current</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.lastActive, { color: colors.textSecondary }]}>{device.lastActive}</Text>
              </View>
              {!device.current && (
                <TouchableOpacity style={styles.removeButton}>
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.addDevice, { borderColor: colors.accent, backgroundColor: withAlpha(colors.accent, 0.05) }]}>
          <Feather name="plus" size={20} color={colors.accent} />
          <Text style={[styles.addDeviceText, { color: colors.accent }]}>Link New Device</Text>
        </TouchableOpacity>
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
    gap: 24,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  deviceList: {
    gap: 12,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  currentText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  lastActive: {
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: 8,
  },
  addDevice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 8,
    gap: 8,
  },
  addDeviceText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ConnectedDevicesScreen;
