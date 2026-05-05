import React, { useState } from "react";
import {
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
} from "react-native";
import { useAppTheme } from "@theme";
import { CaptionText } from "./Text";
import { BorderRadius } from "../TokenRegistry";

interface InputProps extends Omit<RNTextInputProps, "style"> {
  isLocked?: boolean;
  errorMessage?: string;
  label?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  isLocked = false,
  errorMessage,
  label,
  icon,
  onFocus,
  onBlur,
  editable = true,
  ...props
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => { setIsFocused(true); onFocus?.(e); };
  const handleBlur = (e: any) => { setIsFocused(false); onBlur?.(e); };

  const borderColor = errorMessage
    ? colors.danger
    : isFocused
      ? colors.accent
      : colors.inputBorder;

  return (
    <View style={{ gap: 4 }}>
      {label && <CaptionText color={colors.textSecondary}>{label}</CaptionText>}

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.inputBackground,
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
          style={{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 }}
          placeholderTextColor={colors.textMuted}
        />

        {isLocked && (
          <RNText style={{ fontSize: 16, color: colors.accent }}>🔒</RNText>
        )}
      </View>

      {errorMessage && <CaptionText color={colors.danger}>{errorMessage}</CaptionText>}
    </View>
  );
};
