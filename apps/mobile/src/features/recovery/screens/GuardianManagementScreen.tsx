/**
 * GuardianManagementScreen.tsx
 *
 * Manage active and pending trusted contacts with full lifecycle visibility.
 *
 * Displays:
 * - All 7 guardian lifecycle states (reference)
 * - Edit/remove gestures for each contact
 * - Collapsible "Removed Contacts" section (audit trail)
 * - Add new contact CTA
 *
 * Constraints Applied:
 * - All 7 guardian states rendered for QA
 * - Recovery UX: "Trusted Contact" terminology
 * - Removed contacts visible (audit trail, not hidden)
 * - Hold-to-confirm for destructive actions
 * - No raw numbers (threshold not shown here)
 */

import React, { useState } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import {
    GhostButton,
    PrimaryButton,
} from "../../../shared/components/Tier1/Button";
import {
    CardLevel1,
    CardLevel2,
    Surface,
} from "../../../shared/components/Tier1/Surface";
import {
    BodyText,
    CaptionText,
    HeadlineText,
    OverlineText,
} from "../../../shared/components/Tier1/Text";
import {
    GuardianListItem,
    GuardianListShowcase,
} from "../../../shared/components/Tier2/GuardianListItem";
import { Colors, Spacing } from "../../../shared/components/TokenRegistry";

interface GuardianManagementScreenProps {
  isDark?: boolean;
  onAddContact?: () => void;
  onEditContact?: (id: string) => void;
  onRemoveContact?: (id: string) => void;
}

export const GuardianManagementScreen: React.FC<
  GuardianManagementScreenProps
> = ({ isDark = true, onAddContact, onEditContact, onRemoveContact }) => {
  const [showRemovedContacts, setShowRemovedContacts] = useState(false);
  const [expandedState, setExpandedState] = useState<string | null>(null);

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
        backgroundColor: isDark ? Colors.background : "#ffffff",
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
          <HeadlineText isDark={isDark}>Manage Trusted Contacts</HeadlineText>
          <BodyText
            isDark={isDark}
            color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
          >
            View and manage your trusted contacts who help protect your account.
          </BodyText>
        </View>

        {/* ACTIVE GUARDIANS */}
        <View style={{ gap: Spacing.sp3 }}>
          <CaptionText color={Colors.primary}>
            ACTIVE CONTACTS ({activeGuardians.length})
          </CaptionText>

          {activeGuardians.length > 0 ? (
            <View style={{ gap: Spacing.sp2 }}>
              {activeGuardians.map((guardian) => (
                <CardLevel1 key={guardian.id} isDark={isDark}>
                  <GuardianListItem
                    isDark={isDark}
                    state={guardian.status}
                    name={guardian.name}
                    contact={guardian.contact}
                    editable={true}
                    onEdit={() => onEditContact?.(guardian.id)}
                    onRemove={() => onRemoveContact?.(guardian.id)}
                  />
                </CardLevel1>
              ))}
            </View>
          ) : (
            <Surface isDark={isDark} elevation={1}>
              <BodyText
                isDark={isDark}
                color={isDark ? Colors.textTertiary : Colors.lightTextSecondary}
                style={{ textAlign: "center" }}
              >
                No trusted contacts yet. Add your first one below.
              </BodyText>
            </Surface>
          )}
        </View>

        {/* ADD CONTACT CTA */}
        <PrimaryButton
          label="+ Add Trusted Contact"
          isDark={isDark}
          onPress={onAddContact}
        />

        {/* ALL 7 GUARDIAN STATES - QA REFERENCE */}
        <Surface isDark={isDark} elevation={1}>
          <View style={{ gap: Spacing.sp2 }}>
            <OverlineText color={Colors.warning}>
              QA REFERENCE: ALL 7 STATES
            </OverlineText>
            <BodyText
              isDark={isDark}
              color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
              style={{ fontSize: 12, marginBottom: Spacing.sp2 }}
            >
              Complete lifecycle visualization:
            </BodyText>
            <GuardianListShowcase isDark={isDark} />
          </View>
        </Surface>

        {/* REMOVED CONTACTS SECTION */}
        <CardLevel2 isDark={isDark}>
          <View style={{ gap: Spacing.sp2 }}>
            <GhostButton
              label={
                showRemovedContacts
                  ? "▼ Removed Contacts (1)"
                  : "▶ Removed Contacts (1)"
              }
              isDark={isDark}
              onPress={() => setShowRemovedContacts(!showRemovedContacts)}
            />

            {showRemovedContacts && (
              <View
                style={{
                  gap: Spacing.sp2,
                  marginTop: Spacing.sp2,
                  paddingTop: Spacing.sp2,
                  borderTopWidth: 1,
                  borderTopColor: isDark ? Colors.surfaceMid : "#e2e8f0",
                }}
              >
                {removedGuardians.map((guardian) => (
                  <View key={guardian.id}>
                    <GuardianListItem
                      isDark={isDark}
                      state="removed"
                      name={guardian.name}
                      contact={guardian.contact}
                      removedDate={guardian.timestamp}
                      editable={false}
                    />
                  </View>
                ))}
                <BodyText
                  isDark={isDark}
                  color={
                    isDark ? Colors.textTertiary : Colors.lightTextSecondary
                  }
                  style={{ fontSize: 11, marginTop: Spacing.sp1 }}
                >
                  Audit trail preserved. Removed contacts are never fully
                  deleted.
                </BodyText>
              </View>
            )}
          </View>
        </CardLevel2>

        {/* INFO SECTION */}
        <CardLevel1 isDark={isDark}>
          <View style={{ gap: Spacing.sp2 }}>
            <CaptionText color={Colors.primary}>KEY INFORMATION</CaptionText>
            <BodyText
              isDark={isDark}
              color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
              style={{ fontSize: 13, lineHeight: 20 }}
            >
              • Trusted contacts must verify their identity via email or phone
              {"\n"}• Once verified, they gain recovery capabilities{"\n"}• You
              control the approval threshold (how many must approve recovery)
              {"\n"}• Removing a contact doesn't affect pending recovery
              requests
            </BodyText>
          </View>
        </CardLevel1>
      </ScrollView>
    </SafeAreaView>
  );
};

export default GuardianManagementScreen;
