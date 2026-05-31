import { Feather } from "@expo/vector-icons";
import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { LoadedEmailRecoveryMetadata } from "@/src/features/wallet/services/EmailRecoveryService";
import { RootStackParamList } from "@/src/types/navigation";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

import { approvalsSummary, delayLabel } from "../utils/recoveryLabels";

export interface EmailRecoveryManageProps {
  storedMetadata: LoadedEmailRecoveryMetadata | null;
  loadingStoredMetadata: boolean;
  moduleError: string | null;

  // Per-guardian actions
  resendingGuardianId: string | null;
  removingGuardianId: string | null;
  onResendInvite: (guardianId: string, maskedEmail: string) => void;
  onConfirmRemoveGuardian: (
    guardianId: string,
    maskedEmail: string,
    normalizedEmailEncrypted: string,
  ) => void;

  // Add post-install guardian
  newPostInstallEmail: string;
  onNewPostInstallEmailChange: (value: string) => void;
  addingPostInstallGuardian: boolean;
  onAddPostInstallGuardian: () => void;

  // Advanced weights
  visibleGuardianWeights: string[];
  onWeightChange: (index: number, value: string) => void;
}

const EmailRecoveryManage: React.FC<EmailRecoveryManageProps> = ({
  storedMetadata,
  loadingStoredMetadata,
  moduleError,
  resendingGuardianId,
  removingGuardianId,
  onResendInvite,
  onConfirmRemoveGuardian,
  newPostInstallEmail,
  onNewPostInstallEmailChange,
  addingPostInstallGuardian,
  onAddPostInstallGuardian,
  visibleGuardianWeights,
  onWeightChange,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const acceptedCount =
    storedMetadata?.guardians.filter((g) => g.acceptanceStatus === "accepted").length ?? 0;
  const totalCount = storedMetadata?.guardians.length ?? 0;
  const threshold = storedMetadata?.config.threshold ?? 0;
  const delaySeconds = storedMetadata?.config.delaySeconds ?? 0;

  return (
    <>
      {/* ── Summary card ── */}
      <View style={styles.card}>
        <View style={styles.summaryHeaderRow}>
          <View style={styles.statusChip}>
            <Feather name="check-circle" size={14} color={colors.success} />
            <Text style={[styles.statusChipText, { color: colors.success }]}>Active</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>Email Recovery</Text>
        <Text style={styles.cardDesc}>
          Your wallet is protected. Guardians can help you recover access if
          you lose your device.
        </Text>

        {storedMetadata && (
          <View style={styles.summaryRows}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Approvals needed</Text>
              <Text style={styles.summaryValue}>
                {approvalsSummary(threshold, totalCount)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Safety delay</Text>
              <Text style={styles.summaryValue}>{delayLabel(delaySeconds)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Guardians confirmed</Text>
              <Text style={styles.summaryValue}>
                {acceptedCount} of {totalCount}
              </Text>
            </View>
          </View>
        )}

        {moduleError && <Text style={styles.moduleError}>{moduleError}</Text>}
      </View>

      {/* ── Trusted contacts card ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Trusted contacts</Text>

        {__DEV__ && (
          <Text style={styles.moduleHint}>[DEV] Anvil: `make mock-accept-guardians-local`</Text>
        )}

        {loadingStoredMetadata && !storedMetadata ? (
          <ActivityIndicator size="small" color={colors.textMuted} />
        ) : storedMetadata ? (
          <>
            {storedMetadata.guardians.map((guardian) => {
              const confirmed = guardian.acceptanceStatus === "accepted";
              return (
                <View key={guardian.emailHash} style={styles.guardianStatusRow}>
                  <View style={styles.guardianInfo}>
                    <Text style={styles.guardianEmailText}>
                      {guardian.resolvedEmail ?? guardian.maskedEmail}
                      {guardian.isLocked ? " (locked)" : ""}
                    </Text>
                    <Text
                      style={[
                        styles.guardianStatusLabel,
                        { color: confirmed ? colors.success : colors.textMuted },
                      ]}
                    >
                      {confirmed ? "Confirmed" : "Invitation sent"}
                    </Text>
                  </View>
                  {!confirmed && !guardian.isLocked && (
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() =>
                        onResendInvite(guardian.id, guardian.maskedEmail)
                      }
                      disabled={resendingGuardianId === guardian.id}
                      accessibilityLabel={`Resend invite to ${guardian.maskedEmail}`}
                    >
                      {resendingGuardianId === guardian.id ? (
                        <ActivityIndicator size="small" color={colors.accentAlt} />
                      ) : (
                        <Feather name="refresh-cw" size={17} color={colors.accentAlt} />
                      )}
                    </TouchableOpacity>
                  )}
                  {!guardian.isLocked && (
                    <TouchableOpacity
                      style={styles.iconBtn}
                      onPress={() =>
                        onConfirmRemoveGuardian(
                          guardian.id,
                          guardian.maskedEmail,
                          guardian.normalizedEmailEncrypted,
                        )
                      }
                      disabled={removingGuardianId === guardian.id}
                      accessibilityLabel={`Remove ${guardian.maskedEmail}`}
                    >
                      {removingGuardianId === guardian.id ? (
                        <ActivityIndicator size="small" color={colors.danger} />
                      ) : (
                        <Feather name="trash-2" size={17} color={colors.danger} />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {/* Add guardian */}
            <View style={styles.addGuardianSection}>
              <TextInput
                style={styles.addPostInstallInput}
                value={newPostInstallEmail}
                onChangeText={onNewPostInstallEmailChange}
                placeholder="Add guardian email…"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!addingPostInstallGuardian}
              />
              <TouchableOpacity
                style={[
                  styles.addGuardianBtn,
                  (!newPostInstallEmail.trim() || addingPostInstallGuardian) &&
                    styles.installButtonDisabled,
                ]}
                onPress={onAddPostInstallGuardian}
                disabled={addingPostInstallGuardian || !newPostInstallEmail.trim()}
                activeOpacity={0.85}
              >
                {addingPostInstallGuardian ? (
                  <ActivityIndicator size="small" color={colors.accentAlt} />
                ) : (
                  <Feather name="plus" size={16} color={colors.accentAlt} />
                )}
                <Text style={styles.addGuardianBtnText}>
                  {addingPostInstallGuardian ? "Adding…" : "Add guardian"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        {/* Advanced — per-contact weights */}
        <TouchableOpacity
          style={styles.advancedToggleRow}
          onPress={() => setShowAdvanced((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={styles.advancedToggleLabel}>Advanced · per-contact weights</Text>
          <Feather
            name={showAdvanced ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textMuted}
          />
        </TouchableOpacity>

        {showAdvanced && storedMetadata && (
          <View style={styles.advancedSection}>
            <Text style={styles.moduleHint}>
              Each guardian's vote weight. Defaults are equal (1). Increase a
              guardian's weight to require fewer others to approve.
            </Text>
            {storedMetadata.guardians.map((guardian, index) => (
              <View key={guardian.emailHash} style={styles.weightRow}>
                <Text style={styles.weightLabel} numberOfLines={1}>
                  {guardian.resolvedEmail ?? guardian.maskedEmail}
                </Text>
                <TextInput
                  style={styles.weightInput}
                  value={visibleGuardianWeights[index] ?? "1"}
                  onChangeText={(value) => onWeightChange(index, value)}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                  placeholder="1"
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* ── Dev-only start recovery ── */}
      {__DEV__ && (
        <TouchableOpacity
          style={[styles.installButton, styles.startRecoveryButton]}
          onPress={() => navigation.navigate("EmailRecoveryStart")}
          activeOpacity={0.85}
        >
          <Text style={styles.installButtonText}>Start Email Recovery</Text>
        </TouchableOpacity>
      )}
    </>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 18,
      gap: 14,
    },
    summaryHeaderRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 20,
      backgroundColor: `${colors.success}15`,
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: "600",
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
    cardDesc: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    summaryRows: {
      gap: 10,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    summaryLabel: {
      color: colors.textSecondary,
      fontSize: 13,
    },
    summaryValue: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    moduleError: {
      color: colors.danger,
      fontSize: 13,
      lineHeight: 18,
    },
    moduleHint: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    guardianStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.borderMuted,
      gap: 8,
    },
    guardianInfo: {
      flex: 1,
      gap: 2,
    },
    guardianEmailText: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "500",
    },
    guardianStatusLabel: {
      fontSize: 12,
    },
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    addGuardianSection: {
      marginTop: 4,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderMuted,
      gap: 10,
    },
    addPostInstallInput: {
      backgroundColor: `${colors.textPrimary}08`,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 15,
    },
    addGuardianBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.accentAlt}50`,
      backgroundColor: `${colors.accentAlt}0E`,
      alignSelf: "flex-start",
    },
    addGuardianBtnText: {
      color: colors.accentAlt,
      fontSize: 14,
      fontWeight: "500",
    },
    installButtonDisabled: {
      opacity: 0.45,
    },
    advancedToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderMuted,
    },
    advancedToggleLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "500",
    },
    advancedSection: {
      gap: 10,
    },
    weightRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    weightLabel: {
      flex: 1,
      color: colors.textSecondary,
      fontSize: 13,
    },
    weightInput: {
      width: 62,
      backgroundColor: `${colors.textPrimary}08`,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 10,
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      textAlign: "center",
    },
    installButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center",
    },
    startRecoveryButton: {
      backgroundColor: colors.success,
    },
    installButtonText: {
      color: colors.textOnAccent,
      fontSize: 15,
      fontWeight: "600",
    },
  });

export default EmailRecoveryManage;
