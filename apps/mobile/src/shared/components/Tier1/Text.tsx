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
          color: textColor,
        },
        style,
      ]}
    />
  );
};

export const DisplayText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="display" {...props} />;
export const HeadlineText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="headline" {...props} />;
export const TitleText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="title" {...props} />;
export const BodyText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="body" {...props} />;
export const CaptionText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="caption" {...props} />;
export const OverlineText: React.FC<Omit<TextProps, "variant">> = (props) => <Text variant="overline" {...props} />;
