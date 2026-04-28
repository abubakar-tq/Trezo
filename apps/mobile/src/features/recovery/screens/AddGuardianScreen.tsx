/**
 * AddGuardianScreen.tsx
 *
 * Add a new trusted contact for account recovery.
 *
 * Constraints Applied:
 * - Recovery UX: "Trusted Contact" terminology
 * - Rule of One: "Send Invite" primary button
 * - Trust Markers: Shield icon, "Secure invitation" microcopy
 * - Z-Pattern: Info top, action bottom
 * - Microcopy: Calm, reassuring tone
 * - Input validation and error handling
 */

import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

interface AddGuardianScreenProps {
  onSendInvite?: (contact: string) => void;
  onCancel?: () => void;
}

export const AddGuardianScreen: React.FC<AddGuardianScreenProps> = ({
  onSendInvite,
  onCancel,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [contact, setContact] = useState("");
  const [contactType, setContactType] = useState<"email" | "phone">("email");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const validateContact = (value: string): boolean => {
    if (!value.trim()) {
      setError("Please enter an email or phone number.");
      return false;
    }

    if (contactType === "email") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        setError("Please enter a valid email address.");
        return false;
      }
    } else {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(value.replace(/\s+/g, ""))) {
        setError("Please enter a valid phone number.");
        return false;
      }
    }

    setError("");
    return true;
  };

  const handleSendInvite = async () => {
    if (!validateContact(contact)) return;

    setIsSending(true);
    // Simulate sending invite (1-2 seconds)
    setTimeout(() => {
      onSendInvite?.(contact);
      setContact("");
      setIsSending(false);
    }, 1500);
  };

  const handleContactChange = (value: string) => {
    setContact(value);
    if (error) setError(""); // Clear error when user starts typing
  };

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
        {/* HEADER SECTION */}
        <View style={{ gap: 8 }}>
          <TouchableOpacity 
            onPress={onCancel}
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
            Add Trusted Contact
          </Text>
          <Text
            style={{
              fontSize: 15,
              color: colors.textSecondary,
            }}
          >
            Invite someone you trust to help protect your account in an emergency.
          </Text>
        </View>

        {/* BENEFITS SECTION */}
        <View
          style={{
            backgroundColor: withAlpha(colors.accent, 0.05),
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: withAlpha(colors.accent, 0.1),
          }}
        >
          <View style={{ gap: 16 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1,
                color: colors.accent,
              }}
            >
              WHY ADD A TRUSTED CONTACT?
            </Text>

            <View style={{ gap: 16 }}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View 
                  style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 18, 
                    backgroundColor: withAlpha(colors.accent, 0.1),
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🛡</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
                    Extra Security
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    Adds a layer of protection to your account
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View 
                  style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 18, 
                    backgroundColor: withAlpha(colors.accent, 0.1),
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}
                >
                  <Text style={{ fontSize: 16 }}>🔐</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
                    Account Recovery
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    They can help you regain access if you lose your device
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 12 }}>
                <View 
                  style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: 18, 
                    backgroundColor: withAlpha(colors.accent, 0.1),
                    alignItems: 'center', 
                    justifyContent: 'center' 
                  }}
                >
                  <Text style={{ fontSize: 16 }}>📱</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: colors.textPrimary }}>
                    You Stay in Control
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                    They can only help with recovery, not access your funds
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* INPUT SECTION */}
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: 24,
            padding: 20,
            borderWidth: 1,
            borderColor: colors.borderMuted,
          }}
        >
          <View style={{ gap: 16 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                letterSpacing: 1,
                color: colors.accent,
              }}
            >
              ENTER CONTACT INFORMATION
            </Text>

            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.textSecondary }}>
                {contactType === "email" ? "Email Address" : "Phone Number"}
              </Text>
              <TextInput
                style={{
                  backgroundColor: withAlpha(colors.textPrimary, 0.03),
                  borderRadius: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  color: colors.textPrimary,
                  fontSize: 16,
                  borderWidth: 1,
                  borderColor: error ? colors.danger : colors.borderMuted,
                }}
                placeholder={
                  contactType === "email"
                    ? "contact@example.com"
                    : "+1 (555) 123-4567"
                }
                placeholderTextColor={colors.textMuted}
                value={contact}
                onChangeText={handleContactChange}
                editable={!isSending}
                keyboardType={contactType === "email" ? "email-address" : "phone-pad"}
                autoCapitalize="none"
              />
              {error ? (
                <Text style={{ fontSize: 12, color: colors.danger, marginTop: 4 }}>
                  {error}
                </Text>
              ) : null}
            </View>

            {/* CONTACT TYPE TOGGLE */}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setContactType("email");
                  setError("");
                }}
                disabled={isSending}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: contactType === 'email' ? withAlpha(colors.accent, 0.1) : 'transparent',
                  borderWidth: 1,
                  borderColor: contactType === 'email' ? colors.accent : colors.borderMuted,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: contactType === 'email' ? colors.accent : colors.textSecondary, fontWeight: '700' }}>
                  📧 Email
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setContactType("phone");
                  setError("");
                }}
                disabled={isSending}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor: contactType === 'phone' ? withAlpha(colors.accent, 0.1) : 'transparent',
                  borderWidth: 1,
                  borderColor: contactType === 'phone' ? colors.accent : colors.borderMuted,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: contactType === 'phone' ? colors.accent : colors.textSecondary, fontWeight: '700' }}>
                  📱 Phone
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* HOW IT WORKS */}
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
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.textPrimary }}>
              What happens next?
            </Text>
            <View style={{ gap: 8 }}>
              {[
                `1. We send a secure invitation to ${contactType === "email" ? "their email" : "their phone"}`,
                "2. They verify their identity and accept the invitation",
                "3. Once verified, they become an active trusted contact",
                "4. They'll be notified if recovery is needed"
              ].map((step, idx) => (
                <Text key={idx} style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 20 }}>
                  {step}
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* TRUST MARKER */}
        <View
          style={{
            flexDirection: "row",
            gap: 12,
            alignItems: "center",
            paddingHorizontal: 8,
          }}
        >
          <Text style={{ fontSize: 20 }}>🛡</Text>
          <Text
            style={{ fontSize: 13, fontWeight: "600", color: colors.success }}
          >
            All invitations are encrypted and secure
          </Text>
        </View>

        {/* ACTIONS */}
        <View style={{ gap: 12, marginTop: 8 }}>
          <TouchableOpacity
            onPress={handleSendInvite}
            disabled={isSending || !contact.trim()}
            activeOpacity={0.85}
            style={{
              backgroundColor: colors.accent,
              borderRadius: 16,
              paddingVertical: 16,
              alignItems: "center",
              flexDirection: 'row',
              justifyContent: 'center',
              gap: 8,
              opacity: isSending || !contact.trim() ? 0.6 : 1,
            }}
          >
            {isSending && <ActivityIndicator color={colors.textOnAccent} size="small" />}
            <Text
              style={{
                color: colors.textOnAccent,
                fontSize: 16,
                fontWeight: "700",
              }}
            >
              {isSending ? "Sending..." : "Send Invite"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onCancel}
            disabled={isSending}
            activeOpacity={0.7}
            style={{
              paddingVertical: 12,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddGuardianScreen;

