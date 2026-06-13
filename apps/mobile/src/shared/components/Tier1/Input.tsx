import React, { useState } from "react";
import {
  Animated as RNAnimated,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
} from "react-native";
import { useAppTheme } from "@theme";
import { CaptionText } from "./Text";
import { BorderRadius, TouchTargets } from "../TokenRegistry";

interface InputProps extends Omit<RNTextInputProps, "style"> {
  isLocked?: boolean;
  errorMessage?: string;
  label?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  isLocked = false,
  errorMessage,
  label,
  icon,
  iconRight,
  onFocus,
  onBlur,
  editable = true,
  ...props
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const [isFocused, setIsFocused] = useState(false);

  // Animated value drives border color and glow interpolation
  const focusAnim = React.useRef(new RNAnimated.Value(0)).current;

  const handleFocus = (e: any) => {
    setIsFocused(true);
    RNAnimated.timing(focusAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    RNAnimated.timing(focusAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onBlur?.(e);
  };

  const borderColor = errorMessage
    ? colors.danger
    : isFocused
      ? colors.accent
      : colors.inputBorder;

  // Shadow elevation animates on focus — creates the glow ring
  const shadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.25],
  });

  return (
    <View style={{ gap: 6, opacity: editable ? 1 : 0.45 }}>
      {label && (
        <CaptionText
          color={isFocused ? colors.accent : colors.textSecondary}
          style={{ letterSpacing: 0.5 }}
        >
          {label}
        </CaptionText>
      )}

      <RNAnimated.View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor,
          borderRadius: BorderRadius.md,
          height: TouchTargets.comfort,   // 52px — touchComfort, was ~42px
          paddingHorizontal: 14,
          gap: 10,
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity,
          shadowRadius: 8,
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
            color: colors.text,
            paddingVertical: 0,
          }}
          placeholderTextColor={colors.textMuted}
        />

        {isLocked && (
          <RNText style={{ fontSize: 16, color: colors.accent }}>🔒</RNText>
        )}
        {iconRight && !isLocked && <View>{iconRight}</View>}
      </RNAnimated.View>

      {errorMessage && (
        <CaptionText color={colors.danger}>
          {errorMessage}
        </CaptionText>
      )}
    </View>
  );
};
