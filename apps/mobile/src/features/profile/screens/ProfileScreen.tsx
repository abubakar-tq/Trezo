import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Avatar, TabScreenContainer } from "@shared/components";
import { MeshBackground } from "@shared/components/MeshBackground";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { RootStackParamList } from "@/src/types/navigation";
import { useTabContentBottomInset } from "@hooks";
import { getSupabaseClient } from "@lib/supabase";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

type SettingsItem = {
  label: string;
  icon: FeatherIconName;
  route?: keyof RootStackParamList;
};

const baseSettingsItems: SettingsItem[] = [
  { label: "Contacts", icon: "book", route: "ContactList" },
  { label: "Browser settings", icon: "globe", route: "BrowserSettings" },
  { label: "Devices & passkeys", icon: "smartphone", route: "DevicesPasskeys" },
  { label: "Notifications", icon: "bell", route: "NotificationSettings" },
  { label: "Backup & recovery", icon: "cloud", route: "BackupRecovery" },
];

const settingsItems: SettingsItem[] = [
  ...baseSettingsItems,
  // Dev-only quick link into the AA createAccount tester
  ...(__DEV__
    ? ([
        {
          label: "Dev Controls",
          icon: "cpu",
          route: "DevCreateAccount",
        },
      ] satisfies SettingsItem[])
    : []),
];

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme, resolvedMode, setMode } = useAppTheme();
  const { colors, gradients } = theme;
  const styles = useMemo(() => createStyles(colors, resolvedMode), [colors, resolvedMode]);
  const contentBottomInset = useTabContentBottomInset();

  const user = useUserStore((state) => state.user);
  const profile = useUserStore((state) => state.profile);
  const resetUser = useUserStore((state) => state.reset);
  const setGuardNavigation = useAuthFlowStore(
    (state) => state.setGuardNavigation,
  );

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);

  const displayName =
    profile?.username ??
    user?.email?.split("@")[0]?.replace(/[^a-zA-Z0-9]/g, " ") ??
    "Explorer";

  const avatarUri = profile?.avatarUrl ?? null;

  const handleToggleTheme = useCallback(() => {
    setMode(resolvedMode === "dark" ? "light" : "dark");
  }, [resolvedMode, setMode]);

  const executeSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      const client = getSupabaseClient();
      await client.auth.signOut();
    } catch (error) {
      // Log but don't block — if Supabase is unreachable (local dev), still clear local state
      console.warn("Supabase signOut failed (continuing locally):", error);
    }

    // Always clear local state and navigate away
    resetUser();
    setGuardNavigation(false);
    setConfirmVisible(false);
    navigation.reset({
      index: 0,
      routes: [{ name: "AuthNavigation" }],
    });

    setIsSigningOut(false);
  }, [isSigningOut, navigation, resetUser, setGuardNavigation]);

  return (
    <TabScreenContainer includeBottomInset>
      <MeshBackground intensity={resolvedMode === "dark" ? 0.25 : 0.8} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: contentBottomInset },
        ]}
      >
        <View style={styles.heroWrapper}>
          <View style={styles.heroCard}>
            <View style={styles.heroHeader}>
              <TouchableOpacity
                onPress={() => navigation.navigate("ProfileEdit")}
                activeOpacity={0.85}
              >
                <Avatar size={72} uri={avatarUri} label={displayName} />
              </TouchableOpacity>
              <View style={styles.heroInfo}>
                <TouchableOpacity
                  onPress={() => navigation.navigate("ProfileEdit")}
                >
                  <Text style={styles.name}>{displayName}</Text>
                </TouchableOpacity>
                <Text style={styles.email}>
                  {user?.email ?? "wallet@trezo.app"}
                </Text>
                <Text style={styles.modeHint}>
                  Theme: {resolvedMode === "dark" ? "Dark" : "Light"} mode
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleToggleTheme}
                accessibilityRole="button"
                accessibilityLabel="Toggle theme"
                style={styles.themeToggle}
                activeOpacity={0.85}
              >
                <Feather
                  name={resolvedMode === "dark" ? "sun" : "moon"}
                  size={18}
                  color={colors.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.settingsCard}>
            <Text style={styles.sectionTitle}>TECHNICAL PROFILE</Text>
          {settingsItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              activeOpacity={0.85}
              style={[
                styles.settingRow,
                index < settingsItems.length - 1 && styles.rowBorder,
              ]}
              onPress={() => {
                if (item.route) {
                  navigation.navigate(item.route as never);
                }
              }}
            >
              <View style={styles.settingInfo}>
                <Feather name={item.icon as any} size={18} color={colors.accent} />
                <Text style={styles.settingLabel}>{item.label}</Text>
              </View>
              <Feather
                name="chevron-right"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          ))}
        </View>
      </View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.signOutButton}
          onPress={() => setConfirmVisible(true)}
          disabled={isSigningOut}
        >
          {isSigningOut ? (
            <ActivityIndicator size="small" color={colors.danger} />
          ) : (
            <>
              <View style={styles.signOutIconWrap}>
                <Feather name="log-out" size={18} color={colors.danger} />
              </View>
              <Text style={styles.signOutLabel}>Sign out</Text>
            </>
          )}
        </TouchableOpacity>
        <Modal
          visible={confirmVisible}
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!isSigningOut) setConfirmVisible(false);
          }}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalIconBadge}>
                <Feather
                  name="alert-triangle"
                  size={22}
                  color={colors.danger}
                />
              </View>
              <Text style={styles.modalTitle}>Sign out of Trezo Wallet?</Text>
              <Text style={styles.modalBody}>
                Youll need to authenticate again to access your wallet data.
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalCancel]}
                  onPress={() => setConfirmVisible(false)}
                  disabled={isSigningOut}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalCancelLabel}>Stay signed in</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.modalDanger,
                    isSigningOut && styles.modalButtonDisabled,
                  ]}
                  onPress={executeSignOut}
                  activeOpacity={0.85}
                  disabled={isSigningOut}
                >
                  {isSigningOut ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalDangerLabel}>Sign out</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </TabScreenContainer>
  );
};

const createStyles = (colors: ThemeColors, mode: "dark" | "light") =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    heroWrapper: {
      marginBottom: 20,
    },
    heroCard: {
      backgroundColor: mode === 'dark' ? 'rgba(25, 25, 25, 0.65)' : '#FFFFFF',
      padding: 24,
      borderRadius: 28,
      borderWidth: 1,
      borderColor: colors.border,
      // Zero Depth
      shadowOpacity: 0,
      elevation: 0,
    },
    heroHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    heroInfo: {
      flex: 1,
    },
    name: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "700",
    },
    email: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 4,
    },
    modeHint: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 8,
    },
    themeToggle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: withAlpha(colors.textPrimary, 0.18),
      backgroundColor: withAlpha(colors.textPrimary, 0.08),
    },
    card: {
      marginBottom: 20,
    },
    settingsCard: {
      backgroundColor: mode === 'dark' ? 'rgba(25, 25, 25, 0.65)' : '#FFFFFF',
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
      // Zero Depth
      shadowOpacity: 0,
      elevation: 0,
    },
    sectionTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "800",
      textTransform: 'uppercase',
      letterSpacing: 2,
      marginBottom: 16,
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
    },
    settingInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    settingLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    signOutButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.3),
      backgroundColor: mode === 'dark' ? 'rgba(220, 38, 38, 0.08)' : 'rgba(220, 38, 38, 0.04)',
      marginTop: 8,
    },
    signOutIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.danger, 0.18),
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.28),
    },
    signOutLabel: {
      color: colors.danger,
      fontSize: 16,
      fontWeight: "700",
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(4,3,10,0.78)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modalCard: {
      width: "100%",
      borderRadius: 28,
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.2),
      backgroundColor: mode === 'dark' ? 'rgba(25, 25, 25, 0.95)' : '#FFFFFF',
      paddingVertical: 28,
      paddingHorizontal: 24,
      alignItems: "center",
      gap: 16,
      // Zero Depth
      shadowOpacity: 0,
      elevation: 0,
    },
    modalIconBadge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: withAlpha(colors.danger, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(colors.danger, 0.22),
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "700",
      textAlign: "center",
    },
    modalBody: {
      color: colors.textSecondary,
      fontSize: 14,
      textAlign: "center",
      lineHeight: 20,
    },
    modalActions: {
      flexDirection: "row",
      gap: 12,
      width: "100%",
      marginTop: 8,
    },
    modalButton: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    modalCancel: {
      borderColor: withAlpha(colors.textPrimary, 0.18),
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
    },
    modalDanger: {
      borderColor: withAlpha(colors.danger, 0.65),
      backgroundColor: colors.danger,
    },
    modalButtonDisabled: {
      opacity: 0.6,
    },
    modalCancelLabel: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },
    modalDangerLabel: {
      color: "#ffffff",
      fontSize: 14,
      fontWeight: "700",
    },
  });

export default ProfileScreen;
