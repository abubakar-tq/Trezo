/**
 * BiometricPrompt Component
 * Mockup for Face ID / Touch ID interface
 */

import React from "react";
import { Text, View, ViewProps } from "react-native";
import { GhostButton, PrimaryButton } from "../Tier1/Button";
import { BodyText, CaptionText, HeadlineText } from "../Tier1/Text";
import { BorderRadius, Colors } from "../TokenRegistry";

type BiometricType = "face" | "touch" | "none";

interface BiometricPromptProps extends Omit<ViewProps, "style"> {
  type: BiometricType;
  isDark?: boolean;
  onAuthenticate?: () => void;
  onCancel?: () => void;
  isAnimating?: boolean;
}

export const BiometricPrompt: React.FC<BiometricPromptProps> = ({
  type,
  isDark = true,
  onAuthenticate,
  onCancel,
  isAnimating = false,
  ...props
}) => {
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
        backgroundColor: isDark ? Colors.card : Colors.lightCard,
        borderRadius: BorderRadius.lg,
        padding: 24,
        gap: 20,
        justifyContent: "center",
        alignItems: "center",
      }}
      {...props}
    >
      {/* Icon */}
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: isSupported ? Colors.primary : Colors.danger,
          justifyContent: "center",
          alignItems: "center",
          opacity: isAnimating ? 0.7 : 1,
        }}
      >
        <Text style={{ fontSize: 40 }}>{icon}</Text>
      </View>

      {/* Label */}
      <HeadlineText isDark={isDark}>{label}</HeadlineText>

      {/* Message */}
      <BodyText
        isDark={isDark}
        color={isDark ? Colors.textSecondary : Colors.lightTextSecondary}
      >
        {message}
      </BodyText>

      {/* Biometric Scanner Mockup */}
      {isSupported && (
        <View
          style={{
            width: 120,
            height: 120,
            borderWidth: 2,
            borderColor: isAnimating ? Colors.primary : Colors.warning,
            borderRadius: 20,
            backgroundColor: isDark ? Colors.surface : Colors.lightSurface,
            justifyContent: "center",
            alignItems: "center",
            opacity: isAnimating ? 0.8 : 0.5,
          }}
        >
          <CaptionText color={isAnimating ? Colors.primary : Colors.warning}>
            {isAnimating ? "Scanning..." : "Ready"}
          </CaptionText>
        </View>
      )}

      {/* Actions */}
      <View style={{ width: "100%", gap: 8, marginTop: 8 }}>
        <PrimaryButton
          label={isAnimating ? "Scanning..." : `Authenticate with ${label}`}
          onPress={onAuthenticate}
          isLoading={isAnimating}
          disabled={!isSupported || isAnimating}
          isDark={isDark}
        />
        <GhostButton
          label="Use Passcode Instead"
          onPress={onCancel}
          isDark={isDark}
        />
      </View>
    </View>
  );
};
