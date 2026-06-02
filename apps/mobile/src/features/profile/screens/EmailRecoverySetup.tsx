import { Feather } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

import { DELAY_CHOICES, DEV_DELAY_CHOICES } from "../utils/recoveryLabels";

export interface EmailRecoverySetupProps {
  // Guardian config
  guardianCountValue: string;
  thresholdValue: string;
  visibleGuardianEmails: string[];
  hasDuplicateGuardians: boolean;
  guardianValidationError: string | null;
  onGuardianCountChange: (value: string) => void;
  onThresholdChange: (value: string) => void;
  onGuardianEmailChange: (index: number, value: string) => void;
  onDeleteGuardian: (index: number) => void;

  // Delay selection
  selectedDelaySeconds: number;
  onDelaySecondsChange: (seconds: number) => void;
  // Dev-only: reveal short (5m/30m/1h) delays for testing the execute step.
  showShortDelayOptions?: boolean;

  // Install
  smartAccountReady: boolean;
  canSubmitGuardianConfig: boolean;
  installingModule: boolean;
  moduleError: string | null;
  checkingModule: boolean;
  onInstall: () => void;
}

const EmailRecoverySetup: React.FC<EmailRecoverySetupProps> = ({
  guardianCountValue,
  thresholdValue,
  visibleGuardianEmails,
  hasDuplicateGuardians,
  guardianValidationError,
  onGuardianCountChange,
  onThresholdChange,
  onGuardianEmailChange,
  onDeleteGuardian,
  selectedDelaySeconds,
  onDelaySecondsChange,
  showShortDelayOptions = false,
  smartAccountReady,
  canSubmitGuardianConfig,
  installingModule,
  moduleError,
  checkingModule,
  onInstall,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <>
      {/* Intro text */}
      <Text style={styles.screenIntro}>
        Let trusted people help you regain access if you lose your device.
      </Text>

      {/* ── Guardians card ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Guardians</Text>
        <Text style={styles.cardDesc}>
          Each trusted contact gets an invitation and must confirm before recovery turns on.
        </Text>

        <View style={styles.inputRow}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Number of guardians</Text>
            <TextInput
              style={styles.numberInput}
              value={guardianCountValue}
              onChangeText={onGuardianCountChange}
              keyboardType="number-pad"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Approvals needed</Text>
            <TextInput
              style={styles.numberInput}
              value={thresholdValue}
              onChangeText={onThresholdChange}
              keyboardType="number-pad"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {hasDuplicateGuardians && (
          <Text style={[styles.summaryText, styles.summaryWarning]}>
            Duplicate emails detected
          </Text>
        )}
        {guardianValidationError ? (
          <View style={styles.validationBox}>
            <Text style={styles.validationText}>{guardianValidationError}</Text>
          </View>
        ) : null}

        {visibleGuardianEmails.map((email, index) => (
          <View key={`guardian-${index}`} style={styles.guardianRowContainer}>
            <View style={styles.guardianRow}>
              <View style={styles.guardianColumn}>
                <Text style={styles.inputLabel}>Guardian {index + 1}</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={(value) => onGuardianEmailChange(index, value)}
                  placeholder="guardian@example.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
              </View>
            </View>

            {visibleGuardianEmails.length > 1 && (
              <TouchableOpacity
                style={styles.deleteGuardianButton}
                onPress={() => onDeleteGuardian(index)}
                accessibilityRole="button"
                accessibilityLabel={`Remove guardian ${index + 1}`}
              >
                <Feather name="trash-2" size={20} color={theme.colors.danger} />
              </TouchableOpacity>
            )}
          </View>
        ))}

        {/* Add guardian button */}
        <TouchableOpacity
          style={styles.addGuardianBtn}
          onPress={() => onGuardianCountChange(String(visibleGuardianEmails.length + 1))}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={16} color={colors.accent} />
          <Text style={styles.addGuardianBtnText}>Add guardian</Text>
        </TouchableOpacity>
      </View>

      {/* ── Safety delay card ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Safety delay</Text>
        <Text style={styles.cardDesc}>
          After your guardians approve, this delay gives you time to cancel a
          fraudulent recovery before it completes.
        </Text>

        <View style={styles.delayChoicesRow}>
          {DELAY_CHOICES.map((choice) => (
            <TouchableOpacity
              key={choice.seconds}
              style={[
                styles.delayChip,
                selectedDelaySeconds === choice.seconds && styles.delayChipActive,
              ]}
              onPress={() => onDelaySecondsChange(choice.seconds)}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.delayChipLabel,
                  selectedDelaySeconds === choice.seconds && styles.delayChipLabelActive,
                ]}
              >
                {choice.label}
              </Text>
              {choice.note ? (
                <Text
                  style={[
                    styles.delayChipNote,
                    selectedDelaySeconds === choice.seconds && styles.delayChipNoteActive,
                  ]}
                >
                  {choice.note}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* Dev-only short delays — gated by the Dev Controls toggle. */}
        {showShortDelayOptions ? (
          <>
            <Text style={styles.devDelayLabel}>Short delays (testing only)</Text>
            <View style={styles.delayChoicesRow}>
              {DEV_DELAY_CHOICES.map((choice) => (
                <TouchableOpacity
                  key={choice.seconds}
                  style={[
                    styles.delayChip,
                    selectedDelaySeconds === choice.seconds && styles.delayChipActive,
                  ]}
                  onPress={() => onDelaySecondsChange(choice.seconds)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.delayChipLabel,
                      selectedDelaySeconds === choice.seconds && styles.delayChipLabelActive,
                    ]}
                  >
                    {choice.label}
                  </Text>
                  {choice.note ? (
                    <Text
                      style={[
                        styles.delayChipNote,
                        selectedDelaySeconds === choice.seconds && styles.delayChipNoteActive,
                      ]}
                    >
                      {choice.note}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : null}
      </View>

      {/* ── Activate card ── */}
      <View style={styles.card}>
        <View style={styles.moduleHeader}>
          <Text style={styles.cardTitle}>Activate Email Recovery</Text>
          {checkingModule && (
            <ActivityIndicator size="small" color={colors.textMuted} />
          )}
        </View>

        {moduleError && <Text style={styles.moduleError}>{moduleError}</Text>}
        {!smartAccountReady && (
          <Text style={styles.moduleHint}>
            Set up your wallet before enabling email recovery.
          </Text>
        )}

        <TouchableOpacity
          style={[
            styles.installButton,
            (!smartAccountReady || !canSubmitGuardianConfig || installingModule) &&
              styles.installButtonDisabled,
          ]}
          disabled={!smartAccountReady || !canSubmitGuardianConfig || installingModule}
          onPress={onInstall}
          activeOpacity={0.85}
        >
          {installingModule ? (
            <ActivityIndicator size="small" color={colors.textOnAccent} />
          ) : (
            <Text style={styles.installButtonText}>Turn on Email Recovery</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    screenIntro: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      paddingHorizontal: 4,
    },
    card: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 16,
      gap: 16,
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
    inputRow: {
      flexDirection: "row",
      gap: 12,
    },
    inputGroup: {
      flex: 1,
      gap: 6,
    },
    inputLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "500",
      marginLeft: 2,
    },
    numberInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
      textAlign: "center",
    },
    textInput: {
      backgroundColor: colors.inputBackground,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.borderMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.textPrimary,
      fontSize: 15,
    },
    summaryText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "500",
    },
    summaryWarning: {
      color: colors.warning,
    },
    validationBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.warningSoft,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    validationText: {
      color: colors.warning,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "600",
    },
    guardianRowContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    guardianRow: {
      flex: 1,
      flexDirection: "row",
      gap: 8,
      alignItems: "center",
    },
    guardianColumn: {
      flex: 1,
    },
    deleteGuardianButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.dangerSoft,
    },
    addGuardianBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 11,
      paddingHorizontal: 14,
      borderRadius: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
      alignSelf: "flex-start",
    },
    addGuardianBtnText: {
      color: colors.accent,
      fontSize: 14,
      fontWeight: "500",
    },
    delayChoicesRow: {
      flexDirection: "row",
      gap: 10,
    },
    devDelayLabel: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: "600",
    },
    delayChip: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: 8,
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.surfaceMuted,
    },
    delayChipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accentSoft,
    },
    delayChipLabel: {
      color: colors.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    delayChipLabelActive: {
      color: colors.accent,
    },
    delayChipNote: {
      color: colors.textMuted,
      fontSize: 11,
    },
    delayChipNoteActive: {
      color: colors.accent,
    },
    moduleHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
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
    installButton: {
      backgroundColor: colors.accent,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: "center",
    },
    installButtonDisabled: {
      opacity: 0.45,
    },
    installButtonText: {
      color: colors.textOnAccent,
      fontSize: 15,
      fontWeight: "600",
    },
  });

export default EmailRecoverySetup;
