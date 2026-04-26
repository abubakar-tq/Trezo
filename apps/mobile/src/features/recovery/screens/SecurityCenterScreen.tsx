/**
 * SecurityCenterScreen.tsx
 *
 * Hero feature: Complete recovery and security management hub
 *
 * Displays:
 * - Full Recovery Score widget with breakdown
 * - Active guardians summary
 * - Removed contacts (audit trail)
 * - Three primary actions: Manage Guardians, Configure Threshold, Add Contact
 */

import React, { useState } from "react";
import { SafeAreaView, ScrollView, View, Text, TouchableOpacity } from "react-native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

interface SecurityCenterScreenProps {
  onManageGuardians?: () => void;
  onConfigureThreshold?: () => void;
  onAddContact?: () => void;
}

export const SecurityCenterScreen: React.FC<SecurityCenterScreenProps> = ({
  onManageGuardians,
  onConfigureThreshold,
  onAddContact,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [showRemovedContacts, setShowRemovedContacts] = useState(false);

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
          paddingBottom: 32,
        }}
      >
        {/* HERO SECTION */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.textPrimary }}>Security Center</Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            Manage your recovery options and trusted contacts.
          </Text>
        </View>

        {/* RECOVERY SCORE - FULL WIDGET */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 8 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 20 }}>🛡</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colors.accent }}>
                YOUR SECURITY SCORE
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <View style={{ gap: 4 }}>
                <Text style={{ fontSize: 32, fontWeight: "800", color: colors.textPrimary }}>85/100</Text>
                <Text style={{ fontSize: 13, color: colors.success, fontWeight: "600" }}>Very Strong</Text>
              </View>
              <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 6, borderColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: "800", color: colors.success }}>85%</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ACTIVE GUARDIANS SUMMARY */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colors.accent }}>
                ACTIVE TRUSTED CONTACTS
              </Text>
              <Text
                style={{ fontSize: 13, color: colors.accent, fontWeight: "700" }}
              >
                1 of 3
              </Text>
            </View>

            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              You have 1 active trusted contact helping to protect your account.
            </Text>

            <TouchableOpacity
              onPress={onManageGuardians}
              activeOpacity={0.85}
              style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 8 }}
            >
              <Text style={{ color: colors.textOnAccent, fontSize: 15, fontWeight: "700" }}>Manage Guardians</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* APPROVAL REQUIREMENT CONFIGURATION */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colors.accent }}>
              APPROVAL REQUIREMENT
            </Text>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 15, color: colors.textPrimary }}>
                Currently:{" "}
                <Text style={{ fontWeight: "700" }}>
                  2 out of 3
                </Text>
              </Text>
              <Text
                style={{ fontSize: 13, color: colors.textSecondary }}
              >
                Your trusted contacts must collectively approve any recovery
                request.
              </Text>
            </View>

            <TouchableOpacity
              onPress={onConfigureThreshold}
              activeOpacity={0.85}
              style={{ backgroundColor: withAlpha(colors.accent, 0.1), borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 8 }}
            >
              <Text style={{ color: colors.accent, fontSize: 15, fontWeight: "700" }}>Configure Threshold</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* QUICK ADD CONTACT */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 1, color: colors.accent }}>
              ADD ANOTHER CONTACT
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: colors.textSecondary,
              }}
            >
              Increase your Security Score by adding more trusted contacts.
            </Text>

            <TouchableOpacity
              onPress={onAddContact}
              activeOpacity={0.85}
              style={{ backgroundColor: colors.accent, borderRadius: 16, paddingVertical: 14, alignItems: "center", marginTop: 8 }}
            >
              <Text style={{ color: colors.textOnAccent, fontSize: 15, fontWeight: "700" }}>Add Trusted Contact</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* REMOVED CONTACTS (AUDIT TRAIL) */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 12, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 8 }}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowRemovedContacts(!showRemovedContacts)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8 }}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "600" }}>
                {showRemovedContacts
                  ? "▼ Removed Contacts (1)"
                  : "▶ Removed Contacts (1)"}
              </Text>
            </TouchableOpacity>

            {showRemovedContacts && (
              <View
                style={{
                  gap: 12,
                  marginTop: 8,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: colors.borderMuted,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: colors.background, borderRadius: 12 }}>
                   <View style={{ gap: 4 }}>
                     <Text style={{ fontWeight: "700", color: colors.textPrimary }}>Alice Johnson</Text>
                     <Text style={{ fontSize: 12, color: colors.textSecondary }}>alice@example.com</Text>
                   </View>
                   <Text style={{ fontSize: 11, color: colors.textMuted }}>Removed Mar 15</Text>
                </View>
                <Text
                  style={{ fontSize: 11, color: colors.textMuted, textAlign: 'center' }}
                >
                  Audit trail preserved for security.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* HELP SECTION */}
        <View style={{ backgroundColor: colors.surfaceCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: colors.borderMuted }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>How does recovery work?</Text>
            <Text
              style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}
            >
              If you ever lose access to your device, your trusted contacts can
              help you regain control of your account. They verify your identity
              and collectively approve recovery requests.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default SecurityCenterScreen;
