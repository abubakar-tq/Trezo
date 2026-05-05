/**
 * GuardianManagementScreen.tsx
 *
 * Manage active and pending trusted contacts with full lifecycle visibility.
 *
 * Displays:
 * - Active trusted contacts list
 * - Collapsible "Removed Contacts" section (audit trail)
 * - Add new contact CTA
 * - Key information about guardian roles
 *
 * Constraints Applied:
 * - Recovery UX: "Trusted Contact" terminology
 * - Removed contacts visible (audit trail)
 * - Hold-to-confirm for destructive actions (implied in UI)
 * - Premium design system integration
 */

import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";
import {
  GuardianListItem,
  GuardianListShowcase,
} from "../../../shared/components/Tier2/GuardianListItem";

interface GuardianManagementScreenProps {
  onAddContact?: () => void;
  onEditContact?: (id: string) => void;
  onRemoveContact?: (id: string) => void;
  onBack?: () => void;
}

export const GuardianManagementScreen: React.FC<
  GuardianManagementScreenProps
> = ({ onAddContact, onEditContact, onRemoveContact, onBack }) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [showRemovedContacts, setShowRemovedContacts] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // Mock data - in production these would come from useRecoveryStatusStore
  const activeGuardians = [
    {
      id: "1",
      name: "Alice Johnson",
      contact: "alice@example.com",
      status: "active" as const,
    },
    {
      id: "2",
      name: "Bob Smith",
      contact: "bob@example.com",
      status: "pending" as const,
    },
  ];

  const removedGuardians = [
    {
      id: "3",
      name: "Carol White",
      contact: "carol@example.com",
      status: "removed" as const,
      timestamp: "Removed on March 15, 2026",
    },
  ];

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.background,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingVertical: 24,
          gap: 24,
          paddingBottom: 40,
        }}
      >
        {/* HEADER SECTION */}
        <View style={{ gap: 8 }}>
          <TouchableOpacity 
            onPress={onBack}
            style={{ 
              marginBottom: 8,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: withAlpha(colors.textPrimary, 0.05),
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '700' }}>←</Text>
          </TouchableOpacity>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: colors.textPrimary,
            }}
          >
            Trusted Contacts
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            Manage the people you trust to help protect and recover your account.
          </Text>
        </View>

        {/* ACTIVE CONTACTS SECTION */}
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1,
                color: colors.accent,
              }}
            >
              ACTIVE CONTACTS ({activeGuardians.length})
            </Text>
          </View>

          {activeGuardians.length > 0 ? (
            <View style={{ gap: 12 }}>
              {activeGuardians.map((guardian) => (
                <GuardianListItem
                  key={guardian.id}
                  state={guardian.status}
                  name={guardian.name}
                  contact={guardian.contact}
                  editable={true}
                  onEdit={() => onEditContact?.(guardian.id)}
                  onRemove={() => onRemoveContact?.(guardian.id)}
                />
              ))}
            </View>
          ) : (
            <View
              style={{
                backgroundColor: withAlpha(colors.textPrimary, 0.03),
                borderRadius: 20,
                padding: 32,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.borderMuted,
                borderStyle: 'dashed'
              }}
            >
              <Text style={{ fontSize: 32, marginBottom: 12 }}>👥</Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.textSecondary,
                  textAlign: "center",
                  lineHeight: 20
                }}
              >
                No trusted contacts yet. Add your first one to increase your security score.
              </Text>
            </View>
          )}
        </View>

        {/* ADD CONTACT CTA */}
        <TouchableOpacity
          onPress={onAddContact}
          activeOpacity={0.85}
          style={{
            backgroundColor: colors.accent,
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: "center",
            shadowColor: colors.accent,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4
          }}
        >
          <Text
            style={{
              color: colors.textOnAccent,
              fontSize: 16,
              fontWeight: "700",
            }}
          >
            + Add Trusted Contact
          </Text>
        </TouchableOpacity>

        {/* INFO CARD */}
        <View
          style={{
            backgroundColor: withAlpha(colors.textPrimary, 0.03),
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1,
                color: colors.accent,
              }}
            >
              KEY INFORMATION
            </Text>
            <View style={{ gap: 10 }}>
              {[
                "Trusted contacts must verify their identity via email or phone",
                "Once verified, they gain the ability to approve recovery requests",
                "You control the approval threshold in the next step",
                "Removing a contact doesn't affect pending recovery requests"
              ].map((info, idx) => (
                <View key={idx} style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>•</Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18, flex: 1 }}>
                    {info}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* AUDIT TRAIL / REMOVED CONTACTS */}
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 24,
            padding: 4,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowRemovedContacts(!showRemovedContacts)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 14,
                fontWeight: "700",
              }}
            >
              Audit Trail ({removedGuardians.length})
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {showRemovedContacts ? "Hide" : "Show"}
            </Text>
          </TouchableOpacity>

          {showRemovedContacts && (
            <View
              style={{
                padding: 12,
                gap: 12,
                borderTopWidth: 1,
                borderTopColor: colors.borderMuted,
              }}
            >
              {removedGuardians.map((guardian) => (
                <GuardianListItem
                  key={guardian.id}
                  state="removed"
                  name={guardian.name}
                  contact={guardian.contact}
                  removedDate={guardian.timestamp}
                  editable={false}
                />
              ))}
              <Text
                style={{
                  fontSize: 11,
                  color: colors.textMuted,
                  textAlign: 'center',
                  marginTop: 4,
                  paddingHorizontal: 12
                }}
              >
                Historical record of contacts helping you maintain security oversight.
              </Text>
            </View>
          )}
        </View>

        {/* DEBUG / QA SECTION (Subtle) */}
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={() => setShowDebug(!showDebug)}
            style={{ padding: 8 }}
          >
            <Text style={{ fontSize: 10, color: colors.textMuted, letterSpacing: 1 }}>
              {showDebug ? "HIDE UI REFERENCE" : "SHOW UI REFERENCE"}
            </Text>
          </TouchableOpacity>
          
          {showDebug && (
            <View style={{ width: '100%', marginTop: 16, gap: 16 }}>
               <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1,
                  color: colors.warning,
                  textAlign: 'center'
                }}
              >
                LIFECYCLE STATE SHOWCASE
              </Text>
              <GuardianListShowcase />
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default GuardianManagementScreen;

