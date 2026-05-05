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

// Design Tokens
import { Colors, Spacing } from "../../../shared/components/TokenRegistry";

type ShowcaseSection = "tier1" | "tier2" | "tier3" | "screens" | "all";

export const ComponentShowcase: React.FC = () => {
  const [isDark, setIsDark] = useState(true);
  const [activeSection, setActiveSection] = useState<ShowcaseSection>("tier1");
  const [showModal, setShowModal] = useState(false);

  const bgColor = isDark ? Colors.background : "#ffffff";
  const textColor = isDark ? Colors.textPrimary : Colors.lightTextPrimary;

  const renderHeader = () => (
    <Surface isDark={isDark} elevation={2}>
      <View
        style={{
          padding: Spacing.sp4,
          gap: Spacing.sp3,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? Colors.surfaceMid : "#e2e8f0",
        }}
      >
        <View style={{ gap: Spacing.sp2 }}>
          <HeadlineText isDark={isDark}>Component Showcase</HeadlineText>
          <BodyText
            isDark={isDark}
            color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
          >
            Visual QA for Design System (Stage 4 + 5.1)
          </BodyText>
        </View>

        {/* Theme Toggle */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <RNText style={{ color: textColor }}>Dark Mode</RNText>
          <Switch value={isDark} onValueChange={setIsDark} />
        </View>
      </View>
    </Surface>
  );

  const renderTier1 = () => (
    <ScrollView
      contentContainerStyle={{ padding: Spacing.sp4, gap: Spacing.sp6 }}
    >
      {/* TYPOGRAPHY */}
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>TIER 1: TYPOGRAPHY</OverlineText>
          <DisplayText isDark={isDark}>Display (32px)</DisplayText>
          <HeadlineText isDark={isDark}>Headline (24px)</HeadlineText>
          <TitleText isDark={isDark}>Title (20px)</TitleText>
          <BodyText isDark={isDark}>Body (16px)</BodyText>
          <CaptionText isDark={isDark}>Caption (14px)</CaptionText>
          <OverlineText isDark={isDark}>Overline (12px)</OverlineText>
        </View>
      </Surface>

      {/* BUTTONS */}
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>TIER 1: BUTTONS</OverlineText>
          <PrimaryButton
            label="Primary Button"
            isDark={isDark}
            onPress={() => {}}
          />
          <SecondaryButton
            label="Secondary Button"
            isDark={isDark}
            onPress={() => {}}
          />
          <TertiaryButton
            label="Tertiary Button"
            isDark={isDark}
            onPress={() => {}}
          />
          <GhostButton
            label="Ghost Button"
            isDark={isDark}
            onPress={() => {}}
          />
          <PrimaryButton
            label="Loading..."
            isDark={isDark}
            onPress={() => {}}
            isLoading
            disabled
          />
          <PrimaryButton
            label="Disabled"
            isDark={isDark}
            onPress={() => {}}
            disabled
          />
        </View>
      </Surface>

      {/* SURFACES / ELEVATION */}
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>TIER 1: SURFACES</OverlineText>
          <CardLevel1 isDark={isDark}>
            <BodyText isDark={isDark}>Card Level 1 (Elevation: 2)</BodyText>
          </CardLevel1>
          <CardLevel2 isDark={isDark}>
            <BodyText isDark={isDark}>Card Level 2 (Elevation: 4)</BodyText>
          </CardLevel2>
          <CardLevel3 isDark={isDark}>
            <BodyText isDark={isDark}>Card Level 3 (Elevation: 8)</BodyText>
          </CardLevel3>
        </View>
      </Surface>

      {/* BADGES */}
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>TIER 1: BADGES</OverlineText>
          <View
            style={{ flexDirection: "row", gap: Spacing.sp2, flexWrap: "wrap" }}
          >
            <Badge isDark={isDark} status="active" label="Active" />
            <Badge isDark={isDark} status="pending" label="Pending" />
            <Badge isDark={isDark} status="inactive" label="Inactive" />
            <Badge isDark={isDark} status="warning" label="Warning" />
            <Badge isDark={isDark} status="danger" label="Danger" />
          </View>
        </View>
      </Surface>

      {/* INPUT */}
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>TIER 1: INPUT</OverlineText>
          <Input
            isDark={isDark}
            label="Email Address"
            placeholder="user@example.com"
            value=""
            onChangeText={() => {}}
          />
          <Input
            isDark={isDark}
            label="With Error"
            placeholder="Invalid input"
            value=""
            onChangeText={() => {}}
            error="This field is required"
          />
          <Input
            isDark={isDark}
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
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>
            TIER 2: PROGRESS STEPPER
          </OverlineText>
          <ProgressStepper
            steps={[
              { label: "Create Passkey", completed: true },
              { label: "Enable Biometrics", completed: true },
              { label: "Add Contacts" },
            ]}
            currentStep={2}
            isDark={isDark}
          />
        </View>
      </Surface>

      {/* GUARDIAN LIST - ALL 7 STATES */}
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>
            TIER 2: GUARDIAN LIST ITEM (ALL 7 STATES)
          </OverlineText>
          <GuardianListShowcase isDark={isDark} />
        </View>
      </Surface>

      {/* CONFIRMATION MODAL */}
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>
            TIER 2: CONFIRMATION MODAL
          </OverlineText>
          <PrimaryButton
            label="Open Modal (Rule of One)"
            isDark={isDark}
            onPress={() => setShowModal(true)}
          />
          {showModal && (
            <ConfirmationModal
              title="Are you sure?"
              message="This action cannot be undone."
              confirmLabel="Delete"
              cancelLabel="Cancel"
              isDanger={true}
              isDark={isDark}
              onConfirm={() => setShowModal(false)}
              onCancel={() => setShowModal(false)}
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
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>
            TIER 3: RECOVERY SCORE WIDGET
          </OverlineText>
          <RecoveryScoreWidget isDark={isDark} />
        </View>
      </Surface>

      {/* WALLET BALANCE CARD */}
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>
            TIER 3: WALLET BALANCE CARD
          </OverlineText>
          <WalletBalanceCard isDark={isDark} />
        </View>
      </Surface>

      {/* BIOMETRIC PROMPT */}
      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp2 }}>
          <OverlineText color={Colors.primary}>
            TIER 3: BIOMETRIC PROMPT
          </OverlineText>
          <BiometricPrompt biometricType="face" isDark={isDark} />
          <BiometricPrompt biometricType="touch" isDark={isDark} />
          <BiometricPrompt biometricType="none" isDark={isDark} />
        </View>
      </Surface>
    </ScrollView>
  );

  const renderScreens = () => (
    <ScrollView
      contentContainerStyle={{ padding: Spacing.sp4, gap: Spacing.sp6 }}
    >
      <OverlineText color={Colors.primary}>
        STAGE 5.1: ONBOARDING SCREENS
      </OverlineText>

      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText isDark={isDark}>1. Welcome Screen</BodyText>
          <WelcomeScreen
            isDark={isDark}
            onCreateAccount={() => {}}
            onSignIn={() => {}}
          />
        </View>
      </Surface>

      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText isDark={isDark}>2. Passkey Creation Screen</BodyText>
          <PasskeyCreationScreen isDark={isDark} />
        </View>
      </Surface>

      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText isDark={isDark}>3. Biometric Setup Screen</BodyText>
          <BiometricSetupScreen isDark={isDark} />
        </View>
      </Surface>

      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText isDark={isDark}>4. Account Created Screen</BodyText>
          <AccountCreatedScreen isDark={isDark} />
        </View>
      </Surface>

      <Surface isDark={isDark} elevation={1}>
        <View style={{ gap: Spacing.sp3, paddingBottom: Spacing.sp4 }}>
          <BodyText isDark={isDark}>5. Initial Guardian Setup Screen</BodyText>
          <InitialGuardianSetupScreen isDark={isDark} />
        </View>
      </Surface>
    </ScrollView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      {renderHeader()}

      {/* SECTION TABS */}
      <View
        style={{
          flexDirection: "row",
          paddingHorizontal: Spacing.sp2,
          paddingVertical: Spacing.sp2,
          gap: Spacing.sp1,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? Colors.surfaceMid : "#e2e8f0",
          backgroundColor: isDark ? Colors.surface : Colors.lightSurface,
        }}
      >
        {(["tier1", "tier2", "tier3", "screens"] as ShowcaseSection[]).map(
          (section) => (
            <SecondaryButton
              key={section}
              label={section.toUpperCase()}
              isDark={isDark}
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
