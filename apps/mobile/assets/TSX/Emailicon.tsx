import * as React from "react";
import type { SvgProps } from "react-native-svg";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

const EmailIconLite = ({ width = 48, height = 48, ...props }: SvgProps) => (
  <Svg
    width={width}
    height={height}
    fill="none"
    viewBox="0 0 48 48"
    {...props}
  >
    {/* Background Gradient Circle */}
    <Rect width={48} height={48} rx={24} fill="url(#emailicon_grad)" />

    {/* Envelope Outline */}
    <Path
      fill="#fff"
      stroke="#3E60F0"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
      d="M29 32.5H19c-3 0-5-1.5-5-5v-7c0-3.5 2-5 5-5h10c3 0 5 1.5 5 5v7c0 3.5-2 5-5 5"
    />

    {/* Envelope Flap */}
    <Path fill="#fff" d="m29 21-3.13 2.5c-1.03.82-2.72.82-3.75 0L19 21" />
    <Path
      stroke="#3E60F0"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={10}
      strokeWidth={1.5}
      d="m29 21-3.13 2.5c-1.03.82-2.72.82-3.75 0L19 21"
    />

    {/* Gradient Definition */}
    <Defs>
      <LinearGradient
        id="emailicon_grad"
        x1={24}
        x2={24}
        y1={0}
        y2={48}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#1877F2" />
        <Stop offset={1} stopColor="#6945ED" />
      </LinearGradient>
    </Defs>
  </Svg>
);

export default EmailIconLite;
