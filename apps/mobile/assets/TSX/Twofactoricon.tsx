import * as React from "react";
import type { SvgProps } from "react-native-svg";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

/**
 * Twofactoricon — Gradient circular icon with 2FA symbol
 * Optimized for React Native scaling & centering
 */
const SvgTwofactoricon = (props: SvgProps) => (
  <Svg
    width={48}
    height={48}
    viewBox="0 0 48 48" // 👈 important for proper scaling
    fill="none"
    {...props}
  >
    {/* Background gradient circle */}
    <Rect width={48} height={48} rx={24} fill="url(#twofactoricon_svg__grad)" />

    {/* Lock shape / 2FA symbol */}
    <Path
      stroke="#fff"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M24 14s10 2 10 8v6c0 4-10 6-10 6s-10-2-10-6v-6c0-6 10-8 10-8"
    />
    <Path fill="#fff" d="M26 24a2 2 0 1 0-4 0v2a2 2 0 1 0 4 0z" />
    <Path stroke="#fff" strokeWidth={2} strokeLinecap="round" d="M24 28v2" />

    <Defs>
      <LinearGradient
        id="twofactoricon_svg__grad"
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

export default SvgTwofactoricon;
