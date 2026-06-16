import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Address } from "viem";

import { useActiveRecoveryAttemptId } from "@/src/features/wallet/hooks/useActiveRecoveryAttemptId";
import { useAppTheme } from "@theme";

interface RecoveryAttemptBannerProps {
  smartAccountAddress: Address | undefined | null;
  /** When true the banner cannot be dismissed (e.g. Profile sticky placement). */
  sticky?: boolean;
}

// ADR-0009: banner reads only Supabase — never pays an RPC call.
// See CONTEXT.md "RPC budget for chain reads".
export function RecoveryAttemptBanner({ smartAccountAddress, sticky = false }: RecoveryAttemptBannerProps) {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const navigation = useNavigation<any>();
  const { attemptId } = useActiveRecoveryAttemptId(smartAccountAddress ?? undefined);
  // Per-session dismiss (zustand overkill for one flag — plain ref is enough).
  const [dismissed, setDismissed] = useState(false);

  if (!attemptId || (!sticky && dismissed)) return null;

  return (
    <TouchableOpacity
      style={[styles.banner, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}
      onPress={() => navigation.navigate("RecoveryAttemptStatus", { attemptId })}
      activeOpacity={0.8}
    >
      <Feather name="refresh-cw" size={14} color={colors.accent} style={styles.icon} />
      <Text style={[styles.label, { color: colors.accent }]}>
        Recovery in progress — Tap to view
      </Text>
      {!sticky && (
        <TouchableOpacity
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          onPress={(e) => { e.stopPropagation(); setDismissed(true); }}
        >
          <Feather name="x" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  icon: { flexShrink: 0 },
  label: { flex: 1, fontSize: 13, fontWeight: "500" },
});
