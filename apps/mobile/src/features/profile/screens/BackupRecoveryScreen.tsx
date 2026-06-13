import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { EmailRecoveryService } from "@/src/features/wallet/services/EmailRecoveryService";
import { getRecoveryRequestService } from "@/src/features/wallet/services/RecoveryRequestService";
import { SocialRecoveryService } from "@/src/features/wallet/services/SocialRecoveryService";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { DEFAULT_CHAIN_ID, type SupportedChainId } from "@/src/integration/chains";
import { RootStackParamList } from "@/src/types/navigation";
import { useUserStore } from "@store/useUserStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import type { Address } from "viem";

// ─── Types ────────────────────────────────────────────────────────────────────

type MethodState = boolean | null; // true = on, false = off, null = checking

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SegmentBarProps {
  states: [MethodState, MethodState, MethodState];
  activeCount?: number;
  colors: ThemeColors;
}

const SegmentBar: React.FC<SegmentBarProps> = ({ states, activeCount: activeCountProp, colors }) => {
  const activeCount = activeCountProp ?? states.filter((s) => s === true).length;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {states.map((s, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: s === true ? colors.accent : colors.borderMuted,
            }}
          />
        ))}
      </View>
      <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: "500" }}>
        {activeCount} of 3 methods active
      </Text>
    </View>
  );
};

interface StatusBadgeProps {
  state: MethodState;
  colors: ThemeColors;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ state, colors }) => {
  if (state === null) {
    return <ActivityIndicator size="small" color={colors.textMuted} />;
  }
  if (state === true) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.textMuted,
          }}
        />
      </View>
    );
  }
  // off — amber "Set up"
  return (
    <Text style={{ color: colors.warning, fontSize: 13, fontWeight: "600" }}>
      Set up
    </Text>
  );
};

interface MethodRowProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  description: string;
  state: MethodState;
  onPress: () => void;
  isLast?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

const MethodRow: React.FC<MethodRowProps> = ({
  icon,
  label,
  description,
  state,
  onPress,
  isLast,
  colors,
  styles,
}) => (
  <>
    <TouchableOpacity style={styles.optionRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.optionInfo}>
        <View style={[styles.iconBadge, { backgroundColor: colors.accentSoft }]}>
          <Feather name={icon} size={20} color={colors.accent} />
        </View>
        <View style={styles.optionText}>
          <Text style={styles.optionLabel}>{label}</Text>
          <Text style={styles.optionDesc}>{description}</Text>
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <StatusBadge state={state} colors={colors} />
        <Feather name="chevron-right" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
    {!isLast && <View style={styles.divider} />}
  </>
);

interface ActivityRowProps {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
  isLast?: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

const ActivityRow: React.FC<ActivityRowProps> = ({
  icon,
  label,
  onPress,
  isLast,
  colors,
  styles,
}) => (
  <>
    <TouchableOpacity style={styles.optionRow} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.optionInfo}>
        <View style={[styles.iconBadge, { backgroundColor: colors.surfaceMuted }]}>
          <Feather name={icon} size={20} color={colors.textSecondary} />
        </View>
        <Text style={styles.optionLabel}>{label}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
    {!isLast && <View style={styles.divider} />}
  </>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

const BackupRecoveryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const user = useUserStore((state) => state.user);
  const storedSmartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const smartAccountDeployed = useUserStore((state) => state.smartAccountDeployed);
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const activeChainId = useWalletStore((state) => state.activeChainId);

  const smartAccountAddress = useMemo<Address | undefined>(() => {
    const addr = aaAccount?.predictedAddress ?? storedSmartAccountAddress ?? undefined;
    return addr ? (addr as Address) : undefined;
  }, [aaAccount?.predictedAddress, storedSmartAccountAddress]);

  const isAccountDeployed = Boolean(aaAccount?.isDeployed ?? smartAccountDeployed ?? false);

  const resolvedChainId = useMemo<SupportedChainId>(
    () => (aaAccount?.chainId ?? activeChainId ?? DEFAULT_CHAIN_ID) as SupportedChainId,
    [aaAccount?.chainId, activeChainId],
  );

  const smartAccountReady = Boolean(smartAccountAddress && isAccountDeployed);

  // null = checking, true/false = known
  const [guardiansOn, setGuardiansOn] = useState<MethodState>(null);
  const [emailOn, setEmailOn] = useState<MethodState>(null);
  // Linked devices: always on
  const linkedDevicesOn: MethodState = true;

  useEffect(() => {
    if (!smartAccountReady || !smartAccountAddress) {
      // Account not deployed — show "Set up" badges instead of permanent spinners
      setGuardiansOn(false);
      setEmailOn(false);
      return;
    }

    let cancelled = false;

    const checkModules = async () => {
      const [guardianResult, emailResult] = await Promise.allSettled([
        SocialRecoveryService.isModuleInstalled(smartAccountAddress, resolvedChainId),
        EmailRecoveryService.isModuleInstalled(smartAccountAddress, resolvedChainId),
      ]);

      if (cancelled) return;

      setGuardiansOn(
        guardianResult.status === "fulfilled" ? guardianResult.value : null,
      );
      setEmailOn(
        emailResult.status === "fulfilled" ? emailResult.value : null,
      );
    };

    void checkModules();

    return () => {
      cancelled = true;
    };
  }, [smartAccountAddress, smartAccountReady, resolvedChainId]);

  const activeCount = [guardiansOn, emailOn, linkedDevicesOn].filter(
    (s) => s === true,
  ).length;

  const headline =
    activeCount >= 2
      ? "Your wallet is recoverable"
      : activeCount === 1
        ? "Improve your recovery coverage"
        : "Set up recovery to protect your wallet";

  const headlineColor =
    activeCount >= 2 ? colors.textMuted : colors.warning;

  const methodStates: [MethodState, MethodState, MethodState] = [
    guardiansOn,
    emailOn,
    linkedDevicesOn,
  ];

  const handleRecoveryStatusPress = useCallback(async () => {
    if (!user) {
      navigation.navigate("RecoveryEntry");
      return;
    }
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timed out")), 4000),
      );
      const activeRequest = await Promise.race([
        getRecoveryRequestService().getLatestActiveRecoveryRequestForUser(
          user.id,
          smartAccountAddress,
        ),
        timeoutPromise,
      ]);
      if (activeRequest) {
        navigation.navigate("RecoveryProgress", { requestId: activeRequest.id });
      } else {
        Alert.alert("No active recovery", "There is no recovery in progress for your wallet.");
      }
    } catch {
      navigation.navigate("RecoveryEntry");
    }
  }, [user, smartAccountAddress, navigation]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recovery & Backup</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Summary card ──────────────────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <SegmentBar states={methodStates} activeCount={activeCount} colors={colors} />
          <Text style={[styles.headline, { color: headlineColor }]}>
            {headline}
          </Text>
        </View>

        {/* ── Recovery Methods ──────────────────────────────────────────── */}
        <Text style={styles.sectionHeader}>RECOVERY METHODS</Text>
        <View style={styles.card}>
          <MethodRow
            icon="shield"
            label="Guardians"
            description="On-chain guardian recovery via social recovery module"
            state={guardiansOn}
            onPress={() => navigation.navigate("GuardianRecovery")}
            colors={colors}
            styles={styles}
          />
          <MethodRow
            icon="mail"
            label="Email Recovery"
            description="Recover your wallet via trusted email guardians"
            state={emailOn}
            onPress={() => navigation.navigate("EmailRecovery")}
            colors={colors}
            styles={styles}
          />
          <MethodRow
            icon="smartphone"
            label="Linked Devices"
            description="A paired device always provides recovery access"
            state={linkedDevicesOn}
            onPress={() => navigation.navigate("DevicesPasskeys")}
            isLast
            colors={colors}
            styles={styles}
          />
        </View>

        {/* ── Activity ──────────────────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>ACTIVITY</Text>
        <View style={styles.card}>
          <ActivityRow
            icon="clock"
            label="Recovery Status"
            onPress={() => { void handleRecoveryStatusPress(); }}
            colors={colors}
            styles={styles}
          />
          <ActivityRow
            icon="inbox"
            label="Incoming Approvals"
            onPress={() => navigation.navigate("IncomingRecoveryApprovals")}
            isLast
            colors={colors}
            styles={styles}
          />
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: 60,
      paddingBottom: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "600",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    summaryCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      padding: 20,
      marginBottom: 28,
      gap: 12,
    },
    headline: {
      fontSize: 15,
      fontWeight: "600",
    },
    sectionHeader: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.8,
      marginBottom: 12,
      marginLeft: 4,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderMuted,
      overflow: "hidden",
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 18,
    },
    optionInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      flex: 1,
    },
    iconBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionText: {
      flex: 1,
    },
    optionLabel: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    optionDesc: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 3,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderMuted,
      marginHorizontal: 18,
    },
  });

export default BackupRecoveryScreen;
