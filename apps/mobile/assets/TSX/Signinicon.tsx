import * as React from "react";
import type { SvgProps } from "react-native-svg";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

/**
 * Signinicon — Gradient circular icon with 4 rotated bars
 * Optimized for scaling and alignment in React Native
 */
const SvgSigninicon = (props: SvgProps) => (
  <Svg
    width={48}
    height={48}
    viewBox="0 0 48 48" // 👈 Ensures proper scaling and centering
    fill="none"
    {...props}
  >
    {/* Background gradient circle */}
    <Rect width={48} height={48} rx={24} fill="url(#gradient)" />

    {/* Rotated bars (like a loading or cross icon) */}
    <Rect
      width={3}
      height={16}
      x={24.574}
      y={12}
      rx={1.5}
      fill="#fff"
      transform="rotate(-45 24.574 12)"
    />
    <Rect
      width={3}
      height={16}
      rx={1.5}
      fill="#fff"
      transform="scale(1 -1) rotate(-45 -31.25 -47.467)"
    />
    <Rect
      width={3}
      height={16}
      x={21.307}
      y={10}
      rx={1.5}
      fill="#fff"
      transform="rotate(45 21.307 10)"
    />
    <Rect
      width={3}
      height={16}
      rx={1.5}
      fill="#fff"
      transform="scale(1 -1) rotate(45 56.522 6.716)"
    />

    {/* Gradient Definition */}
    <Defs>
      <LinearGradient
        id="gradient"
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

export default SvgSigninicon;
