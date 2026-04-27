import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useAppTheme } from '@theme';
import { withAlpha } from '@utils/color';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 100,
  height = 40,
  color,
  strokeWidth = 2,
}) => {
  const { theme } = useAppTheme();
  const { colors } = theme;
  
  const lineColor = color || colors.accent;

  const pathData = useMemo(() => {
    if (!data || data.length < 2) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return { x, y };
    });

    return points.reduce((path, point, i) => {
      return i === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`;
    }, '');
  }, [data, width, height]);

  const fillPathData = useMemo(() => {
    if (!pathData) return '';
    return `${pathData} L ${width} ${height} L 0 ${height} Z`;
  }, [pathData, width, height]);

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path
          d={fillPathData}
          fill="url(#gradient)"
        />
        <Path
          d={pathData}
          stroke={lineColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};
