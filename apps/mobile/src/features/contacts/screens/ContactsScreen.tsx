/**
 * ContactsScreen.tsx
 *
 * Manage contacts/connections for transactions and recovery.
 *
 * Constraints Applied:
 * - F-Pattern: Contacts list, add button bottom
 * - Empty state with CTA
 * - Contact cards with actions
 * - Trust markers for verified contacts
 * - Search functionality
 */

import React, { useState } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import { Badge } from "../../../shared/components/Tier1/Badge";
import {
    PrimaryButton,
    SecondaryButton,
} from "../../../shared/components/Tier1/Button";
import { Input } from "../../../shared/components/Tier1/Input";
import { CardLevel1, Surface } from "../../../shared/components/Tier1/Surface";
import {
    BodyText,
    CaptionText,
    HeadlineText,
    TitleText,
} from "../../../shared/components/Tier1/Text";
import { Spacing } from "../../../shared/components/TokenRegistry";
import { useAppTheme } from "@theme";

interface Contact {
  id: string;
  name: string;
  email: string;
  address?: string;
  status: "verified" | "pending" | "blocked";
  avatar: string;
  transactions: number;
}

interface ContactsScreenProps {
  onAddContact?: () => void;
  onSelectContact?: (contact: Contact) => void;
}

const MOCK_CONTACTS: Contact[] = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@example.com",
    address: "0x742d35Cc6634...",
    status: "verified",
    avatar: "👩",
    transactions: 12,
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@example.com",
    address: "0x8b2f8f6e5c4d...",
    status: "verified",
    avatar: "👨",
    transactions: 8,
  },
  {
    id: "3",
    name: "Carol Davis",
    email: "carol@example.com",
    status: "pending",
    avatar: "👩‍🦰",
    transactions: 0,
  },
];

export const ContactsScreen: React.FC<ContactsScreenProps> = ({
  onAddContact,
  onSelectContact,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "verified" | "pending">("all");

  const filteredContacts = MOCK_CONTACTS.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filter === "all" || contact.status === filter;

    return matchesSearch && matchesFilter;
  });

  const renderContactCard = (contact: Contact) => (
    <CardLevel1 key={contact.id}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: Spacing.sp3,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            gap: Spacing.sp3,
            flex: 1,
            alignItems: "center",
          }}
        >
          <BodyText style={{ fontSize: 32 }}>
            {contact.avatar}
          </BodyText>

          <View style={{ flex: 1, gap: Spacing.sp1 }}>
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sp2,
                alignItems: "center",
              }}
            >
              <BodyText style={{ fontWeight: "600", flex: 1 }}>
                {contact.name}
              </BodyText>
              {contact.status === "verified" && (
                <BodyText style={{ fontSize: 14 }}>
                  ✓
                </BodyText>
              )}
            </View>

            <BodyText
              color={colors.textMuted}
              style={{ fontSize: 12 }}
            >
              {contact.email}
            </BodyText>

            {contact.transactions > 0 && (
              <BodyText
                color={colors.success}
                style={{ fontSize: 11, fontWeight: "500" }}
              >
                {contact.transactions} transaction
                {contact.transactions === 1 ? "" : "s"}
              </BodyText>
            )}
          </View>
        </View>

        <Badge
          status={contact.status === "verified" ? "success" : "warning"}
          label={contact.status === "verified" ? "Verified" : "Pending"}
        />
      </View>
    </CardLevel1>
  );

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.sp4,
          paddingVertical: Spacing.sp6,
          gap: Spacing.sp6,
          paddingBottom: Spacing.sp8,
        }}
      >
        {/* HEADER */}
        <View style={{ gap: Spacing.sp2 }}>
          <HeadlineText>Contacts</HeadlineText>
          <BodyText
            color={colors.textMuted}
          >
            Manage your transaction and recovery contacts.
          </BodyText>
        </View>

        {/* SEARCH BAR */}
        <Input
          label="Search Contacts"
          placeholder="Name or email..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* FILTER TABS */}
        <View style={{ flexDirection: "row", gap: Spacing.sp2 }}>
          {[
            { id: "all", label: `All (${MOCK_CONTACTS.length})` },
            {
              id: "verified",
              label: `Verified (${MOCK_CONTACTS.filter((c) => c.status === "verified").length})`,
            },
            {
              id: "pending",
              label: `Pending (${MOCK_CONTACTS.filter((c) => c.status === "pending").length})`,
            },
          ].map((tab) => (
            <SecondaryButton
              key={tab.id}
              label={tab.label}
              onPress={() => setFilter(tab.id as any)}
            />
          ))}
        </View>

        {/* CONTACTS LIST */}
        {filteredContacts.length > 0 ? (
          <View style={{ gap: Spacing.sp3 }}>
            <CaptionText color={colors.accent}>
              {filter === "all"
                ? `${filteredContacts.length} Contact${filteredContacts.length === 1 ? "" : "s"}`
                : `${filteredContacts.length} ${filter === "verified" ? "Verified" : "Pending"} Contact${filteredContacts.length === 1 ? "" : "s"}`}
            </CaptionText>

            {filteredContacts.map((contact) => renderContactCard(contact))}
          </View>
        ) : (
          <Surface elevation={1}>
            <View
              style={{
                alignItems: "center",
                gap: Spacing.sp3,
                paddingVertical: Spacing.sp6,
              }}
            >
              <BodyText style={{ fontSize: 48 }}>
                🔍
              </BodyText>
              <View style={{ alignItems: "center", gap: Spacing.sp2 }}>
                <TitleText>No contacts found</TitleText>
                <BodyText
                  color={colors.textMuted}
                  style={{ fontSize: 13, textAlign: "center" }}
                >
                  {searchQuery
                    ? "Try adjusting your search"
                    : `You have no ${filter === "all" ? "" : filter} contacts yet`}
                </BodyText>
              </View>
            </View>
          </Surface>
        )}

        {/* INFO SECTION */}
        <CardLevel1>
          <View style={{ gap: Spacing.sp2 }}>
            <TitleText>Why add contacts?</TitleText>
            <BodyText
              color={colors.textMuted}
              style={{ fontSize: 13, lineHeight: 20 }}
            >
              • Quickly access frequent recipients{"\n"}• Track transaction
              history{"\n"}• Mark trusted addresses{"\n"}• Add to your recovery
              network
            </BodyText>
          </View>
        </CardLevel1>

        {/* ADD CONTACT CTA - Rule of One */}
        <PrimaryButton
          label="Add New Contact"
          onPress={onAddContact}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

export default ContactsScreen;
