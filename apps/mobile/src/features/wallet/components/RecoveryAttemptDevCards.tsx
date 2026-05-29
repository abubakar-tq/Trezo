/**
 * DEV-only cards for the DevCreateAccountScreen.
 * All three are gated behind __DEV__ at the call-site in DevCreateAccountScreen.
 */
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { Address, Hex } from "viem";

import { getSupabaseClient } from "@lib/supabase";
import { useUserStore } from "@store/useUserStore";
import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import { EmailRecoveryGroupService } from "@/src/features/wallet/services/EmailRecoveryGroupService";
import { useAppTheme } from "@theme";

// ─── Force Complete card ──────────────────────────────────────────────────────

export function ForceCompleteCard() {
  const { theme } = useAppTheme();
  const [attemptId, setAttemptId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleForceComplete = async () => {
    if (!attemptId.trim()) {
      Alert.alert("Enter an attempt ID");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: group, error } = await supabase
        .from("email_recovery_groups")
        .select("smart_account_address, recovery_data, chain_ids, email_recovery_chain_requests(email_recovery_module, chain_id)")
        .eq("id", attemptId.trim())
        .single();
      if (error || !group) throw new Error(error?.message ?? "Attempt not found");

      const chainReqs = (group as any).email_recovery_chain_requests as Array<{ email_recovery_module: string; chain_id: number }> ?? [];
      const adapter = EmailRecoveryGroupService.createRelayer();

      for (const req of chainReqs) {
        const result = await adapter.completeRecovery({
          chainId: req.chain_id,
          smartAccountAddress: group.smart_account_address as Address,
          recoveryData: group.recovery_data as Hex,
          emailRecoveryModuleAddress: req.email_recovery_module as Address,
        });
        if (result.txHash) {
          Alert.alert("Submitted", `txHash: ${result.txHash}`);
        } else if (!result.success) {
          Alert.alert("Failed", result.error ?? "Unknown error");
        }
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.border }]}>
      <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Force Complete</Text>
      <Text style={[styles.cardDesc, { color: theme.colors.textMuted }]}>
        Directly calls completeRecovery for an attempt ID. Use when auto-execute couldn't fire.
      </Text>
      <TextInput
        style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.border }]}
        placeholder="Attempt UUID"
        placeholderTextColor={theme.colors.textMuted}
        value={attemptId}
        onChangeText={setAttemptId}
        autoCapitalize="none"
      />
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: theme.colors.accentAlt }]}
        onPress={() => void handleForceComplete()}
        disabled={loading}
      >
        {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnLabel}>Force complete</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Clear Stale Rows card ────────────────────────────────────────────────────

export function ClearStaleRecoveryRowsCard() {
  const { theme } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const smartAccountAddress = useUserStore((s) => s.smartAccountAddress);

  const handleClear = async () => {
    if (!smartAccountAddress) {
      Alert.alert("No smart account address found");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: rows } = await supabase
        .from("email_recovery_groups")
        .select("id")
        .eq("smart_account_address", smartAccountAddress.toLowerCase())
        .is("deleted_at", null)
        .is("executed_at", null);

      if (!rows?.length) {
        Alert.alert("Nothing to clear", "No active Recovery Attempt rows found.");
        return;
      }

      await supabase
        .from("email_recovery_groups")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", rows.map((r) => r.id));

      Alert.alert("Cleared", `Soft-deleted ${rows.length} row(s).`);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.border }]}>
      <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Clear Stale Rows</Text>
      <Text style={[styles.cardDesc, { color: theme.colors.textMuted }]}>
        Soft-deletes all active Recovery Attempt rows for this account. Does not touch on-chain state.
      </Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: theme.colors.danger }]}
        onPress={() => void handleClear()}
        disabled={loading}
      >
        {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnLabel}>Delete all Attempts for this account</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Relayer Health card ──────────────────────────────────────────────────────

export function RelayerHealthCard() {
  const { theme } = useAppTheme();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balanceEth, setBalanceEth] = useState<string | null>(null);
  const LOW_BALANCE_THRESHOLD_ETH = 0.001;

  const handleCheck = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke("submit-recovery-operation", {
        body: { action: "whoami" },
      });
      if (error) throw error;
      setAddress(data.relayerAddress ?? null);
      if (data.relayerBalanceWei) {
        const eth = Number(data.relayerBalanceWei) / 1e18;
        setBalanceEth(eth.toFixed(6));
      }
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const isLow = balanceEth !== null && Number(balanceEth) < LOW_BALANCE_THRESHOLD_ETH;

  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surfaceCard, borderColor: theme.colors.border }]}>
      <Text style={[styles.cardTitle, { color: theme.colors.textPrimary }]}>Relayer Health</Text>
      <Text style={[styles.cardDesc, { color: theme.colors.textMuted }]}>
        Shows the server EOA address + Base Sepolia balance used for cancel-expired-email-recovery.
      </Text>
      {address && (
        <Text style={[styles.mono, { color: theme.colors.textPrimary }]}>{address}</Text>
      )}
      {balanceEth && (
        <Text style={[styles.balance, { color: isLow ? theme.colors.danger : theme.colors.success }]}>
          {isLow ? "⚠ " : ""}Balance: {balanceEth} ETH{isLow ? " — fund before testing cancel-expired" : ""}
        </Text>
      )}
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: theme.colors.accent }]}
        onPress={() => void handleCheck()}
        disabled={loading}
      >
        {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.btnLabel}>Check relayer health</Text>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  btn: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnLabel: { color: "#fff", fontWeight: "600", fontSize: 14 },
  mono: { fontSize: 11, fontFamily: "monospace" },
  balance: { fontSize: 13, fontWeight: "500" },
});
