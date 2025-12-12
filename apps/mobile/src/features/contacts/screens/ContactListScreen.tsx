import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import { ContactService, type Contact } from "../index";

const ContactListScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      const [contactsData, tagsData] = await Promise.all([
        ContactService.getContacts(),
        ContactService.getAllTags(),
      ]);
      setContacts(contactsData);
      setFilteredContacts(contactsData);
      setAllTags(tagsData);
    } catch (error) {
      console.error("Failed to load contacts:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Filter contacts based on search and tags
  useEffect(() => {
    let result = contacts;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query) ||
          contact.addresses?.some((addr) =>
            addr.address.toLowerCase().includes(query)
          ) ||
          contact.memo?.toLowerCase().includes(query)
      );
    }

    // Filter by selected tags
    if (selectedTags.length > 0) {
      result = result.filter((contact) =>
        selectedTags.some((tag) => contact.tags?.includes(tag))
      );
    }

    setFilteredContacts(result);
  }, [searchQuery, selectedTags, contacts]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }, []);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadContacts();
  }, [loadContacts]);

  const renderContactItem = useCallback(
    ({ item }: { item: Contact }) => {
      const primaryAddress = item.addresses?.[0]?.address;
      const shortAddress = primaryAddress
        ? `${primaryAddress.slice(0, 6)}...${primaryAddress.slice(-4)}`
        : "No address";

      return (
        <TouchableOpacity
          style={styles.contactCard}
          onPress={() => {
            (navigation as any).navigate("ContactDetail", { contactId: item.id });
          }}
          activeOpacity={0.85}
        >
          <View style={styles.contactAvatar}>
            <Text style={styles.contactAvatarText}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactName}>{item.name}</Text>
            <Text style={styles.contactAddress} numberOfLines={1}>
              {shortAddress}
            </Text>
            {item.tags && item.tags.length > 0 && (
              <View style={styles.contactTags}>
                {item.tags.slice(0, 2).map((tag) => (
                  <View key={tag} style={styles.contactTag}>
                    <Text style={styles.contactTagText}>{tag}</Text>
                  </View>
                ))}
                {item.tags.length > 2 && (
                  <Text style={styles.contactTagMore}>
                    +{item.tags.length - 2}
                  </Text>
                )}
              </View>
            )}
          </View>
          <Feather name="chevron-right" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      );
    },
    [colors, styles]
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Feather name="users" size={64} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>No Contacts Yet</Text>
      <Text style={styles.emptySubtitle}>
        Add your first contact to get started
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContent}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search contacts or addresses"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tag Filters */}
      {allTags.length > 0 && (
        <View style={styles.tagsContainer}>
          <FlatList
            horizontal
            data={allTags}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item: tag }) => (
              <TouchableOpacity
                style={[
                  styles.tagChip,
                  selectedTags.includes(tag) && styles.tagChipActive,
                ]}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.tagChipText,
                    selectedTags.includes(tag) && styles.tagChipTextActive,
                  ]}
                >
                  {tag}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Results Count */}
      <Text style={styles.resultsCount}>
        {filteredContacts.length} {filteredContacts.length === 1 ? "contact" : "contacts"}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contacts</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accentAlt} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contacts</Text>
        <TouchableOpacity
          onPress={() => {
            navigation.navigate("AddContact" as never);
          }}
        >
          <Feather name="plus" size={24} color={colors.accentAlt} />
        </TouchableOpacity>
      </View>

      {/* Contact List */}
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContactItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
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
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    listContent: {
      padding: 20,
    },
    headerContent: {
      marginBottom: 16,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 15,
    },
    tagsContainer: {
      marginBottom: 16,
    },
    tagChip: {
      backgroundColor: withAlpha(colors.textPrimary, 0.06),
      borderWidth: 1,
      borderColor: colors.borderMuted,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 8,
    },
    tagChipActive: {
      backgroundColor: colors.accentAlt,
      borderColor: colors.accentAlt,
    },
    tagChipText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    tagChipTextActive: {
      color: "#ffffff",
    },
    resultsCount: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    contactCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      gap: 12,
    },
    contactAvatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: withAlpha(colors.accentAlt, 0.15),
      alignItems: "center",
      justifyContent: "center",
    },
    contactAvatarText: {
      color: colors.accentAlt,
      fontSize: 20,
      fontWeight: "700",
    },
    contactInfo: {
      flex: 1,
      gap: 4,
    },
    contactName: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    contactAddress: {
      color: colors.textSecondary,
      fontSize: 13,
      fontFamily: "monospace",
    },
    contactTags: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },
    contactTag: {
      backgroundColor: withAlpha(colors.accentAlt, 0.1),
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    contactTagText: {
      color: colors.accentAlt,
      fontSize: 11,
      fontWeight: "600",
    },
    contactTagMore: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "600",
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 80,
      gap: 12,
    },
    emptyTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    emptySubtitle: {
      color: colors.textMuted,
      fontSize: 14,
    },
  });

export default ContactListScreen;
