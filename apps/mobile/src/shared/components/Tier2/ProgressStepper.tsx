/**
 * ProgressStepper Component
 * Linear progress through steps (e.g., onboarding, transaction flow)
 */

import React from "react";
import { View, ViewProps } from "react-native";
import { CaptionText, OverlineText } from "../Tier1/Text";
import { Colors } from "../TokenRegistry";

interface Step {
  label: string;
  completed?: boolean;
}

interface ProgressStepperProps extends Omit<ViewProps, "style"> {
  steps: Step[];
  currentStep: number; // 0-indexed
  isDark?: boolean;
}

export const ProgressStepper: React.FC<ProgressStepperProps> = ({
  steps,
  currentStep,
  isDark = true,
  ...props
}) => {
  return (
    <View {...props}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            {/* Step Circle */}
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor:
                  idx < currentStep
                    ? Colors.success
                    : idx === currentStep
                      ? Colors.primary
                      : isDark
                        ? Colors.surface
                        : Colors.lightCard,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: idx === currentStep ? 2 : 0,
                borderColor: Colors.primary,
              }}
            >
              <OverlineText
                color={
                  idx <= currentStep
                    ? "#ffffff"
                    : isDark
                      ? Colors.textSecondary
                      : Colors.lightTextSecondary
                }
              >
                {idx < currentStep ? "✓" : idx + 1}
              </OverlineText>
            </View>

            {/* Connector Line */}
            {idx < steps.length - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor:
                    idx < currentStep
                      ? Colors.success
                      : isDark
                        ? Colors.surface
                        : Colors.lightCard,
                  minWidth: 24,
                }}
              />
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Labels */}
      <View style={{ marginTop: 12, gap: 8 }}>
        <CaptionText isDark={isDark} color={Colors.textSecondary}>
          Step {currentStep + 1} of {steps.length}
        </CaptionText>
        <OverlineText isDark={isDark}>{steps[currentStep]?.label}</OverlineText>
      </View>
    </View>
  );
};
