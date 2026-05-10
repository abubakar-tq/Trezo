import React from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native";
import { useAppTheme } from "@theme";
import { Typography } from "../TokenRegistry";

interface TextProps extends RNTextProps {
  variant?: keyof typeof Typography;
  color?: string;
}

export const Text: React.FC<TextProps> = ({
  variant = "body",
  color,
  style,
  ...props
}) => {
  const { theme } = useAppTheme();
  const scale = Typography[variant];
  const textColor = color ?? theme.colors.text;

  return (
    <RNText
      {...props}
      style={[
        {
          fontSize: scale.fontSize,
          fontWeight: scale.fontWeight,
          lineHeight: scale.lineHeight,
          letterSpacing: scale.letterSpacing,
          // fontFamily is set only when defined — falls back to system font
          // until fonts are loaded via expo-google-fonts in App.tsx
          ...(scale.fontFamily ? { fontFamily: scale.fontFamily } : {}),
          color: textColor,
        },
        style,
      ]}
    />
  );
};

// Sans variants — Inter — verbs, body, UI
export const DisplayText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="display" {...props} />;
export const HeadlineText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="headline" {...props} />;
export const TitleText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="title" {...props} />;
export const BodyText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="body" {...props} />;
export const CaptionText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="caption" {...props} />;
export const OverlineText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="overline" {...props} />;
export const BrandText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="brand" {...props} />;

// Serif variants — Playfair Display — nouns of importance, recovery/guardian screens
export const HeadlineSerifText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="headlineSerif" {...props} />;

// Mono variants — JetBrains Mono — numbers, balances, addresses
export const MonoLgText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="monoLg" {...props} />;
export const MonoMdText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="monoMd" {...props} />;
export const MonoSmText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="monoSm" {...props} />;
