import React from "react";
import { View, ViewProps } from "react-native";
import { useAppTheme } from "@theme";
import { BorderRadius, Shadows } from "../TokenRegistry";

type ElevationLevel = 1 | 2 | 3;

interface SurfaceProps extends ViewProps {
  elevation?: ElevationLevel;
  children: React.ReactNode;
}

export const Surface: React.FC<SurfaceProps> = ({
  elevation = 1,
  children,
  style,
  ...props
}) => {
  const { theme } = useAppTheme();
  const shadowConfig = Shadows[`level${elevation}` as keyof typeof Shadows];

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surfaceCard,
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

export const CardLevel1: React.FC<Omit<SurfaceProps, "elevation">> = (props) => <Surface elevation={1} {...props} />;
export const CardLevel2: React.FC<Omit<SurfaceProps, "elevation">> = (props) => <Surface elevation={2} {...props} />;
export const CardLevel3: React.FC<Omit<SurfaceProps, "elevation">> = (props) => <Surface elevation={3} {...props} />;
