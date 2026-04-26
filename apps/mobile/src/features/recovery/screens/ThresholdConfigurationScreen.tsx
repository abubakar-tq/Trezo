/**
 * ThresholdConfigurationScreen.tsx
 *
 * Configure approval requirement for recovery ("X of Y" model).
 *
 * Constraints Applied:
 * - Recovery UX: "Approval Requirement" terminology (never "Threshold", "Guardian Threshold")
 * - Visual Fractionation: Show blocks for each required approval
 * - Dynamic Feedback: "You need X more contacts to require Y approvals"
 * - Rule of One: "Save Configuration" primary button
 * - Stepper UI to increase/decrease requirement
 * - No raw numbers in vacuum (always contextualize)
 */

import React, { useState } from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import { Badge } from "../../../shared/components/Tier1/Badge";
import {
    PrimaryButton,
    SecondaryButton,
} from "../../../shared/components/Tier1/Button";
import { CardLevel1, Surface } from "../../../shared/components/Tier1/Surface";
import {
    BodyText,
    CaptionText,
    HeadlineText,
    TitleText
} from "../../../shared/components/Tier1/Text";
import { Colors, Spacing } from "../../../shared/components/TokenRegistry";

interface ThresholdConfigurationScreenProps {
  isDark?: boolean;
  onSaveConfiguration?: (threshold: number) => void;
  onCancel?: () => void;
}

export const ThresholdConfigurationScreen: React.FC<
  ThresholdConfigurationScreenProps
> = ({ isDark = true, onSaveConfiguration, onCancel }) => {
  const [requiredApprovals, setRequiredApprovals] = useState(2);
  const [totalContacts] = useState(3);
  const isSaving = false;

  const canIncrease = requiredApprovals < totalContacts;
  const canDecrease = requiredApprovals > 1;
  const needsMoreContacts = requiredApprovals > totalContacts;

  const handleIncrement = () => {
    if (canIncrease) {
      setRequiredApprovals(requiredApprovals + 1);
    }
  };

  const handleDecrement = () => {
    if (canDecrease) {
      setRequiredApprovals(requiredApprovals - 1);
    }
  };

  const handleSave = () => {
    if (!needsMoreContacts) {
      onSaveConfiguration?.(requiredApprovals);
    }
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
        {/* HEADER */}
        <View style={{ gap: Spacing.sp2 }}>
          <HeadlineText isDark={isDark}>Approval Requirement</HeadlineText>
          <BodyText
            isDark={isDark}
            color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
          >
            Choose how many trusted contacts must approve recovery requests.
          </BodyText>
        </View>

        {/* VISUAL FRACTIONATION */}
        <Surface isDark={isDark} elevation={1}>
          <View style={{ gap: Spacing.sp4 }}>
            <CaptionText color={Colors.primary}>REQUIRED APPROVALS</CaptionText>

            {/* LARGE VISUAL INDICATOR */}
            <View style={{ alignItems: "center", gap: Spacing.sp3 }}>
              <View
                style={{
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BodyText isDark={isDark} style={{ fontSize: 48, fontWeight: "800", lineHeight: 60 }}>
                  {requiredApprovals} <BodyText isDark={isDark} style={{ fontSize: 24, fontWeight: "400" }}>out of {totalContacts}</BodyText>
                </BodyText>
              </View>

              {/* FRACTIONATION BLOCKS */}
              <View
                style={{
                  flexDirection: "row",
                  gap: Spacing.sp2,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {Array.from({ length: totalContacts }).map((_, idx) => (
                  <View
                    key={idx}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      backgroundColor:
                        idx < requiredApprovals
                          ? Colors.primary
                          : isDark
                            ? Colors.surfaceMid
                            : "#e2e8f0",
                      alignItems: "center",
                      justifyContent: "center",
                      borderWidth: 2,
                      borderColor:
                        idx < requiredApprovals
                          ? Colors.primary
                          : "transparent",
                    }}
                  >
                    <BodyText
                      isDark={isDark}
                      color={
                        idx < requiredApprovals
                          ? "#ffffff"
                          : isDark
                            ? Colors.textSecondary
                            : Colors.lightTextSecondary
                      }
                      style={{ fontWeight: "bold", fontSize: 16 }}
                    >
                      {idx + 1}
                    </BodyText>
                  </View>
                ))}
              </View>
            </View>

            {/* EXPLANATION */}
            <BodyText
              isDark={isDark}
              color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
              style={{ textAlign: "center", fontSize: 13 }}
            >
              {requiredApprovals === 1
                ? `Any 1 of your ${totalContacts} trusted contacts can approve recovery.`
                : `All ${requiredApprovals} of your ${totalContacts} trusted contacts must approve recovery together.`}
            </BodyText>
          </View>
        </Surface>

        {/* STEPPER CONTROLS */}
        <CardLevel1 isDark={isDark}>
          <View style={{ gap: Spacing.sp3, alignItems: "center" }}>
            <CaptionText color={Colors.primary}>ADJUST REQUIREMENT</CaptionText>

            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sp3,
                alignItems: "center",
              }}
            >
              <SecondaryButton
                label="−"
                isDark={isDark}
                onPress={handleDecrement}
                disabled={!canDecrease}
              />

              <BodyText
                isDark={isDark}
                style={{
                  fontSize: 32,
                  fontWeight: "bold",
                  minWidth: 60,
                  textAlign: "center",
                }}
              >
                {requiredApprovals}
              </BodyText>

              <SecondaryButton
                label="+"
                isDark={isDark}
                onPress={handleIncrement}
                disabled={!canIncrease}
              />
            </View>

            <BodyText
              isDark={isDark}
              color={isDark ? Colors.textTertiary : Colors.lightTextSecondary}
              style={{ fontSize: 12, textAlign: "center" }}
            >
              {canDecrease
                ? "Tap − to require fewer approvals"
                : "Minimum: 1 approval required"}{" "}
              {"\n"}
              {canIncrease
                ? "Tap + to require more approvals"
                : "Maximum reached for your contacts"}
            </BodyText>
          </View>
        </CardLevel1>

        {/* INSUFFICIENT CONTACTS WARNING */}
        {needsMoreContacts && (
          <Surface isDark={isDark} elevation={1}>
            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sp2,
                paddingHorizontal: Spacing.sp3,
                paddingVertical: Spacing.sp3,
                backgroundColor: isDark ? Colors.surface : "#fef3c7",
                borderRadius: 8,
                borderLeftWidth: 4,
                borderLeftColor: Colors.warning,
              }}
            >
              <BodyText isDark={isDark} style={{ fontSize: 18 }}>
                ⚠️
              </BodyText>
              <BodyText
                isDark={isDark}
                color={Colors.warning}
                style={{ flex: 1, fontSize: 13, fontWeight: "600" }}
              >
                You need {requiredApprovals - totalContacts} more trusted
                contact{requiredApprovals - totalContacts === 1 ? "" : "s"} to
                require {requiredApprovals} approval
                {requiredApprovals === 1 ? "" : "s"}.
              </BodyText>
            </View>
          </Surface>
        )}

        {/* SECURITY IMPLICATIONS */}
        <CardLevel1 isDark={isDark}>
          <View style={{ gap: Spacing.sp2 }}>
            <TitleText isDark={isDark}>Why this matters</TitleText>
            <BodyText
              isDark={isDark}
              color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
              style={{ fontSize: 13, lineHeight: 20 }}
            >
              •{" "}
              <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                Higher threshold = More secure
              </BodyText>
              {"\n"}Requires more people to approve, harder for attackers.
              {"\n\n"}•{" "}
              <BodyText isDark={isDark} style={{ fontWeight: "600" }}>
                Lower threshold = Easier recovery
              </BodyText>
              {"\n"}Faster recovery if you lose access.{"\n\n"}• All approvals
              must happen together (not spread over time).
            </BodyText>
          </View>
        </CardLevel1>

        {/* CURRENT SETTING */}
        <Surface isDark={isDark} elevation={1}>
          <View style={{ gap: Spacing.sp2 }}>
            <CaptionText color={Colors.primary}>CURRENT SETTING</CaptionText>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.sp2,
              }}
            >
              <Badge
                isDark={isDark}
                status="active"
                label={`${requiredApprovals}/${totalContacts}`}
              />
              <BodyText isDark={isDark}>
                {requiredApprovals} out of {totalContacts} contacts required
              </BodyText>
            </View>
          </View>
        </Surface>

        {/* ACTIONS */}
        <View style={{ gap: Spacing.sp2 }}>
          <PrimaryButton
            label={isSaving ? "Saving..." : "Save Configuration"}
            isDark={isDark}
            onPress={handleSave}
            disabled={isSaving || needsMoreContacts}
          />

          <SecondaryButton
            label="Cancel"
            isDark={isDark}
            onPress={onCancel}
            disabled={isSaving}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default ThresholdConfigurationScreen;
