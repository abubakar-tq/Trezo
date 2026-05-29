import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import { Avatar, TabScreenContainer } from "@shared/components";
import { LABELS } from "@shared/copy/labels";
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
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { getDeployment, getPublicClient } from "@/src/integration/viem";
import { RecoveryAttemptBanner } from "@shared/components/banners/RecoveryAttemptBanner";
import { ABIS } from "@/src/integration/viem/abis";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { Alert } from "react-native";
import type { Address, Hex } from "viem";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

type SettingsItem = {
  label: string;
  icon: FeatherIconName;
  tint: string;
  route?: keyof RootStackParamList;
};

type SettingsGroup = {
  title: string;
  items: SettingsItem[];
};

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme, resolvedMode, setMode } = useAppTheme();
  const { colors, gradients } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const contentBottomInset = useTabContentBottomInset();

  const user = useUserStore((state) => state.user);
  const profile = useUserStore((state) => state.profile);
  const smartAccountDeployed = useUserStore((state) => state.smartAccountDeployed);
  const resetUser = useUserStore((state) => state.reset);
  const setGuardNavigation = useAuthFlowStore((state) => state.setGuardNavigation);

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [checkingPasskey, setCheckingPasskey] = useState(false);

  // DEV: paths used by Check Passkey Authority button.
  const smartAccountAddress = useUserStore((s) => s.smartAccountAddress) as Address | null;
  const activeChainId = useWalletStore((s) => s.activeChainId) as SupportedChainId | undefined;

  const handleCheckPasskeyAuthority = useCallback(async () => {
    if (checkingPasskey) return;
    setCheckingPasskey(true);
    try {
      if (!user?.id) throw new Error("No signed-in user");
      if (!smartAccountAddress) throw new Error("No smart account on record");

      const chainId = (activeChainId ?? DEFAULT_CHAIN_ID) as SupportedChainId;
      const local = await PasskeyService.getPasskey(user.id);
      const deployment = getDeployment(chainId);
      const validatorAddr = deployment?.passkeyValidator as Address | undefined;
      if (!validatorAddr) throw new Error("No PasskeyValidator address in deployment");

      const client = getPublicClient(chainId);

      const lines: string[] = [];
      lines.push(`Chain: ${chainId}`);
      lines.push(`Wallet: ${smartAccountAddress.slice(0, 10)}…${smartAccountAddress.slice(-6)}`);
      lines.push(`Validator: ${validatorAddr.slice(0, 10)}…${validatorAddr.slice(-6)}`);

      // 1) Local passkey snapshot
      if (!local) {
        lines.push("");
        lines.push("❌ No local passkey for this user on this device.");
        lines.push("→ You cannot sign UserOps until a passkey is provisioned (or recovered).");
        Alert.alert("Passkey Authority Check", lines.join("\n"));
        return;
      }
      const credentialIdRaw = local.credentialIdRaw as Hex;
      lines.push("");
      lines.push("Local passkey:");
      lines.push(`  credentialId: ${credentialIdRaw.slice(0, 14)}…${credentialIdRaw.slice(-10)}`);
      lines.push(`  X: ${(local.publicKeyX ?? "0x").slice(0, 14)}…`);
      lines.push(`  Y: ${(local.publicKeyY ?? "0x").slice(0, 14)}…`);

      // 2) On-chain validator state
      const [count, isInit, hasIt] = await Promise.all([
        client.readContract({
          address: validatorAddr,
          abi: ABIS.passkeyValidator,
          functionName: "passkeyCount",
          args: [smartAccountAddress],
        }).catch(() => 0n) as Promise<bigint>,
        client.readContract({
          address: validatorAddr,
          abi: ABIS.passkeyValidator,
          functionName: "isInitialized",
          args: [smartAccountAddress],
        }).catch(() => false) as Promise<boolean>,
        client.readContract({
          address: validatorAddr,
          abi: ABIS.passkeyValidator,
          functionName: "hasPasskey",
          args: [smartAccountAddress, credentialIdRaw],
        }).catch(() => false) as Promise<boolean>,
      ]);

      lines.push("");
      lines.push("On-chain validator state:");
      lines.push(`  isInitialized:    ${isInit}`);
      lines.push(`  passkeyCount:     ${count.toString()}`);
      lines.push(`  hasPasskey(local): ${hasIt}`);

      // 3) If hasPasskey, fetch the record to verify px/py match
      let matchPx: boolean | null = null;
      let matchPy: boolean | null = null;
      if (hasIt) {
        try {
          // getPasskeyRecord returns (px, py, signCounter, counterInitialized).
          // 4 outputs, not 5 — no leading id field.
          const record = (await client.readContract({
            address: validatorAddr,
            abi: ABIS.passkeyValidator,
            functionName: "getPasskeyRecord",
            args: [smartAccountAddress, credentialIdRaw],
          })) as readonly [bigint, bigint, number, boolean];
          const [onchainPx, onchainPy] = record;
          const localPxBig = BigInt(local.publicKeyX ?? "0x0");
          const localPyBig = BigInt(local.publicKeyY ?? "0x0");
          matchPx = localPxBig === onchainPx;
          matchPy = localPyBig === onchainPy;
          lines.push(`  px match:          ${matchPx ? "✅" : "❌"}`);
          lines.push(`  py match:          ${matchPy ? "✅" : "❌"}`);
        } catch (recErr) {
          lines.push(`  getPasskeyRecord error: ${(recErr as Error).message}`);
        }
      }

      // 4) Verdict
      lines.push("");
      if (hasIt && matchPx && matchPy) {
        lines.push("✅ AUTHORITATIVE — this passkey can sign UserOps for this wallet.");
      } else if (hasIt) {
        lines.push("⚠️  Credential ID is registered but public-key bytes differ. This shouldn't happen — possible data corruption.");
      } else {
        lines.push("❌ NOT authoritative — this credentialId is NOT registered on-chain.");
        lines.push("→ Trying to sign a UserOp will be rejected by the validator.");
        lines.push("→ Run guardian recovery to register the current passkey.");
      }

      Alert.alert("Passkey Authority Check", lines.join("\n"));
    } catch (err: any) {
      Alert.alert("Check Failed", err?.message ?? String(err));
    } finally {
      setCheckingPasskey(false);
    }
  }, [user?.id, smartAccountAddress, activeChainId, checkingPasskey]);

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
      console.warn("Supabase signOut failed (continuing locally):", error);
    }
    resetUser();
    setGuardNavigation(false);
    setConfirmVisible(false);
    navigation.reset({ index: 0, routes: [{ name: "AuthNavigation" }] });
    setIsSigningOut(false);
  }, [isSigningOut, navigation, resetUser, setGuardNavigation]);

  const settingsGroups: SettingsGroup[] = useMemo(
    () => [
      {
        title: "Account",
        items: [
          { label: "Edit Profile", icon: "user", tint: colors.accent, route: "ProfileEdit" },
          { label: LABELS.linkedDevices, icon: "smartphone", tint: colors.accentAlt, route: "DevicesPasskeys" },
          { label: "Backup & Recovery", icon: "shield", tint: colors.success, route: "BackupRecovery" },
          { label: LABELS.connectedDApps, icon: "link-2", tint: colors.success, route: "ConnectedDApps" },
          { label: "Contacts", icon: "book", tint: colors.warning, route: "ContactList" },
        ],
      },
      {
        title: "Preferences",
        items: [
          { label: "Notifications", icon: "bell", tint: colors.accentAlt, route: "NotificationSettings" },
          { label: "Browser Settings", icon: "globe", tint: colors.success, route: "BrowserSettings" },
          ...(__DEV__
            ? [
                {
                  label: "Dev Controls",
                  icon: "cpu" as FeatherIconName,
                  tint: colors.textMuted,
                  route: "DevCreateAccount" as keyof RootStackParamList,
                },
              ]
            : []),
        ],
      },
    ],
    [colors],
  );

  return (
    <TabScreenContainer includeBottomInset>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: contentBottomInset + 24 }}
      >
        {/* ── Hero ─────────────────────────────────────── */}
        <LinearGradient colors={gradients.profileHero} style={styles.hero}>
          <TouchableOpacity
            style={[styles.themeBtn, { backgroundColor: colors.glass, borderColor: colors.border }]}
            onPress={handleToggleTheme}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Toggle theme"
          >
            <Feather
              name={resolvedMode === "dark" ? "sun" : "moon"}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("ProfileEdit")}
            activeOpacity={0.85}
            style={styles.avatarTouchable}
          >
            <View style={[styles.avatarRing, { borderColor: `${colors.accent}4D` }]}>
              <Avatar size={84} uri={avatarUri} label={displayName} />
            </View>
            <View style={[styles.cameraChip, { backgroundColor: colors.accent }]}>
              <Feather name="camera" size={11} color={colors.textOnAccent} />
            </View>
          </TouchableOpacity>

          <Text style={[styles.heroName, { color: colors.textPrimary }]}>{displayName}</Text>
          <Text style={[styles.heroEmail, { color: colors.textSecondary }]}>
            {user?.email ?? "wallet@trezo.app"}
          </Text>

          <View style={styles.pillRow}>
            {user?.email_confirmed_at ? (
              <View style={[styles.pill, { backgroundColor: `${colors.success}1A`, borderColor: `${colors.success}33` }]}>
                <Feather name="check-circle" size={11} color={colors.success} />
                <Text style={[styles.pillText, { color: colors.success }]}>Verified</Text>
              </View>
            ) : null}
            {smartAccountDeployed ? (
              <View style={[styles.pill, { backgroundColor: `${colors.accent}1A`, borderColor: `${colors.accent}33` }]}>
                <Feather name="shield" size={11} color={colors.accent} />
                <Text style={[styles.pillText, { color: colors.accent }]}>Protected</Text>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        {/* ── Settings ─────────────────────────────────── */}
        <View style={styles.body}>
          {/* Sticky Recovery Attempt banner — no RPC, visible whenever an Attempt is active */}
          <RecoveryAttemptBanner smartAccountAddress={smartAccountAddress as Address | undefined} sticky />
          {settingsGroups.map((group) => (
            <View key={group.title} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                {group.title.toUpperCase()}
              </Text>
              <View style={[styles.card, { backgroundColor: colors.surfaceCard, borderColor: colors.border }]}>
                {group.items.map((item, idx) => (
                  <TouchableOpacity
                    key={item.label}
                    style={[
                      styles.row,
                      idx < group.items.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.borderMuted,
                      },
                    ]}
                    onPress={() => item.route && navigation.navigate(item.route as never)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconWrap, { backgroundColor: `${item.tint}1A` }]}>
                      <Feather name={item.icon} size={17} color={item.tint} />
                    </View>
                    <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                    <Feather name="chevron-right" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* ── DEV: Check Passkey Authority ──────────── */}
          {__DEV__ && (
            <TouchableOpacity
              style={[
                styles.signOutBtn,
                { backgroundColor: `${colors.accent}1A`, borderColor: `${colors.accent}40` },
              ]}
              onPress={() => void handleCheckPasskeyAuthority()}
              disabled={checkingPasskey}
              activeOpacity={0.8}
            >
              {checkingPasskey ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <View style={[styles.signOutIconWrap, { backgroundColor: `${colors.accent}1A` }]}>
                    <Feather name="key" size={16} color={colors.accent} />
                  </View>
                  <Text style={[styles.signOutLabel, { color: colors.accent }]}>
                    Check Passkey Authority
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* ── My wallet is compromised ──────────────── */}
          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}33` }]}
            onPress={() => navigation.navigate("CompromisedWallet")}
            activeOpacity={0.8}
          >
            <View style={[styles.signOutIconWrap, { backgroundColor: `${colors.danger}1A` }]}>
              <Feather name="alert-octagon" size={16} color={colors.danger} />
            </View>
            <Text style={[styles.signOutLabel, { color: colors.danger }]}>{LABELS.compromiseRowTitle}</Text>
          </TouchableOpacity>

          {/* ── Sign Out ──────────────────────────────── */}
          <TouchableOpacity
            style={[styles.signOutBtn, { backgroundColor: colors.dangerSoft, borderColor: `${colors.danger}33` }]}
            onPress={() => setConfirmVisible(true)}
            disabled={isSigningOut}
            activeOpacity={0.8}
          >
            {isSigningOut ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <>
                <View style={[styles.signOutIconWrap, { backgroundColor: `${colors.danger}1A` }]}>
                  <Feather name="log-out" size={16} color={colors.danger} />
                </View>
                <Text style={[styles.signOutLabel, { color: colors.danger }]}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={[styles.versionText, { color: colors.textMuted }]}>Trezo Wallet · v1.0.0</Text>
        </View>
      </ScrollView>

      {/* ── Confirm Modal ────────────────────────────── */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!isSigningOut) setConfirmVisible(false); }}
      >
        <View style={styles.overlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceCard, borderColor: `${colors.danger}26` }]}>
            <View style={[styles.modalIconBadge, { backgroundColor: colors.dangerSoft }]}>
              <Feather name="log-out" size={28} color={colors.danger} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Sign out of Trezo?</Text>
            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
              {"You'll need to verify your identity again to access your wallet."}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.glass, borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setConfirmVisible(false)}
                disabled={isSigningOut}
                activeOpacity={0.8}
              >
                <Text style={[styles.modalBtnText, { color: colors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.danger, opacity: isSigningOut ? 0.6 : 1 }]}
                onPress={executeSignOut}
                disabled={isSigningOut}
                activeOpacity={0.8}
              >
                {isSigningOut ? (
                  <ActivityIndicator size="small" color={colors.textOnAccent} />
                ) : (
                  <Text style={[styles.modalBtnText, { color: colors.textOnAccent }]}>Sign out</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TabScreenContainer>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    hero: {
      paddingTop: 56,
      paddingBottom: 40,
      paddingHorizontal: 24,
      alignItems: "center",
      gap: 6,
      position: "relative",
    },
    themeBtn: {
      position: "absolute",
      top: 16,
      right: 20,
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
    },
    avatarTouchable: {
      position: "relative",
      marginBottom: 8,
    },
    avatarRing: {
      borderWidth: 2.5,
      borderRadius: 50,
      padding: 3,
    },
    cameraChip: {
      position: "absolute",
      bottom: 4,
      right: 4,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    heroName: {
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: -0.5,
      marginTop: 4,
    },
    heroEmail: {
      fontSize: 13,
      fontWeight: "500",
      marginTop: 2,
    },
    pillRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
    },
    pillText: {
      fontSize: 12,
      fontWeight: "700",
    },
    body: {
      paddingHorizontal: 20,
      paddingTop: 28,
      gap: 20,
    },
    section: {
      gap: 8,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginLeft: 4,
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 14,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
    },
    signOutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 15,
      borderRadius: 18,
      borderWidth: 1,
    },
    signOutIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    signOutLabel: {
      fontSize: 15,
      fontWeight: "700",
    },
    versionText: {
      textAlign: "center",
      fontSize: 12,
      fontWeight: "500",
      paddingBottom: 4,
    },
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 24,
    },
    modalCard: {
      width: "100%",
      borderRadius: 28,
      borderWidth: 1,
      paddingVertical: 32,
      paddingHorizontal: 24,
      alignItems: "center",
      gap: 12,
    },
    modalIconBadge: {
      width: 68,
      height: 68,
      borderRadius: 34,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    modalTitle: {
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    modalBody: {
      fontSize: 14,
      textAlign: "center",
      lineHeight: 21,
      opacity: 0.85,
    },
    modalActions: {
      flexDirection: "row",
      gap: 10,
      width: "100%",
      marginTop: 8,
    },
    modalBtn: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    modalBtnText: {
      fontSize: 15,
      fontWeight: "700",
    },
  });

export default ProfileScreen;
