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
import { SafeAreaView, ScrollView, View } from "react-native";
import {
    GhostButton,
    PrimaryButton,
} from "../../../shared/components/Tier1/Button";
import { Input } from "../../../shared/components/Tier1/Input";
import { CardLevel1, Surface } from "../../../shared/components/Tier1/Surface";
import {
    BodyText,
    CaptionText,
    HeadlineText,
    TitleText,
} from "../../../shared/components/Tier1/Text";
import { Colors, Spacing } from "../../../shared/components/TokenRegistry";

interface AddGuardianScreenProps {
  isDark?: boolean;
  onSendInvite?: (contact: string) => void;
  onCancel?: () => void;
}

export const AddGuardianScreen: React.FC<AddGuardianScreenProps> = ({
  isDark = true,
  onSendInvite,
  onCancel,
}) => {
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
        {/* HERO SECTION */}
        <View style={{ gap: Spacing.sp2 }}>
          <HeadlineText isDark={isDark}>Add a Trusted Contact</HeadlineText>
          <BodyText
            isDark={isDark}
            color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
          >
            Invite someone you trust to help protect your account in an
            emergency.
          </BodyText>
        </View>

        {/* BENEFITS SECTION */}
        <Surface isDark={isDark} elevation={1}>
          <View style={{ gap: Spacing.sp3 }}>
            <CaptionText color={Colors.primary}>
              WHY ADD A TRUSTED CONTACT?
            </CaptionText>

            <View style={{ gap: Spacing.sp2 }}>
              <View style={{ flexDirection: "row", gap: Spacing.sp2 }}>
                <BodyText isDark={isDark} style={{ fontSize: 18 }}>
                  🛡
                </BodyText>
                <BodyText isDark={isDark} style={{ flex: 1 }}>
                  <BodyText isDark={isDark} style={{ fontWeight: "bold" }}>
                    Extra Security
                  </BodyText>
                  {"\n"}
                  <BodyText
                    isDark={isDark}
                    color={
                      isDark ? Colors.textSecondary : Colors.lightTextSecondary
                    }
                    style={{ fontSize: 13 }}
                  >
                    Adds a layer of protection to your account
                  </BodyText>
                </BodyText>
              </View>

              <View style={{ flexDirection: "row", gap: Spacing.sp2 }}>
                <BodyText isDark={isDark} style={{ fontSize: 18 }}>
                  🔐
                </BodyText>
                <BodyText isDark={isDark} style={{ flex: 1 }}>
                  <BodyText isDark={isDark} style={{ fontWeight: "bold" }}>
                    Account Recovery
                  </BodyText>
                  {"\n"}
                  <BodyText
                    isDark={isDark}
                    color={
                      isDark ? Colors.textSecondary : Colors.lightTextSecondary
                    }
                    style={{ fontSize: 13 }}
                  >
                    They can help you regain access if you lose your device
                  </BodyText>
                </BodyText>
              </View>

              <View style={{ flexDirection: "row", gap: Spacing.sp2 }}>
                <BodyText isDark={isDark} style={{ fontSize: 18 }}>
                  📱
                </BodyText>
                <BodyText isDark={isDark} style={{ flex: 1 }}>
                  <BodyText isDark={isDark} style={{ fontWeight: "bold" }}>
                    You Stay in Control
                  </BodyText>
                  {"\n"}
                  <BodyText
                    isDark={isDark}
                    color={
                      isDark ? Colors.textSecondary : Colors.lightTextSecondary
                    }
                    style={{ fontSize: 13 }}
                  >
                    They can only help with recovery, not access your funds
                  </BodyText>
                </BodyText>
              </View>
            </View>
          </View>
        </Surface>

        {/* INPUT SECTION */}
        <CardLevel1 isDark={isDark}>
          <View style={{ gap: Spacing.sp3 }}>
            <CaptionText color={Colors.primary}>
              ENTER CONTACT INFORMATION
            </CaptionText>

            <Input
              isDark={isDark}
              label={`${contactType === "email" ? "Email Address" : "Phone Number"}`}
              placeholder={
                contactType === "email"
                  ? "contact@example.com"
                  : "+1 (555) 123-4567"
              }
              value={contact}
              onChangeText={handleContactChange}
              editable={!isSending}
              errorMessage={error}
            />

            {/* CONTACT TYPE TOGGLE */}
            <View style={{ flexDirection: "row", gap: Spacing.sp2 }}>
              <GhostButton
                label="📧 Email"
                isDark={isDark}
                onPress={() => {
                  setContactType("email");
                  setError("");
                }}
                disabled={isSending}
              />
              <GhostButton
                label="📱 Phone"
                isDark={isDark}
                onPress={() => {
                  setContactType("phone");
                  setError("");
                }}
                disabled={isSending}
              />
            </View>
          </View>
        </CardLevel1>

        {/* HOW IT WORKS */}
        <Surface isDark={isDark} elevation={1}>
          <View style={{ gap: Spacing.sp2 }}>
            <TitleText isDark={isDark}>What happens next?</TitleText>
            <BodyText
              isDark={isDark}
              color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
              style={{ fontSize: 13, lineHeight: 20 }}
            >
              1. We send a secure invitation to{" "}
              {contactType === "email" ? "their email" : "their phone"}
              {"\n"}
              2. They verify their identity and accept the invitation{"\n"}
              3. Once verified, they become an active trusted contact{"\n"}
              4. They'll be notified if recovery is needed
            </BodyText>
          </View>
        </Surface>

        {/* TRUST MARKER */}
        <CardLevel1 isDark={isDark}>
          <View
            style={{
              flexDirection: "row",
              gap: Spacing.sp2,
              alignItems: "center",
            }}
          >
            <BodyText isDark={isDark} style={{ fontSize: 20 }}>
              🛡
            </BodyText>
            <BodyText
              isDark={isDark}
              color={Colors.success}
              style={{ fontSize: 13, fontWeight: "600" }}
            >
              All invitations are encrypted and secure
            </BodyText>
          </View>
        </CardLevel1>

        {/* ACTIONS */}
        <View style={{ gap: Spacing.sp2 }}>
          <PrimaryButton
            label={isSending ? "Sending..." : "Send Invite"}
            isDark={isDark}
            onPress={handleSendInvite}
            isLoading={isSending}
            disabled={isSending || !contact.trim()}
          />

          <GhostButton
            label="Cancel"
            isDark={isDark}
            onPress={onCancel}
            disabled={isSending}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default AddGuardianScreen;
