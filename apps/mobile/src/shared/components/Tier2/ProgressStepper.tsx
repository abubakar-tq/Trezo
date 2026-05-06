/**
 * ProgressStepper Component
 * Linear progress through steps (e.g., onboarding, transaction flow)
 */

import React from "react";
import { View, ViewProps } from "react-native";
import { useAppTheme } from "@theme";
import { CaptionText, OverlineText } from "../Tier1/Text";

interface Step {
  label: string;
  completed?: boolean;
}

interface ProgressStepperProps extends Omit<ViewProps, "style"> {
  steps: Step[];
  currentStep: number; // 0-indexed
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStep,
  ...props
}) => {
  const { theme: { colors } } = useAppTheme();

  return (
    <View {...props}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor:
                  idx < currentStep
                    ? colors.success
                    : idx === currentStep
                      ? colors.accent
                      : colors.surfaceMuted,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: idx === currentStep ? 2 : 0,
                borderColor: colors.accent,
              }}
            >
              <OverlineText
                color={idx <= currentStep ? "#ffffff" : colors.textSecondary}
              >
                {idx < currentStep ? "✓" : idx + 1}
              </OverlineText>
            </View>

            {idx < steps.length - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor:
                    idx < currentStep ? colors.success : colors.surfaceCard,
                  minWidth: 24,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      <View style={{ marginTop: 12, gap: 8 }}>
        <CaptionText color={colors.textSecondary}>
          Step {currentStep + 1} of {steps.length}
        </CaptionText>
        <OverlineText>{steps[currentStep]?.label}</OverlineText>
      </View>
    </View>
  );
};
