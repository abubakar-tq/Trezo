import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { ContactService, type Contact } from "../index";

const ContactDetailScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const contactId = (route.params as any)?.contactId;
  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadContact();
  }, [contactId]);

  const loadContact = async () => {
    if (!contactId) {
      Alert.alert("Error", "Contact ID not provided");
      navigation.goBack();
      return;
    }

    setIsLoading(true);
    const data = await ContactService.getContact(contactId);
    if (data) {
      setContact(data);
    } else {
      Alert.alert("Error", "Contact not found");
      navigation.goBack();
    }
    setIsLoading(false);
  };

  const handleCopyAddress = (address: string) => {
    Clipboard.setString(address);
    Alert.alert("Copied", "Address copied to clipboard");
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Contact",
      `Are you sure you want to delete ${contact?.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (contact) {
              const success = await ContactService.deleteContact(contact.id);
              if (success) {
                Alert.alert("Success", "Contact deleted", [
                  { text: "OK", onPress: () => navigation.goBack() },
                ]);
              } else {
                Alert.alert("Error", "Failed to delete contact");
              }
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentAlt} />
        </View>
      </View>
    );
  }

  if (!contact) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contact Details</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Feather name="trash-2" size={20} color={withAlpha(colors.textPrimary, 0.6)} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <View style={styles.nameContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {contact.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{contact.name}</Text>
        </View>

        {/* Tags */}
        {contact.tags && contact.tags.length > 0 && (
          <View style={styles.section}>
            <View style={styles.tagsContainer}>
              {contact.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Addresses</Text>
          {contact.addresses.map((addr, index) => (
            <View key={index} style={styles.addressItem}>
              <View style={styles.addressInfo}>
                <Text style={styles.addressLabel}>{addr.label}</Text>
                <Text style={styles.addressText} numberOfLines={1}>
                  {addr.address}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCopyAddress(addr.address)}
                style={styles.copyButton}
              >
                <Feather name="copy" size={18} color={colors.accentAlt} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Memo */}
        {contact.memo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.memoContainer}>
              <Text style={styles.memoText}>{contact.memo}</Text>
            </View>
          </View>
        )}

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.metadataContainer}>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Created</Text>
              <Text style={styles.metadataValue}>
                {new Date(contact.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Updated</Text>
              <Text style={styles.metadataValue}>
                {new Date(contact.updated_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>ID</Text>
              <Text style={styles.metadataValue} numberOfLines={1}>
                {contact.id.slice(0, 8)}...
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
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
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.textPrimary, 0.1),
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      flex: 1,
    },
    nameContainer: {
      alignItems: "center",
      paddingVertical: 32,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.textPrimary, 0.1),
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: withAlpha(colors.accentAlt, 0.15),
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: "600",
      color: colors.accentAlt,
    },
    name: {
      fontSize: 24,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    section: {
      paddingHorizontal: 20,
      paddingVertical: 24,
      borderBottomWidth: 1,
      borderBottomColor: withAlpha(colors.textPrimary, 0.1),
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 16,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    tagsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    tag: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: withAlpha(colors.accentAlt, 0.15),
      borderWidth: 1,
      borderColor: colors.accentAlt,
    },
    tagText: {
      fontSize: 14,
      color: colors.accentAlt,
      fontWeight: "600",
      textTransform: "capitalize",
    },
    addressItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    addressInfo: {
      flex: 1,
      marginRight: 12,
    },
    addressLabel: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 4,
    },
    addressText: {
      fontSize: 14,
      color: colors.textPrimary,
      fontFamily: "monospace",
    },
    copyButton: {
      padding: 8,
    },
    memoContainer: {
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      borderRadius: 12,
      padding: 16,
    },
    memoText: {
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    metadataContainer: {
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      borderRadius: 12,
      padding: 16,
    },
    metadataRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 8,
    },
    metadataLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    metadataValue: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: "500",
    },
  });

export default ContactDetailScreen;
