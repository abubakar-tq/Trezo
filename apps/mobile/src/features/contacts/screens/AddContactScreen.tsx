import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { ContactService, type ContactAddress } from "../index";
import { useUserStore } from "@store/useUserStore";

const CHAIN_MAP: Record<string, { chain_id: number; label: string }> = {
  ethereum: { chain_id: 1, label: "Ethereum" },
  sepolia: { chain_id: 11155111, label: "Sepolia" },
  polygon: { chain_id: 137, label: "Polygon" },
  bsc: { chain_id: 56, label: "BSC" },
  arbitrum: { chain_id: 42161, label: "Arbitrum" },
  optimism: { chain_id: 10, label: "Optimism" },
  base: { chain_id: 8453, label: "Base" },
};

const AddContactScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useUserStore((state: any) => state.user?.id);

  const [name, setName] = useState("");
  const [addresses, setAddresses] = useState<Array<{ chain: string; address: string }>>([
    { chain: "ethereum", address: "" },
  ]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [memo, setMemo] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const availableTags = ["guardian", "friend", "family", "business", "exchange"];

  const addAddress = () => {
    setAddresses([...addresses, { chain: "ethereum", address: "" }]);
  };

  const removeAddress = (index: number) => {
    if (addresses.length > 1) {
      setAddresses(addresses.filter((_, i) => i !== index));
    }
  };

  const updateAddress = (index: number, field: "chain" | "address", value: string) => {
    const updated = [...addresses];
    updated[index][field] = value;
    setAddresses(updated);
  };

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const addCustomTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleSave = async () => {
    // Validate
    if (!name.trim()) {
      Alert.alert("Error", "Please enter a contact name");
      return;
    }

    if (!userId) {
      Alert.alert("Error", "You must be logged in to add contacts");
      return;
    }

    // Filter out empty addresses and convert to ContactAddress format
    const validAddresses: ContactAddress[] = addresses
      .filter(a => a.address.trim())
      .map(a => {
        const chainInfo = CHAIN_MAP[a.chain.toLowerCase()] || CHAIN_MAP.ethereum;
        return {
          chain_id: chainInfo.chain_id,
          label: chainInfo.label,
          address: a.address.trim(),
        };
      });

    if (validAddresses.length === 0) {
      Alert.alert("Error", "Please add at least one address");
      return;
    }

    setIsSaving(true);

    try {
      // Save to database (ContactService handles local storage too)
      const newContact = await ContactService.createContact({
        name: name.trim(),
        addresses: validAddresses,
        tags,
        memo: memo.trim() || undefined,
      });

      if (newContact) {
        Alert.alert("Success", "Contact added successfully!", [
          {
            text: "View Details",
            onPress: () => {
              navigation.goBack();
              setTimeout(() => {
                (navigation as any).navigate("ContactDetail", { contactId: newContact.id });
              }, 100);
            },
          },
          {
            text: "Done",
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        throw new Error("Failed to create contact");
      }
    } catch (error: any) {
      console.error("Failed to add contact:", error);
      Alert.alert("Error", error.message || "Failed to add contact");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="x" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Contact</Text>
        <TouchableOpacity onPress={handleSave} disabled={isSaving}>
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.accentAlt} />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Name */}
        <View style={styles.section}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter contact name"
            placeholderTextColor={withAlpha(colors.textPrimary, 0.4)}
            autoCapitalize="words"
          />
        </View>

        {/* Addresses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Addresses *</Text>
            <TouchableOpacity onPress={addAddress}>
              <Feather name="plus-circle" size={20} color={colors.accentAlt} />
            </TouchableOpacity>
          </View>
          {addresses.map((addr, index) => (
            <View key={index} style={styles.addressItem}>
              <View style={styles.addressInputs}>
                <View style={styles.chainInput}>
                  <TextInput
                    style={styles.input}
                    value={addr.chain}
                    onChangeText={(value) => updateAddress(index, "chain", value)}
                    placeholder="Chain"
                    placeholderTextColor={withAlpha(colors.textPrimary, 0.4)}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.addressField}>
                  <TextInput
                    style={styles.input}
                    value={addr.address}
                    onChangeText={(value) => updateAddress(index, "address", value)}
                    placeholder="0x..."
                    placeholderTextColor={withAlpha(colors.textPrimary, 0.4)}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
              {addresses.length > 1 && (
                <TouchableOpacity onPress={() => removeAddress(index)}>
                  <Feather name="trash-2" size={18} color={withAlpha(colors.textPrimary, 0.6)} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>

        {/* Tags */}
        <View style={styles.section}>
          <Text style={styles.label}>Tags</Text>
          <View style={styles.tagsContainer}>
            {availableTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tag,
                  tags.includes(tag) && styles.tagActive,
                ]}
                onPress={() => toggleTag(tag)}
              >
                <Text
                  style={[
                    styles.tagText,
                    tags.includes(tag) && styles.tagTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {tags.filter(t => !availableTags.includes(t)).map((tag) => (
            <View key={tag} style={[styles.tag, styles.tagActive, styles.customTag]}>
              <Text style={styles.tagTextActive}>{tag}</Text>
              <TouchableOpacity onPress={() => setTags(tags.filter(t => t !== tag))}>
                <Feather name="x" size={14} color={colors.accentAlt} />
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.customTagInput}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add custom tag..."
              placeholderTextColor={withAlpha(colors.textPrimary, 0.4)}
              autoCapitalize="none"
              onSubmitEditing={addCustomTag}
            />
            <TouchableOpacity onPress={addCustomTag} style={styles.addTagButton}>
              <Feather name="plus" size={20} color={colors.accentAlt} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Memo */}
        <View style={styles.section}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.memoInput]}
            value={memo}
            onChangeText={setMemo}
            placeholder="Add notes about this contact..."
            placeholderTextColor={withAlpha(colors.textPrimary, 0.4)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    saveButton: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.accentAlt,
    },
    content: {
      flex: 1,
      paddingHorizontal: 20,
    },
    section: {
      marginTop: 24,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    label: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
    },
    input: {
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: withAlpha(colors.textPrimary, 0.1),
    },
    addressItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    addressInputs: {
      flex: 1,
      flexDirection: "row",
      gap: 12,
    },
    chainInput: {
      width: 100,
    },
    addressField: {
      flex: 1,
    },
    tagsContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },
    tag: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: withAlpha(colors.textPrimary, 0.05),
      borderWidth: 1,
      borderColor: withAlpha(colors.textPrimary, 0.1),
    },
    tagActive: {
      backgroundColor: withAlpha(colors.accentAlt, 0.15),
      borderColor: colors.accentAlt,
    },
    tagText: {
      fontSize: 14,
      color: colors.textSecondary,
      textTransform: "capitalize",
    },
    tagTextActive: {
      color: colors.accentAlt,
      fontWeight: "600",
    },
    customTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    customTagInput: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    addTagButton: {
      padding: 8,
    },
    memoInput: {
      height: 100,
      paddingTop: 16,
    },
  });

export default AddContactScreen;
