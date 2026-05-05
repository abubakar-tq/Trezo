/**
 * Text Component
 * All typography scales enforced from TokenRegistry
 */

import React from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native";
import { Colors, Typography } from "../TokenRegistry";

interface TextProps extends RNTextProps {
  variant?: keyof typeof Typography;
  color?: string;
  isDark?: boolean;
}

export const Text: React.FC<TextProps> = ({
  variant = "body",
  color,
  isDark = true,
  style,
  ...props
}) => {
  const scale = Typography[variant];
  const textColor =
    color || (isDark ? Colors.textPrimary : Colors.lightTextPrimary);

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

/**
 * Display (32px Bold)
 */
export const DisplayText: React.FC<Omit<TextProps, "variant">> = (props) => (
  <Text variant="display" {...props} />
);

/**
 * Headline (24px Bold)
 */
export const HeadlineText: React.FC<Omit<TextProps, "variant">> = (props) => (
  <Text variant="headline" {...props} />
);

/**
 * Title (20px Semibold)
 */
export const TitleText: React.FC<Omit<TextProps, "variant">> = (props) => (
  <Text variant="title" {...props} />
);

/**
 * Body (16px Regular) — Default
 */
export const BodyText: React.FC<Omit<TextProps, "variant">> = (props) => (
  <Text variant="body" {...props} />
);

/**
 * Caption (14px Regular)
 */
export const CaptionText: React.FC<Omit<TextProps, "variant">> = (props) => (
  <Text variant="caption" {...props} />
);

/**
 * Overline (12px Semibold)
 */
export const OverlineText: React.FC<Omit<TextProps, "variant">> = (props) => (
  <Text variant="overline" {...props} />
);
