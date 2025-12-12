import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ThemedAlert, type ThemedAlertButton } from "@shared/components/ui/ThemedAlert";

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
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState("");
  const [editedMemo, setEditedMemo] = useState("");
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons?: ThemedAlertButton[];
  }>({ visible: false, title: "", message: "" });

  // Themed alert helper
  const showAlert = (title: string, message: string, buttons?: ThemedAlertButton[]) => {
    setAlertConfig({ visible: true, title, message, buttons });
  };

  const dismissAlert = () => {
    setAlertConfig({ visible: false, title: "", message: "" });
  };

  useEffect(() => {
    loadContact();
  }, [contactId]);

  const loadContact = async () => {
    if (!contactId) {
      showAlert("Error", "Contact ID not provided");
      navigation.goBack();
      return;
    }

    setIsLoading(true);
    const data = await ContactService.getContact(contactId);
    if (data) {
      setContact(data);
      setEditedName(data.name);
      setEditedMemo(data.memo || "");
    } else {
      showAlert("Error", "Contact not found");
      navigation.goBack();
    }
    setIsLoading(false);
  };

  const handleCopyAddress = (address: string) => {
    Clipboard.setString(address);
    showAlert("Copied", "Address copied to clipboard");
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!contact || !editedName.trim()) {
      showAlert("Error", "Name cannot be empty");
      return;
    }

    const updated = await ContactService.updateContact(contact.id, {
      name: editedName.trim(),
      memo: editedMemo.trim() || undefined,
    });

    if (updated) {
      setContact(updated);
      setIsEditing(false);
      showAlert("Success", "Contact updated");
    } else {
      showAlert("Error", "Failed to update contact");
    }
  };

  const handleCancelEdit = () => {
    setEditedName(contact?.name || "");
    setEditedMemo(contact?.memo || "");
    setIsEditing(false);
  };

  const handleDelete = () => {
    showAlert(
      "Delete Contact",
      `Are you sure you want to delete ${contact?.name}?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => {} },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (contact) {
              const success = await ContactService.deleteContact(contact.id);
              if (success) {
                showAlert("Success", "Contact deleted", [
                  { text: "OK", onPress: () => navigation.goBack(), style: "default" },
                ]);
              } else {
                showAlert("Error", "Failed to delete contact");
              }
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
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
      </SafeAreaView>
    );
  }

  if (!contact) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >        <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Details</Text>
          {isEditing ? (
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={handleCancelEdit} style={styles.headerButton}>
                <Feather name="x" size={20} color={withAlpha(colors.textPrimary, 0.6)} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                <Feather name="check" size={20} color={colors.accentAlt} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={handleEdit} style={styles.headerButton}>
                <Feather name="edit-2" size={20} color={colors.accentAlt} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.headerButton}>
                <Feather name="trash-2" size={20} color={withAlpha(colors.textPrimary, 0.6)} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Name */}
          <View style={styles.nameContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(isEditing ? editedName : contact.name).charAt(0).toUpperCase()}
              </Text>
            </View>
            {isEditing ? (
              <TextInput
                style={styles.nameInput}
                value={editedName}
                onChangeText={setEditedName}
                placeholder="Contact name"
                placeholderTextColor={withAlpha(colors.textPrimary, 0.4)}
                autoCapitalize="words"
              />
            ) : (
              <Text style={styles.name}>{contact.name}</Text>
            )}
          </View>

          {/* Addresses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Addresses</Text>
          {contact.addresses && contact.addresses.length > 0 ? (
            contact.addresses.map((addr, index) => (
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
            ))
          ) : (
            <Text style={styles.memoText}>No addresses added</Text>
          )}
        </View>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsContainer}>
                {contact.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            {isEditing ? (
              <TextInput
                style={styles.memoInput}
                value={editedMemo}
                onChangeText={setEditedMemo}
                placeholder="Add notes about this contact"
                placeholderTextColor={withAlpha(colors.textPrimary, 0.4)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <View style={styles.memoContainer}>
                <Text style={styles.memoText}>
                  {contact.memo || "No notes added yet"}
                </Text>
              </View>
            )}
          </View>

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
      </KeyboardAvoidingView>
      <ThemedAlert
        visible={alertConfig.visible}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onDismiss={dismissAlert}
      />
    </SafeAreaView>
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
    headerButtons: {
      flexDirection: "row",
      columnGap: 12,
    },
    headerButton: {
      padding: 4,
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
    nameInput: {
      fontSize: 24,
      fontWeight: "600",
      color: colors.textPrimary,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      borderWidth: 1,
      borderColor: colors.accentAlt,
    },
    memoInput: {
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      borderWidth: 1,
      borderColor: colors.accentAlt,
      minHeight: 100,
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
