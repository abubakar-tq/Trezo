/**
 * BiometricPrompt Component
 * Mockup for Face ID / Touch ID interface
 */

import React from "react";
import { Text, View, ViewProps } from "react-native";
import { useAppTheme } from "@theme";
import { GhostButton, PrimaryButton } from "../Tier1/Button";
import { BodyText, CaptionText, HeadlineText } from "../Tier1/Text";
import { BorderRadius } from "../TokenRegistry";

type BiometricType = "face" | "touch" | "none";

interface BiometricPromptProps extends Omit<ViewProps, "style"> {
  type: BiometricType;
  onAuthenticate?: () => void;
  onCancel?: () => void;
  isAnimating?: boolean;
}

export const BiometricPrompt: React.FC<BiometricPromptProps> = ({
  type,
  onAuthenticate,
  onCancel,
  isAnimating = false,
  ...props
}) => {
  const { theme: { colors } } = useAppTheme();

  const isSupported = type !== "none";
  const icon = type === "face" ? "👤" : type === "touch" ? "👆" : "❌";
  const label =
    type === "face"
      ? "Face ID"
      : type === "touch"
        ? "Touch ID"
        : "Not Available";
  const message =
    type === "face"
      ? "Position your face in front of the camera"
      : type === "touch"
        ? "Place your finger on the sensor"
        : "Biometric authentication not available on this device";

  return (
    <View
      style={{
        backgroundColor: colors.surfaceCard,
        borderRadius: BorderRadius.lg,
        padding: 24,
        gap: 20,
        justifyContent: "center",
        alignItems: "center",
      }}
      {...props}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: isSupported ? colors.accent : colors.danger,
          justifyContent: "center",
          alignItems: "center",
          opacity: isAnimating ? 0.7 : 1,
        }}
      >
        <Text style={{ fontSize: 40 }}>{icon}</Text>
      </View>

      <HeadlineText>{label}</HeadlineText>

      <BodyText color={colors.textSecondary}>{message}</BodyText>

      {isSupported && (
        <View
          style={{
            width: 120,
            height: 120,
            borderWidth: 2,
            borderColor: isAnimating ? colors.accent : colors.warning,
            borderRadius: 20,
            backgroundColor: colors.surface,
            justifyContent: "center",
            alignItems: "center",
            opacity: isAnimating ? 0.8 : 0.5,
          }}
        >
          <CaptionText color={isAnimating ? colors.accent : colors.warning}>
            {isAnimating ? "Scanning..." : "Ready"}
          </CaptionText>
        </View>
      )}

      <View style={{ width: "100%", gap: 8, marginTop: 8 }}>
        <PrimaryButton
          label={isAnimating ? "Scanning..." : `Authenticate with ${label}`}
          onPress={onAuthenticate}
          isLoading={isAnimating}
          disabled={!isSupported || isAnimating}
        />
        <GhostButton label="Use Passcode Instead" onPress={onCancel} />
      </View>
    </View>
  );
};
