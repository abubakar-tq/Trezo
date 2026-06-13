import React from "react";
import { View, ViewProps } from "react-native";
import { useAppTheme } from "@theme";
import { BorderRadius, Phi, Shadows } from "../TokenRegistry";

type ElevationLevel = 1 | 2 | 3;
type SurfaceVariant = "default" | "glass";

interface SurfaceProps extends ViewProps {
  elevation?: ElevationLevel;
  variant?: SurfaceVariant;
  padding?: number;
  children: React.ReactNode;
}

export const Surface: React.FC<SurfaceProps> = ({
  elevation = 1,
  variant = "default",
  padding,
  children,
  style,
  ...props
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  const shadowConfig = Shadows[`level${elevation}` as keyof typeof Shadows];
  const resolvedPadding = padding ?? Phi.phi4;  // 20px default

  const isGlass = variant === "glass";

  return (
    <View
      style={[
        {
          backgroundColor: isGlass ? colors.glass : colors.surfaceCard,
          borderRadius: BorderRadius.lg,
          padding: resolvedPadding,
          borderWidth: 1,
          borderColor: isGlass ? colors.glassBorder : colors.border,
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
export const GlassSurface: React.FC<Omit<SurfaceProps, "variant">> = (props) => <Surface variant="glass" {...props} />;
