import * as React from "react";
import type { SvgProps } from "react-native-svg";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * Optionicon — Gradient circular icon with 3 horizontal bars
 * Optimized for scaling and centering in React Native
 */
const SvgOptionicon = (props: SvgProps) => (
  <Svg
    width={48}
    height={48}
    viewBox="0 0 48 48" // ensures proper scaling and centering
    fill="none"
    {...props}
  >
    {/* Background gradient circle */}
    <Rect width={48} height={48} rx={24} fill="url(#optionicon_gradient)" />

    {/* Three horizontal bars */}
    <Rect x={14} y={16} width={20} height={4} rx={2} fill="#fff" />
    <Rect x={14} y={24} width={20} height={4} rx={2} fill="#fff" />
    <Rect x={14} y={32} width={20} height={4} rx={2} fill="#fff" />

    {/* Gradient Definition */}
    <Defs>
      <LinearGradient
        id="optionicon_gradient"
        x1={24}
        y1={0}
        x2={24}
        y2={48}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#1877F2" />
        <Stop offset={1} stopColor="#6945ED" />
      </LinearGradient>
    </Defs>
  </Svg>
);

export default SvgOptionicon;
