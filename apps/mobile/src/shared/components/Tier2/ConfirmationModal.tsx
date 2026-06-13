/**
 * ConfirmationModal Component
 * Rule of One: Only ONE primary button
 * Centered, backdrop, high elevation
 */

import React from "react";
import { Modal, TouchableOpacity, View, ViewProps } from "react-native";
import { GhostButton, PrimaryButton } from "../Tier1/Button";
import { BodyText, HeadlineText } from "../Tier1/Text";
import { BorderRadius } from "../TokenRegistry";
import { useAppTheme } from "@theme";

interface ConfirmationModalProps extends Omit<ViewProps, "style"> {
  isVisible: boolean;
  title: string;
  message: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isVisible,
  title,
  message,
  primaryLabel,
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress,
  isLoading = false,
  ...props
}) => {
  const { theme: { colors } } = useAppTheme();

  return (
    <Modal visible={isVisible} transparent={true} animationType="fade">
      <TouchableOpacity
        activeOpacity={1}
        style={{
          flex: 1,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          justifyContent: "center",
          alignItems: "center",
          padding: 16,
        }}
        onPress={onSecondaryPress}
      >
        <View
          style={{
            backgroundColor: colors.surfaceCard,
            borderRadius: BorderRadius.lg,
            padding: 24,
            width: "100%",
            maxWidth: 340,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 8,
            gap: 16,
          }}
          {...props}
        >
          <HeadlineText>{title}</HeadlineText>

          <BodyText color={colors.textSecondary}>{message}</BodyText>

          <View style={{ gap: 8, marginTop: 8 }}>
            <PrimaryButton
              label={primaryLabel}
              onPress={onPrimaryPress}
              isLoading={isLoading}
              disabled={isLoading}
            />
            {secondaryLabel && (
              <GhostButton label={secondaryLabel} onPress={onSecondaryPress} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};
