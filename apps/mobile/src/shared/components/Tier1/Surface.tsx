/**
 * Surface Component
 * Card container with elevation levels
 */

import React from "react";
import { View, ViewProps } from "react-native";
import { BorderRadius, Colors, Shadows } from "../TokenRegistry";

type ElevationLevel = 1 | 2 | 3;

interface SurfaceProps extends ViewProps {
  elevation?: ElevationLevel;
  isDark?: boolean;
  children: React.ReactNode;
}

export const Surface: React.FC<SurfaceProps> = ({
  elevation = 1,
  isDark = true,
  children,
  style,
  ...props
}) => {
  const shadowConfig = Shadows[`level${elevation}` as keyof typeof Shadows];
  const backgroundColor = isDark ? Colors.card : Colors.lightCard;

  return (
    <View
      style={[
        {
          backgroundColor,
          borderRadius: BorderRadius.lg,
          padding: 16,
          ...shadowConfig,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

/**
 * Convenience factories
 */
export const CardLevel1: React.FC<Omit<SurfaceProps, "elevation">> = (
  props,
) => <Surface elevation={1} {...props} />;

export const CardLevel2: React.FC<Omit<SurfaceProps, "elevation">> = (
  props,
) => <Surface elevation={2} {...props} />;

export const CardLevel3: React.FC<Omit<SurfaceProps, "elevation">> = (
  props,
) => <Surface elevation={3} {...props} />;
