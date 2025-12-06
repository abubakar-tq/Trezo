import * as React from "react";
import Svg, { Rect, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import type { SvgProps } from "react-native-svg";
const SvgMessageicon = (props: SvgProps) => (
  <Svg
    xmlns="http://www.w3.org/2000/svg"
    width={48}
    height={48}
    fill="none"
    {...props}
  >
    <Rect width={48} height={48} fill="url(#messageicon_svg__a)" rx={24} />
    <Path
      fill="#fff"
      stroke="#fff"
      d="M19.834 16.167h8.333a3.66 3.66 0 0 1 3.667 3.658v5.816a3.66 3.66 0 0 1-3.667 3.65h-1.25c-.417 0-.813.201-1.065.532l-.002.001-1.25 1.658v.001c-.194.26-.417.35-.6.35-.184 0-.406-.09-.6-.35l-1.25-1.659h-.002a1.3 1.3 0 0 0-.47-.382c-.17-.085-.38-.15-.594-.15h-1.25a3.66 3.66 0 0 1-3.667-3.65v-5.817a3.66 3.66 0 0 1 3.667-3.658Z"
    />
    <Path
      fill="#3266F0"
      d="M28.167 21.292h-8.334a.63.63 0 0 1-.625-.625.63.63 0 0 1 .625-.625h8.334a.63.63 0 0 1 .625.625.63.63 0 0 1-.625.625"
    />
    <Path
      fill="#425CEF"
      d="M24.833 25.458h-5a.63.63 0 0 1-.625-.625.63.63 0 0 1 .625-.625h5a.63.63 0 0 1 .625.625.63.63 0 0 1-.625.625"
    />
    <Defs>
      <LinearGradient
        id="messageicon_svg__a"
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
export default SvgMessageicon;
