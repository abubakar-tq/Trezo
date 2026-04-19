import { Feather } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import React, { useMemo, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { type Address } from "viem";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

interface RouteParams {
  vaultKey: string;
  smartAccountAddress: Address;
}

const RecoveryKitExportScreen: React.FC = () => {
  const route = useRoute();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { vaultKey, smartAccountAddress } = route.params as RouteParams;

  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const message = `Trezo Wallet - Recovery Vault Key\n\nSmart Account: ${smartAccountAddress}\n\nVault Key:\n${vaultKey}\n\nIMPORTANT: Keep this key safe. Anyone with this key can potentially reset your account if they compromise your recovery email. Store it offline!`;

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync("", {
        dialogTitle: "Backup Recovery Vault Key",
        UTI: "public.plain-text",
        mimeType: "text/plain",
        // Most platforms support strings via message/subject
        // but sharing a string directly sometimes requires writing to a temp file first for 'shareAsync'
        // For simplicity in React Native, we can also use Share.share from 'react-native'
      });
    } else {
      Alert.alert("Sharing not available", "Please copy the key manually.");
    }
  };

  // Fallback to RN Share for text-only sharing if needed
  const handleNativeShare = async () => {
    try {
      const { Share } = await import("react-native");
      await Share.share({
        title: "Trezo Recovery Key",
        message: `Trezo Wallet Recovery Key\n\nAccount: ${smartAccountAddress}\n\nKey: ${vaultKey}`,
      });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="shield" size={32} color={colors.accent} />
        </View>
        <Text style={styles.title}>Recovery Vault Kit</Text>
        <Text style={styles.subtitle}>
          This key is required to decrypt your recovery email settings if you
          lose this device.
        </Text>
      </View>

      <View style={styles.warningCard}>
        <Feather
          name="alert-triangle"
          size={20}
          color={colors.warning || "#EAB308"}
        />
        <Text style={styles.warningText}>
          Never share this key with anyone. Trezo staff will never ask for it.
        </Text>
      </View>

      <View style={styles.qrContainer}>
        <View style={styles.qrWrapper}>
          <QRCode
            value={vaultKey}
            size={200}
            color={colors.text}
            backgroundColor={colors.surfaceCard}
          />
        </View>
        <Text style={styles.qrLabel}>Scan to import on new device</Text>
      </View>

      <View style={styles.keyCard}>
        <Text style={styles.keyLabel}>Vault Key (Base64)</Text>
        <View style={styles.keyBox}>
          <Text style={styles.keyText} numberOfLines={3}>
            {vaultKey}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleNativeShare}
        >
          <Feather
            name="share-2"
            size={18}
            color={colors.textOnAccent}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.shareButtonText}>Share / Save as Text</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Why is this needed?</Text>
        <Text style={styles.infoText}>
          Your recovery email is stored encrypted in the cloud. Only this Vault
          Key can decrypt it. Without this key or access to this device, you
          won&apos;t be able to initiate a recovery.
        </Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      alignItems: "center",
    },
    header: {
      alignItems: "center",
      marginBottom: 24,
      marginTop: 20,
    },
    iconContainer: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: withAlpha(colors.accent, 0.1),
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
      paddingHorizontal: 20,
    },
    warningCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: withAlpha(colors.warning || "#EAB308", 0.1),
      padding: 12,
      borderRadius: 12,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: withAlpha(colors.warning || "#EAB308", 0.2),
    },
    warningText: {
      flex: 1,
      fontSize: 12,
      color: colors.warning || "#EAB308",
      marginLeft: 10,
      fontWeight: "500",
    },
    qrContainer: {
      alignItems: "center",
      marginBottom: 24,
    },
    qrWrapper: {
      padding: 16,
      backgroundColor: colors.surfaceCard,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    },
    qrLabel: {
      marginTop: 12,
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "500",
    },
    keyCard: {
      width: "100%",
      backgroundColor: colors.surfaceCard,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 24,
    },
    keyLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 1,
      marginBottom: 10,
    },
    keyBox: {
      backgroundColor: withAlpha(colors.text, 0.05),
      padding: 12,
      borderRadius: 8,
      marginBottom: 16,
    },
    keyText: {
      fontSize: 13,
      fontFamily: "monospace",
      color: colors.text,
      textAlign: "center",
    },
    shareButton: {
      flexDirection: "row",
      backgroundColor: colors.accent,
      paddingVertical: 14,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    shareButtonText: {
      color: colors.textOnAccent,
      fontWeight: "600",
      fontSize: 16,
    },
    infoSection: {
      width: "100%",
      paddingHorizontal: 4,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    infoText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
    },
  });

export default RecoveryKitExportScreen;
