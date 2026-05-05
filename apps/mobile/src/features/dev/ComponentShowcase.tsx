// @ts-nocheck — Dev-only showcase; Tier1/2/3 component paths may be stale
/**
 * ComponentShowcase.tsx
 * Development Screen: Visual QA for all UI components and screens
 *
 * This hidden screen renders:
 * - All Tier 1 atomic primitives (Text, Button, Surface, Badge, Input)
 * - All Tier 2 composed components (ProgressStepper, GuardianListItem, ConfirmationModal)
 * - All Tier 3 feature components (RecoveryScoreWidget, WalletBalanceCard, BiometricPrompt)
 * - Stage 5.1 Screens: Complete onboarding flow
 */

import React, { useState } from "react";
import {
    Text as RNText,
    SafeAreaView,
    ScrollView,
    Switch,
    View,
} from "react-native";

// Tier 1 Components
import { Badge } from "../../../shared/components/Tier1/Badge";
import {
    GhostButton,
    PrimaryButton,
    SecondaryButton,
    TertiaryButton,
} from "../../../shared/components/Tier1/Button";
import { Input } from "../../../shared/components/Tier1/Input";
import {
    CardLevel1,
    CardLevel2,
    CardLevel3,
    Surface,
} from "../../../shared/components/Tier1/Surface";
import {
    BodyText,
    CaptionText,
    DisplayText,
    HeadlineText,
    OverlineText,
    TitleText,
} from "../../../shared/components/Tier1/Text";

// Tier 2 Components
import { ConfirmationModal } from "../../../shared/components/Tier2/ConfirmationModal";
import {
    GuardianListShowcase
} from "../../../shared/components/Tier2/GuardianListItem";
import { ProgressStepper } from "../../../shared/components/Tier2/ProgressStepper";

// Tier 3 Components
import { BiometricPrompt } from "../../../shared/components/Tier3/BiometricPrompt";
import { RecoveryScoreWidget } from "../../../shared/components/Tier3/RecoveryScoreWidget";
import { WalletBalanceCard } from "../../../shared/components/Tier3/WalletBalanceCard";

// Screens (Stage 5.1)
import {
    AccountCreatedScreen,
    BiometricSetupScreen,
    InitialGuardianSetupScreen,
    PasskeyCreationScreen,
    WelcomeScreen,
} from "../auth/screens";

// Theme
import { useAppTheme } from "@theme";
import { Spacing } from "../../../shared/components/TokenRegistry";

type ShowcaseSection = "tier1" | "tier2" | "tier3" | "screens" | "all";

export const ComponentShowcase: React.FC = () => {
  const { theme: { colors }, resolvedMode } = useAppTheme();
  const [activeSection, setActiveSection] = useState<ShowcaseSection>("tier1");
  const [showModal, setShowModal] = useState(false);

  const renderHeader = () => (
    <Surface elevation={2}>
      <View
        style={{
          padding: Spacing.sp4,
          gap: Spacing.sp3,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View style={{ gap: Spacing.sp2 }}>
          <HeadlineText>Component Showcase</HeadlineText>
          <BodyText color={colors.textSecondary}>
            Visual QA for Design System (Stage 4 + 5.1)
          </BodyText>
        </View>

        {/* Theme info */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <RNText style={{ color: colors.textPrimary }}>
            Theme: {resolvedMode === "dark" ? "Dark" : "Light"}
          </RNText>
        </View>
      </View>
    </Surface>
  );

  const renderTier1 = () => (
    <ScrollView
      contentContainerStyle={{ padding: Spacing.sp4, gap: Spacing.sp6 }}
    >
      {/* TYPOGRAPHY */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>TIER 1: TYPOGRAPHY</OverlineText>
          <DisplayText>Display (32px)</DisplayText>
          <HeadlineText>Headline (24px)</HeadlineText>
          <TitleText>Title (20px)</TitleText>
          <BodyText>Body (16px)</BodyText>
          <CaptionText>Caption (14px)</CaptionText>
          <OverlineText>Overline (12px)</OverlineText>
        </View>
      </Surface>

      {/* BUTTONS — all variants */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>TIER 1: BUTTONS — VARIANTS</OverlineText>
          <PrimaryButton
            label="Primary"
            onPress={() => {}}
          />
          <SecondaryButton
            label="Secondary"
            onPress={() => {}}
          />
          <TertiaryButton
            label="Tertiary"
            onPress={() => {}}
          />
          <GhostButton
            label="Ghost"
            onPress={() => {}}
          />
          {/* Outline variant — pass variant prop if Button supports it */}
          <SecondaryButton
            label="Outline"
            onPress={() => {}}
            variant="outline"
          />
          {/* Danger variant */}
          <PrimaryButton
            label="Danger"
            onPress={() => {}}
            variant="danger"
          />
          {/* Gradient variant */}
          <PrimaryButton
            label="Gradient"
            onPress={() => {}}
            variant="gradient"
          />
          <PrimaryButton
            label="Loading..."
            onPress={() => {}}
            isLoading
            disabled
          />
          <PrimaryButton
            label="Disabled"
            onPress={() => {}}
            disabled
          />
        </View>
      </Surface>

      {/* SURFACES / CARD VARIANTS */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>TIER 1: CARD VARIANTS</OverlineText>
          {/* Default */}
          <CardLevel1>
            <BodyText>Card — Default (Elevation: 2)</BodyText>
          </CardLevel1>
          {/* Elevated */}
          <CardLevel2>
            <BodyText>Card — Elevated (Elevation: 4)</BodyText>
          </CardLevel2>
          {/* Glass */}
          <CardLevel3>
            <BodyText>Card — Glass (Elevation: 8)</BodyText>
          </CardLevel3>
          {/* Surface elevations */}
          <Surface elevation={0}>
            <BodyText>Surface elevation 0</BodyText>
          </Surface>
          <Surface elevation={1}>
            <BodyText>Surface elevation 1</BodyText>
          </Surface>
          <Surface elevation={2}>
            <BodyText>Surface elevation 2</BodyText>
          </Surface>
        </View>
      </Surface>

      {/* BADGES */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>TIER 1: BADGES</OverlineText>
          <View
            style={{ flexDirection: "row", gap: Spacing.sp2, flexWrap: "wrap" }}
          >
            <Badge status="active" label="Active" />
            <Badge status="pending" label="Pending" />
            <Badge status="inactive" label="Inactive" />
            <Badge status="warning" label="Warning" />
            <Badge status="danger" label="Danger" />
          </View>
        </View>
      </Surface>

      {/* INPUT */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>TIER 1: INPUT</OverlineText>
          <Input
            label="Email Address"
            placeholder="user@example.com"
            value=""
            onChangeText={() => {}}
          />
          <Input
            label="With Error"
            placeholder="Invalid input"
            value=""
            onChangeText={() => {}}
            error="This field is required"
          />
          <Input
            label="With Lock Icon"
            placeholder="Password"
            value=""
            onChangeText={() => {}}
            showLockIcon
          />
        </View>
      </Surface>
    </ScrollView>
  );

  const renderTier2 = () => (
    <ScrollView
      contentContainerStyle={{ padding: Spacing.sp4, gap: Spacing.sp6 }}
    >
      {/* PROGRESS STEPPER */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>
            TIER 2: PROGRESS STEPPER
          </OverlineText>
          <ProgressStepper
            steps={[
              { label: "Create Passkey", completed: true },
              { label: "Enable Biometrics", completed: true },
              { label: "Add Contacts" },
            ]}
            currentStep={2}
          />
        </View>
      </Surface>

      {/* GUARDIAN LIST - ALL 7 STATES */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>
            TIER 2: GUARDIAN LIST ITEM (ALL 7 STATES)
          </OverlineText>
          <GuardianListShowcase />
        </View>
      </Surface>

      {/* CONFIRMATION MODAL */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>
            TIER 2: CONFIRMATION MODAL
          </OverlineText>
          <PrimaryButton
            label="Open Modal (Rule of One)"
            onPress={() => setShowModal(true)}
          />
          {showModal && (
            <ConfirmationModal
              isVisible={showModal}
              title="Are you sure?"
              message="This action cannot be undone."
              primaryLabel="Delete"
              secondaryLabel="Cancel"
              onPrimaryPress={() => setShowModal(false)}
              onSecondaryPress={() => setShowModal(false)}
            />
          )}
        </View>
      </Surface>
    </ScrollView>
  );

  const renderTier3 = () => (
    <ScrollView
      contentContainerStyle={{ padding: Spacing.sp4, gap: Spacing.sp6 }}
    >
      {/* RECOVERY SCORE WIDGET */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>
            TIER 3: RECOVERY SCORE WIDGET
          </OverlineText>
          <RecoveryScoreWidget score={85} />
        </View>
      </Surface>

      {/* WALLET BALANCE CARD */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>
            TIER 3: WALLET BALANCE CARD
          </OverlineText>
          <WalletBalanceCard />
        </View>
      </Surface>

      {/* BIOMETRIC PROMPT */}
      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={colors.accent}>
            TIER 3: BIOMETRIC PROMPT
          </OverlineText>
          <BiometricPrompt type="face" />
          <BiometricPrompt type="touch" />
          <BiometricPrompt type="none" />
        </View>
      </Surface>
    </ScrollView>
  );

  const renderScreens = () => (
    <ScrollView
      contentContainerStyle={{ padding: Spacing.sp4, gap: Spacing.sp6 }}
    >
      <OverlineText color={colors.accent}>
        STAGE 5.1: ONBOARDING SCREENS
      </OverlineText>

      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText>1. Welcome Screen</BodyText>
          <WelcomeScreen
            onCreateAccount={() => {}}
            onSignIn={() => {}}
          />
        </View>
      </Surface>

      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText>2. Passkey Creation Screen</BodyText>
          <PasskeyCreationScreen />
        </View>
      </Surface>

      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText>3. Biometric Setup Screen</BodyText>
          <BiometricSetupScreen />
        </View>
      </Surface>

      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText>4. Account Created Screen</BodyText>
          <AccountCreatedScreen />
        </View>
      </Surface>

      <Surface elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText>5. Initial Guardian Setup Screen</BodyText>
          <InitialGuardianSetupScreen />
        </View>
      </Surface>
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {renderHeader()}

      {/* SECTION TABS */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: Spacing.sp2,
          paddingVertical: Spacing.sp2,
          gap: Spacing.sp1,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        {(["tier1", "tier2", "tier3", "screens"] as ShowcaseSection[]).map(
          (section) => (
            <SecondaryButton
              key={section}
              label={section.toUpperCase()}
              onPress={() => setActiveSection(section)}
              disabled={activeSection !== section}
            />
          ),
        )}
      </View>

      {/* CONTENT */}
      {activeSection === "tier1" && renderTier1()}
      {activeSection === "tier2" && renderTier2()}
      {activeSection === "tier3" && renderTier3()}
      {activeSection === "screens" && renderScreens()}
    </SafeAreaView>
  );
};

export default ComponentShowcase;
