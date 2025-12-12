import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { useRecoveryStatusStore } from "@store/useRecoveryStatusStore";
import type { Guardian } from "@store/useRecoveryStatusStore";
import { GuardianSyncService } from "../services/GuardianSyncService";
import { useUserStore } from "@store/useUserStore";

const GuardianRecoveryScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const { user } = useUserStore();
  const { guardians: storedGuardians, requiredSignatures, totalGuardians, setGuardians, clearGuardians } = useRecoveryStatusStore();

  const defaultN = 3;
  const [mValue, setMValue] = useState(storedGuardians.length > 0 ? requiredSignatures.toString() : "2");
  const [nValue, setNValue] = useState(storedGuardians.length > 0 ? totalGuardians.toString() : "3");
  const [guardianAddresses, setGuardianAddresses] = useState<string[]>(() => {
    if (storedGuardians.length > 0) {
      return storedGuardians.map((g) => g.address);
    }
    return Array(defaultN).fill("");
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<"form" | "list">(
    storedGuardians.length > 0 ? "list" : "form"
  );
  const [syncStatus, setSyncStatus] = useState<{
    hasAAWallet: boolean;
    isSynced: boolean;
    localGuardians: number;
    dbGuardians: number;
  } | null>(null);

  // Check sync status on mount
  useEffect(() => {
    const checkSync = async () => {
      if (!user?.id) return;
      const status = await GuardianSyncService.getSyncStatus(user.id);
      setSyncStatus(status);
    };
    checkSync();
  }, [user?.id]);

  const handleMNChange = useCallback(
    (field: "m" | "n", value: string) => {
      const numValue = parseInt(value) || 0;
      if (field === "m") {
        setMValue(value);
      } else {
        setNValue(value);
        setGuardianAddresses((current) => {
          if (numValue > current.length) {
            return [...current, ...Array(numValue - current.length).fill("")];
          }
          return current.slice(0, numValue || 0);
        });
      }
    },
    []
  );

  const handleAddressChange = useCallback((index: number, value: string) => {
    setGuardianAddresses((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const m = parseInt(mValue);
    const n = parseInt(nValue);

    if (!m || !n || m > n) {
      Alert.alert("Invalid Configuration", "M must be less than or equal to N");
      return;
    }

    const filledAddresses = guardianAddresses.filter((addr) => addr.trim());
    if (filledAddresses.length !== n) {
      Alert.alert("Incomplete", `Please enter all ${n} guardian addresses`);
      return;
    }

    if (!user?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    setIsSubmitting(true);

    // Save guardians locally
    const newGuardians: Guardian[] = guardianAddresses.map((addr, idx) => ({
      id: `guardian-${Date.now()}-${idx}`,
      address: addr,
    }));

    setGuardians(newGuardians, m, n);

    // Try to sync to database
    const syncResult = await GuardianSyncService.syncGuardiansToDatabase(user.id);
    
    setIsSubmitting(false);

    if (syncResult.success) {
      Alert.alert("Success", "Guardians saved and synced to database!");
      // Refresh sync status
      const status = await GuardianSyncService.getSyncStatus(user.id);
      setSyncStatus(status);
    } else if (syncResult.error === 'AA_WALLET_NOT_DEPLOYED') {
      Alert.alert(
        "Saved Locally",
        "Guardians saved locally. Deploy your Smart Account to enable on-chain recovery.",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert(
        "Partially Saved",
        "Guardians saved locally but failed to sync to database. You can sync manually later.",
        [{ text: "OK" }]
      );
    }

    setViewMode("list");
  }, [mValue, nValue, guardianAddresses, setGuardians, user?.id]);

  const handleSyncNow = useCallback(async () => {
    if (!user?.id) return;
    
    setIsSyncing(true);
    const result = await GuardianSyncService.syncGuardiansToDatabase(user.id);
    setIsSyncing(false);

    if (result.success) {
      Alert.alert("Success", "Guardians synced to database!");
      // Refresh sync status
      const status = await GuardianSyncService.getSyncStatus(user.id);
      setSyncStatus(status);
    } else if (result.error === 'AA_WALLET_NOT_DEPLOYED') {
      Alert.alert(
        "AA Wallet Required",
        "Please deploy your Smart Account first to enable on-chain guardian recovery.",
        [{ text: "OK" }]
      );
    } else {
      Alert.alert("Sync Failed", "Failed to sync guardians to database. Please try again later.");
    }
  }, [user?.id]);

  const handleRemoveGuardian = useCallback((id: string) => {
    Alert.alert("Remove Guardian", "Are you sure you want to remove this guardian?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const updated = storedGuardians.filter((g) => g.id !== id);
          if (updated.length === 0) {
            clearGuardians();
            setViewMode("form");
            setGuardianAddresses(Array(defaultN).fill(""));
            setMValue("2");
            setNValue("3");
          } else {
            setGuardians(updated, parseInt(mValue), updated.length);
          }
        },
      },
    ]);
  }, [storedGuardians, mValue, setGuardians, clearGuardians]);

  const handleEditGuardians = useCallback(() => {
    setNValue(storedGuardians.length.toString());
    setGuardianAddresses(storedGuardians.map((g) => g.address));
    setViewMode("form");
  }, [storedGuardians]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Guardian Recovery</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === "form" && (
          <View style={styles.configCard}>
            <View style={styles.configHeader}>
              <Text style={styles.configTitle}>Configure Guardians</Text>
            </View>

            <Text style={styles.configDesc}>
              Set up M-of-N guardian recovery. M guardians out of N total must approve to recover
              your wallet.
            </Text>

            <View style={styles.mnContainer}>
              <View style={styles.mnInputGroup}>
                <Text style={styles.mnLabel}>Required (M)</Text>
                <TextInput
                  style={styles.mnInput}
                  value={mValue}
                  onChangeText={(val) => handleMNChange("m", val)}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <Text style={styles.mnDivider}>of</Text>

              <View style={styles.mnInputGroup}>
                <Text style={styles.mnLabel}>Total (N)</Text>
                <TextInput
                  style={styles.mnInput}
                  value={nValue}
                  onChangeText={(val) => handleMNChange("n", val)}
                  keyboardType="number-pad"
                  maxLength={2}
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.addressesContainer}>
              <Text style={styles.addressesLabel}>Guardian Addresses</Text>
              {guardianAddresses.map((address, index) => (
                <View key={index} style={styles.addressInputWrapper}>
                  <Text style={styles.addressIndex}>{index + 1}</Text>
                  <TextInput
                    style={styles.addressInput}
                    value={address}
                    onChangeText={(val) => handleAddressChange(index, val)}
                    placeholder={`0x... (Guardian ${index + 1})`}
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitButtonText}>Save Guardians</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {viewMode === "list" && (
          <View style={styles.existingCard}>
            <View style={styles.existingHeader}>
              <Text style={styles.existingTitle}>Current Guardians</Text>
              <TouchableOpacity onPress={handleEditGuardians}>
                <Text style={styles.editButton}>Edit</Text>
              </TouchableOpacity>
            </View>

            {/* Sync Status Indicator */}
            {syncStatus && (
              <View style={[
                styles.syncStatusContainer,
                !syncStatus.hasAAWallet ? styles.syncStatusWarning :
                !syncStatus.isSynced ? styles.syncStatusNeedSync :
                styles.syncStatusSynced
              ]}>
                <Feather 
                  name={
                    !syncStatus.hasAAWallet ? "alert-circle" :
                    !syncStatus.isSynced ? "upload-cloud" :
                    "check-circle"
                  } 
                  size={16} 
                  color={
                    !syncStatus.hasAAWallet ? colors.warning :
                    !syncStatus.isSynced ? colors.accentAlt :
                    colors.success
                  } 
                />
                <Text style={styles.syncStatusText}>
                  {!syncStatus.hasAAWallet 
                    ? "Saved locally only • Deploy AA wallet to enable recovery"
                    : !syncStatus.isSynced
                    ? "Not synced to database"
                    : "Synced ✓"}
                </Text>
                {syncStatus.hasAAWallet && !syncStatus.isSynced && (
                  <TouchableOpacity 
                    onPress={handleSyncNow}
                    disabled={isSyncing}
                    style={styles.syncButton}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color={colors.accentAlt} />
                    ) : (
                      <Text style={styles.syncButtonText}>Sync Now</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {storedGuardians.map((guardian, index) => (
              <View
                key={guardian.id}
                style={[
                  styles.guardianRow,
                  index < storedGuardians.length - 1 && styles.guardianRowBorder,
                ]}
              >
                <View style={styles.guardianInfo}>
                  <View style={styles.guardianBadge}>
                    <Text style={styles.guardianBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.guardianAddress} numberOfLines={1}>
                    {guardian.address}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveGuardian(guardian.id)}>
                  <Feather name="trash-2" size={18} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.guardianSummary}>
              <Feather name="info" size={16} color={colors.accentAlt} />
              <Text style={styles.guardianSummaryText}>
                {requiredSignatures} of {storedGuardians.length} guardians required for recovery
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.accentAlt} />
          <Text style={styles.loadingText}>Saving guardians…</Text>
        </View>
      )}
    </View>
  );
};

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
      fontWeight: "700",
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    configCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginTop: 8,
    },
    configHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    configTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    configDesc: {
      color: colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
    },
    mnContainer: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 20,
      marginBottom: 28,
    },
    mnInputGroup: {
      alignItems: "center",
      gap: 8,
    },
    mnLabel: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    mnInput: {
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      width: 80,
      height: 56,
      textAlign: "center",
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: "700",
    },
    mnDivider: {
      color: colors.textMuted,
      fontSize: 18,
      fontWeight: "600",
      marginBottom: 8,
    },
    addressesContainer: {
      gap: 12,
    },
    addressesLabel: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 4,
    },
    addressInputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    addressIndex: {
      color: colors.textMuted,
      fontSize: 15,
      fontWeight: "700",
      width: 24,
    },
    addressInput: {
      flex: 1,
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      color: colors.textPrimary,
      fontSize: 14,
      fontFamily: "monospace",
    },
    submitButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 16,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 24,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: "#ffffff",
      fontSize: 16,
      fontWeight: "700",
    },
    existingCard: {
      backgroundColor: colors.surfaceCard,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginTop: 8,
    },
    existingHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    existingTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    editButton: {
      color: colors.accentAlt,
      fontSize: 15,
      fontWeight: "600",
    },
    guardianRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 14,
    },
    guardianRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.borderMuted,
    },
    guardianInfo: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    guardianBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: withAlpha(colors.accentAlt, 0.15),
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.3),
      alignItems: "center",
      justifyContent: "center",
    },
    guardianBadgeText: {
      color: colors.accentAlt,
      fontSize: 14,
      fontWeight: "700",
    },
    guardianAddress: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: "monospace",
      flex: 1,
    },
    guardianSummary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: withAlpha(colors.accentAlt, 0.1),
      borderRadius: 12,
      padding: 14,
      marginTop: 16,
    },
    guardianSummaryText: {
      color: colors.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    syncStatusContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 12,
      padding: 14,
      marginBottom: 16,
    },
    syncStatusWarning: {
      backgroundColor: withAlpha(colors.warning, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.warning, 0.2),
    },
    syncStatusNeedSync: {
      backgroundColor: withAlpha(colors.accentAlt, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.accentAlt, 0.2),
    },
    syncStatusSynced: {
      backgroundColor: withAlpha(colors.success, 0.1),
      borderWidth: 1,
      borderColor: withAlpha(colors.success, 0.2),
    },
    syncStatusText: {
      color: colors.textSecondary,
      fontSize: 12,
      flex: 1,
      lineHeight: 16,
    },
    syncButton: {
      backgroundColor: colors.accentAlt,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      minWidth: 70,
      alignItems: "center",
    },
    syncButtonText: {
      color: "#ffffff",
      fontSize: 12,
      fontWeight: "600",
    },
    loadingOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: withAlpha(colors.background, 0.85),
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    loadingText: {
      color: colors.textPrimary,
      fontSize: 15,
      fontWeight: "600",
    },
  });

export default GuardianRecoveryScreen;
