import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { withAlpha } from '@utils/color';
import { useAppTheme } from '@theme';

interface MeshBackgroundProps {
  intensity?: number;
}

export const MeshBackground = React.memo<MeshBackgroundProps>(({ intensity = 1 }) => {
  const { theme } = useAppTheme();
  const { colors, mode } = theme;
  const { width, height } = useWindowDimensions();

  const isDark = mode === 'dark';
  
  // Reduce intensity by 20% if dark mode as requested by user
  // Base opacities: 0.25 -> 0.20, 0.22 -> 0.18
  const baseOpacity1 = isDark ? 0.20 : 0.22;
  const baseOpacity2 = isDark ? 0.18 : 0.18;

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <Svg height="100%" width="100%">
        <Defs>
          <RadialGradient
            id="grad1"
            cx="80%"
            cy="10%"
            rx="60%"
            ry="60%"
            fx="80%"
            fy="10%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={colors.accent} stopOpacity={baseOpacity1 * intensity} />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient
            id="grad2"
            cx="20%"
            cy="80%"
            rx="70%"
            ry="70%"
            fx="20%"
            fy="80%"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0%" stopColor={colors.accentAlt} stopOpacity={baseOpacity2 * intensity} />
            <Stop offset="100%" stopColor={colors.accentAlt} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad1)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad2)" />
      </Svg>
    </View>
  );
});
