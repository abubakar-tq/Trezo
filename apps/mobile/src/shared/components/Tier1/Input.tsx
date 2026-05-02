/**
 * Input Component
 * Text input with optional lock icon (for blockchain-writing inputs)
 * States: Default, Focused, Error, Disabled
 */

import React, { useState } from "react";
import {
    Text as RNText,
    TextInput as RNTextInput,
    TextInputProps as RNTextInputProps,
    View,
} from "react-native";
import { CaptionText } from "./Text";
import { BorderRadius, Colors } from "../TokenRegistry";

interface InputProps extends Omit<RNTextInputProps, "style"> {
  isDark?: boolean;
  isLocked?: boolean;
  errorMessage?: string;
  label?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  isDark = true,
  isLocked = false,
  errorMessage,
  label,
  icon,
  onFocus,
  onBlur,
  editable = true,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const borderColor = errorMessage
    ? Colors.danger
    : isFocused
      ? Colors.primary
      : isDark
        ? Colors.surfaceMid
        : Colors.lightCard;

  const backgroundColor = isDark ? Colors.surface : Colors.lightSurface;

  const textColor = isDark ? Colors.textPrimary : Colors.lightTextPrimary;

  return (
    <View style={{ gap: 4 }}>
      {label && <CaptionText isDark={isDark}>{label}</CaptionText>}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor,
          borderWidth: 1,
          borderColor,
          borderRadius: BorderRadius.md,
          paddingHorizontal: 12,
          paddingVertical: 10,
          gap: 8,
          opacity: editable ? 1 : 0.5,
        }}
      >
        {icon && <View>{icon}</View>}

        <RNTextInput
          {...props}
          editable={editable}
          onFocus={handleFocus}
          onBlur={handleBlur}
          style={{
            flex: 1,
            fontSize: 16,
            color: textColor,
            paddingVertical: 0,
          }}
          placeholderTextColor={isDark ? Colors.textTertiary : "#a0aec0"}
        />

        {isLocked && (
          <RNText
            style={{
              fontSize: 16,
              color: Colors.primary,
            }}
          >
            🔒
          </RNText>
        )}
      </View>

      {errorMessage && (
        <CaptionText color={Colors.danger}>{errorMessage}</CaptionText>
      )}
    </View>
  );
};
