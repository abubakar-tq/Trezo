import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { TabScreenContainer } from "@shared/components";
import React, { useState, useMemo } from "react";
import { 
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View, 
  Switch, 
  Alert, 
  ActivityIndicator 
} from "react-native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { useWalletStore, type PasskeyInfo } from "@/src/features/wallet/store/useWalletStore";
import { useUserStore } from "@store/useUserStore";
import PasskeyService from "@/src/features/wallet/services/PasskeyService";
import { PasskeyAccountService } from "@/src/features/wallet/services/PasskeyAccountService";
import { DEFAULT_CHAIN_ID } from "@/src/integration/chains";
import type { Hex, Address } from "viem";

const SecurityPrivacyScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;

  const user = useUserStore((state) => state.user);
  const smartAccountAddress = useUserStore((state) => state.smartAccountAddress);
  const { passkeys, setPasskeys, addPasskey, removePasskey, aaAccount, activeChainId } = useWalletStore();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [currentDevicePasskeyId, setCurrentDevicePasskeyId] = useState<string | null>(null);

  const [biometricsEnabled, setBiometricsEnabled] = React.useState(true);

  // Fetch all passkeys from Supabase on mount
  React.useEffect(() => {
    const loadPasskeys = async () => {
      if (!user?.id) return;
      
      try {
        setIsFetching(true);
        
        // 1. Get current device passkey from local storage
        const localMetadata = await PasskeyService.getPasskey(user.id);
        if (localMetadata) {
          setCurrentDevicePasskeyId(localMetadata.credentialId);
        }

        // 2. Fetch all passkeys from Supabase
        const cloudPasskeys = await PasskeyService.fetchCloudPasskeys(user.id);
        
        // 3. Map cloud passkeys to store format
        const formattedPasskeys: PasskeyInfo[] = cloudPasskeys.map(cp => ({
          id: cp.credentialId,
          idRaw: cp.credentialIdRaw as Hex,
          deviceName: cp.deviceName,
          deviceType: cp.deviceType,
          isOnChain: true, // If it's in Supabase, we assume it's on-chain or intended to be
          px: cp.publicKeyX,
          py: cp.publicKeyY,
          createdAt: cp.createdAt,
        }));

        // 4. Merge with local-only passkeys (those not yet in cloud/on-chain)
        const localOnly = passkeys.filter(lp => !lp.isOnChain && !formattedPasskeys.find(fp => fp.id === lp.id));
        
        setPasskeys([...formattedPasskeys, ...localOnly]);
      } catch (error) {
        console.error("Failed to load passkeys:", error);
      } finally {
        setIsFetching(false);
      }
    };

    loadPasskeys();
  }, [user?.id]);

  const resolvedChainId = useMemo(() => 
    (aaAccount?.chainId || activeChainId || DEFAULT_CHAIN_ID), 
    [aaAccount?.chainId, activeChainId]
  );

  const handleAddPasskey = async () => {
    if (!user?.id) {
      Alert.alert("Error", "User not found. Please sign in again.");
      return;
    }

    try {
      setIsSubmitting(true);
      const metadata = await PasskeyService.createPasskey(user.id);
      
      // Save locally
      await PasskeyAccountService.enqueuePendingPasskey(user.id, metadata);
      
      // Update store with isOnChain: false
      addPasskey({
        id: metadata.credentialId,
        idRaw: metadata.credentialIdRaw as Hex,
        deviceName: metadata.deviceName || "This Device",
        deviceType: metadata.deviceType || "Smartphone",
        isOnChain: false,
        px: metadata.publicKeyX,
        py: metadata.publicKeyY,
        createdAt: metadata.createdAt,
      });

      Alert.alert(
        "Passkey Created", 
        "A new passkey has been added locally. You can now sync it to the blockchain to use it for secure transactions.",
        [{ text: "OK" }]
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes("User cancelled")) {
        return;
      }
      console.error("Failed to create passkey:", error);
      Alert.alert("Error", "Failed to create passkey. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterOnChain = async (pk: PasskeyInfo) => {
    if (!user?.id || !smartAccountAddress) {
      Alert.alert("Error", "Smart account not found.");
      return;
    }

    // We need an existing on-chain passkey to sign the transaction
    const signingPasskey = passkeys.find(p => p.isOnChain);
    if (!signingPasskey) {
      Alert.alert("Error", "No on-chain passkey found to sign this transaction. Please use your initial setup passkey.");
      return;
    }

    try {
      setProcessingId(pk.id);
      
      // 1. Build UserOp
      const { userOp, userOpHash } = await PasskeyAccountService.buildAddPasskeyUserOp({
        smartAccountAddress: smartAccountAddress as Address,
        pendingPasskey: {
          idRaw: pk.idRaw,
          credentialId: pk.id,
          px: pk.px, 
          py: pk.py,
          createdAt: pk.createdAt,
        },
        signingPasskeyId: signingPasskey.idRaw,
        chainId: resolvedChainId as any,
        usePaymaster: true,
      });

      // 2. Sign UserOp
      const signature = await PasskeyService.signWithPasskey(user.id, userOpHash);
      const encodedSignature = PasskeyService.encodeSignatureForContract(signature) as Hex;
      const signedUserOp = { ...userOp, signature: encodedSignature };

      // 3. Submit UserOp
      await PasskeyAccountService.submitAddPasskeyUserOp(
        signedUserOp as any,
        resolvedChainId as any
      );

      // 4. Sync to Supabase for cross-device visibility
      if (aaAccount?.id) {
        await PasskeyService.syncPasskeyToCloud(user.id, aaAccount.id, {
          credentialId: pk.id,
          credentialIdRaw: pk.idRaw,
          publicKeyX: pk.px,
          publicKeyY: pk.py,
          deviceName: pk.deviceName,
          deviceType: pk.deviceType as any,
          createdAt: pk.createdAt,
          rpId: "", // Not needed for storage
        });
      }

      // 5. Update local state
      removePasskey(pk.id);
      addPasskey({ ...pk, isOnChain: true });

      Alert.alert("Success", "Passkey registration submitted on-chain and synced to cloud!");
    } catch (error) {
      console.error("On-chain registration failed:", error);
      Alert.alert("Error", "Failed to register passkey on-chain.");
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemovePasskey = (pk: PasskeyInfo) => {
    Alert.alert(
      "Remove Passkey",
      pk.isOnChain 
        ? "This passkey is registered on-chain. Removing it from this list only removes the local reference. To remove it on-chain, use the Manage on-chain option."
        : "Are you sure you want to remove this passkey from this device?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            try {
              if (user?.id) {
                // await PasskeyService.deletePasskey(user.id);
              }
              removePasskey(pk.id);
              Alert.alert("Success", "Passkey removed.");
            } catch (error) {
              Alert.alert("Error", "Failed to remove passkey.");
            }
          }
        }
      ]
    );
  };

  return (
    <TabScreenContainer style={{ backgroundColor: colors.background }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Security & Privacy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Biometrics</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="unlock" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Enable Biometrics</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Use FaceID or Fingerprint to unlock</Text>
              </View>
            </View>
            <Switch 
              value={biometricsEnabled} 
              onValueChange={setBiometricsEnabled}
              trackColor={{ false: colors.border, true: colors.accent }}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginBottom: 0 }]}>Passkey Management</Text>
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: withAlpha(colors.accent, 0.1) }]}
              onPress={handleAddPasskey}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Feather name="plus" size={16} color={colors.accent} />
                  <Text style={[styles.addButtonText, { color: colors.accent }]}>Add New</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
            Manage your secure passkeys used for authorizing transactions.
          </Text>

          <View style={styles.passkeyList}>
            {passkeys.length === 0 ? (
              <View style={styles.emptyPasskeys}>
                <Feather name="key" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No passkeys added yet</Text>
              </View>
            ) : (
              passkeys.map((pk, index) => (
                <View 
                  key={pk.id} 
                  style={[
                    styles.passkeyItem, 
                    index !== passkeys.length - 1 && { borderBottomWidth: 1, borderBottomColor: withAlpha(colors.border, 0.5) }
                  ]}
                >
                  <View style={styles.passkeyInfo}>
                    <View style={[styles.passkeyIcon, { backgroundColor: pk.isOnChain ? withAlpha(colors.success, 0.1) : withAlpha(colors.accent, 0.1) }]}>
                      <Feather name={pk.isOnChain ? "shield" : "smartphone"} size={16} color={pk.isOnChain ? colors.success : colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={[styles.passkeyName, { color: colors.textPrimary }]}>{pk.deviceName || "Unnamed Device"}</Text>
                        {pk.id === currentDevicePasskeyId && (
                          <View style={[styles.deviceBadge, { backgroundColor: withAlpha(colors.accent, 0.1) }]}>
                            <Text style={[styles.deviceBadgeText, { color: colors.accent }]}>This Device</Text>
                          </View>
                        )}
                        {pk.isOnChain && (
                          <View style={[styles.onChainBadge, { backgroundColor: withAlpha(colors.success, 0.1) }]}>
                            <Feather name="check" size={8} color={colors.success} style={{ marginRight: 2 }} />
                            <Text style={[styles.onChainBadgeText, { color: colors.success }]}>Cloud Synced</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.passkeyDate, { color: colors.textMuted }]}>
                        Created {new Date(pk.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.passkeyActions}>
                    {!pk.isOnChain && (
                      <TouchableOpacity 
                        onPress={() => handleRegisterOnChain(pk)} 
                        disabled={processingId === pk.id}
                        style={[styles.registerButton, { backgroundColor: withAlpha(colors.accent, 0.1) }]}
                      >
                        {processingId === pk.id ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <Text style={[styles.registerButtonText, { color: colors.accent }]}>Sync</Text>
                        )}
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleRemovePasskey(pk)} style={styles.removeButton}>
                      <Feather name="trash-2" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Authentication</Text>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="shield" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Two-Factor Auth (2FA)</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Add an extra layer of security</Text>
              </View>
            </View>
            <Feather name="chevron-right" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surfaceCard, borderColor: colors.borderMuted }]}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Privacy</Text>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Feather name="eye-off" size={20} color={colors.accent} />
              <View>
                <Text style={[styles.settingLabel, { color: colors.textPrimary }]}>Incognito Mode</Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Hide balances from main screen</Text>
              </View>
            </View>
            <Switch value={false} trackColor={{ false: colors.border, true: colors.accent }} />
          </TouchableOpacity>
        </View>
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
    gap: 20,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    opacity: 0.8,
  },
  sectionDesc: {
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingSub: {
    fontSize: 13,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  addButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  passkeyList: {
    marginTop: 10,
  },
  passkeyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  passkeyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  passkeyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passkeyName: {
    fontSize: 14,
    fontWeight: '600',
  },
  onChainBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  onChainBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  deviceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  deviceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  passkeyDate: {
    fontSize: 11,
    marginTop: 2,
  },
  passkeyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  registerButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  registerButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  removeButton: {
    padding: 8,
  },
  emptyPasskeys: {
    alignItems: 'center',
    paddingVertical: 30,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default SecurityPrivacyScreen;
