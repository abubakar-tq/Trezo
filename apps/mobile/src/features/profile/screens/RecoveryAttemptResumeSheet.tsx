import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Address } from "viem";

import { getSupabaseClient } from "@lib/supabase";
import { EmailRecoveryGroupService } from "@/src/features/wallet/services/EmailRecoveryGroupService";
import { useActiveRecoveryAttemptId } from "@/src/features/wallet/hooks/useActiveRecoveryAttemptId";
import { useAppTheme } from "@theme";
import { TrezoBottomSheet } from "@shared/components/sheets/TrezoBottomSheet";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";

interface RecoveryAttemptResumeSheetProps {
  smartAccountAddress: Address;
  /** Called when the user chooses "Cancel and Start New" and cancellation finishes. */
  onProceedNew: () => void;
  /** Called when the user dismisses or chooses "Continue". */
  onDismiss: () => void;
}

// ADR-0011: the Resume sheet prevents duplicate Recovery Attempt rows when the
// dev-mode "Start Email Recovery" flow is used from a device that already has
// a passkey. In production, the new-device flow naturally arrives on a fresh
// device with no active Attempt, so this sheet won't fire.
export function RecoveryAttemptResumeSheet({
  smartAccountAddress,
  onProceedNew,
  onDismiss,
}: RecoveryAttemptResumeSheetProps) {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const navigation = useNavigation<any>();
  const sheetRef = useRef<BottomSheetModal>(null);
  const [cancelling, setCancelling] = useState(false);

  const { attemptId, loading } = useActiveRecoveryAttemptId(smartAccountAddress);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [maskedEmails, setMaskedEmails] = useState<string[]>([]);

  // Load metadata for the copy once we know the attemptId
  useEffect(() => {
    if (!attemptId) return;
    const supabase = getSupabaseClient();
    supabase
      .from("email_recovery_groups")
      .select("created_at, email_recovery_approvals(masked_email)")
      .eq("id", attemptId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setCreatedAt(data.created_at as string);
        setMaskedEmails(
          ((data as any).email_recovery_approvals ?? [])
            .map((a: any) => a.masked_email as string | null)
            .filter(Boolean),
        );
      });
  }, [attemptId]);

  // Present the sheet when we find an active Attempt
  useEffect(() => {
    if (!loading && attemptId) {
      sheetRef.current?.present();
    }
  }, [loading, attemptId]);

  const handleContinue = useCallback(() => {
    sheetRef.current?.dismiss();
    if (attemptId) navigation.navigate("RecoveryAttemptStatus", { attemptId });
    onDismiss();
  }, [attemptId, navigation, onDismiss]);

  const handleCancelAndNew = useCallback(async () => {
    if (!attemptId) return;
    setCancelling(true);
    try {
      await EmailRecoveryGroupService.cancelGroup(attemptId);
      sheetRef.current?.dismiss();
      onProceedNew();
    } catch {
      setCancelling(false);
    }
  }, [attemptId, onProceedNew]);

  if (loading || !attemptId) return null;

  const minutesAgo = createdAt
    ? Math.round((Date.now() - new Date(createdAt).getTime()) / 60_000)
    : null;
  const firstEmail = maskedEmails[0];

  return (
    <TrezoBottomSheet ref={sheetRef} snapPoints={["40%"]} onDismiss={onDismiss}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          Recovery Attempt in progress
        </Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          {minutesAgo !== null ? `Started ${minutesAgo} min ago` : "Already started"}
          {firstEmail ? `, awaiting ${firstEmail}` : ""}.
          {"\n"}Continue with it or cancel and start a new one.
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.accent }]}
          onPress={handleContinue}
        >
          <Text style={[styles.primaryBtnLabel, { color: colors.textOnAccent }]}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { borderColor: colors.danger }]}
          onPress={() => void handleCancelAndNew()}
          disabled={cancelling}
        >
          {cancelling
            ? <ActivityIndicator size="small" color={colors.danger} />
            : <Text style={[styles.secondaryBtnLabel, { color: colors.danger }]}>Cancel and Start New</Text>
          }
        </TouchableOpacity>
      </View>
    </TrezoBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  title: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 20 },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  primaryBtnLabel: { fontSize: 15, fontWeight: "600" },
  secondaryBtn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryBtnLabel: { fontSize: 15, fontWeight: "500" },
});
