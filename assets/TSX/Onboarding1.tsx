import * as React from "react";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from "react-native-svg";
/* SVGR has dropped some elements not supported by react-native-svg: animate, animateTransform */
import type { SvgProps } from "react-native-svg";
const SvgOnboarding1 = (props: SvgProps) => (
    <Svg
      viewBox="0 0 208 208"       // ✅ makes SVG scalable
      width="100%"                // ✅ fills parent container width
      height="100%"               // ✅ fills parent container height
      preserveAspectRatio="xMidYMid meet"  // ✅ keeps aspect ratio
      // fill="none"
      {...props}
    >
    <Defs>
      <LinearGradient
        id="onboarding1_svg__b"
        x1="0%"
        x2="100%"
        y1="0%"
        y2="100%"
      >
        <Stop
          offset="0%"
          stopColor="#ff6b35"
          stopOpacity={1}
        />
        <Stop
          offset="50%"
          stopColor="#f7931e"
          stopOpacity={1}
        />
        <Stop
          offset="100%"
          stopColor="#ffd23f"
          stopOpacity={1}
        />
      </LinearGradient>
      <LinearGradient
        id="onboarding1_svg__c"
        x1="0%"
        x2="100%"
        y1="100%"
        y2="0%"
      >
        <Stop
          offset="0%"
          stopColor="#6a0dad"
          stopOpacity={1}
        />
        <Stop
          offset="50%"
          stopColor="#8a2be2"
          stopOpacity={1}
        />
        <Stop
          offset="100%"
          stopColor="orchid" stopOpacity={1}
        />
      </LinearGradient>
      <LinearGradient
        id="onboarding1_svg__d"
        x1="0%"
        x2="100%"
        y1="0%"
        y2="100%"
      >
        <Stop
          offset="0%"
          stopColor="#ff1493" stopOpacity={1}
        />
        <Stop
          offset="50%"
          stopColor="#0ff" stopOpacity={1}
        />
        <Stop
          offset="100%"
          stopColor="#adff2f" stopOpacity={1}
        />
      </LinearGradient>
      <RadialGradient id="onboarding1_svg__a" cx="50%" cy="50%" r="50%">
        <Stop
          offset="0%"
          stopColor="#ff6b35" stopOpacity={0.9}
        />
        <Stop
          offset="70%"
          stopColor="#8a2be2" stopOpacity={0.6}
        />
        <Stop
          offset="100%"
          stopColor="#6a0dad" stopOpacity={0.2}
        />
      </RadialGradient>
    </Defs>
    <Circle
      cx={104}
      cy={104}
      r={100}
      fill="url(#onboarding1_svg__a)"
      opacity={0.4}
    />
    <Path
      fill="url(#onboarding1_svg__b)"
      stroke="#FFD23F"
      strokeWidth={3}
      d="m104 20 36 40-36 40-36-40z"
    />
    <Path
      fill="url(#onboarding1_svg__c)"
      stroke="orchid"
      strokeWidth={3}
      d="m104 100 36-40 20 44-56 36z"
      opacity={0.95}
    />
    <Path
      fill="url(#onboarding1_svg__b)"
      stroke="#FF6B35"
      strokeWidth={3}
      d="M104 100 68 60l-20 44 56 36z"
      opacity={0.9}
    />
    <Path
      fill="url(#onboarding1_svg__c)"
      stroke="#8A2BE2"
      strokeWidth={3}
      d="m104 140 56-36-20 44-36 40z"
      opacity={0.95}
    />
    <Path
      fill="url(#onboarding1_svg__b)"
      stroke="#F7931E"
      strokeWidth={3}
      d="m104 140-56-36 20 44 36 40z"
      opacity={0.9}
    />
    <Circle cx={180} cy={40} r={8} fill="#FF6B35"></Circle>
    <Path
      fill="orchid"
      d="M26 157.515 34.485 166 26 174.485 17.515 166z"
      opacity={0.9}
    ></Path>
    <Path fill="#FFD23F" d="m170 140 7-10 7 10-7 10z" opacity={0.9} />
    <Path fill="#8A2BE2" d="m184 140 7-10 7 10-7 10z" opacity={0.9} />
    <Path fill="#FF6B35" d="m177 150 7-10 7 10-7 10z" opacity={0.9} />
    <Path
      stroke="url(#onboarding1_svg__d)"
      strokeWidth={3}
      d="M30 80q20-20 50 0t50 0"
      opacity={0.6}
    ></Path>
    <Path
      stroke="url(#onboarding1_svg__d)"
      strokeWidth={3}
      d="M180 120q-20 20-50 0t-50 0"
      opacity={0.5}
    ></Path>
    <Path fill="#ADFF2F" d="m40 100 5 5-5 5-5-5Z"></Path>
    <Path stroke="#ADFF2F" strokeWidth={3} d="M40 95v20m-10-10h20"></Path>
    <Path fill="#FF1493" d="m168 70 3 3-3 3-3-3Z"></Path>
    <Path stroke="#FF1493" strokeWidth={2} d="M168 67v12m-6-6h12"></Path>
    <G>
      <Circle cx={150} cy={104} r={4} fill="#FF1493" />
      <Circle cx={58} cy={104} r={3} fill="#0FF" />
    </G>
    <Path
      stroke="#FFF"
      strokeWidth={2}
      d="m104 30 21 25-21 25-21-25z"
      opacity={0.8}
    />
    <Path
      stroke="#FFF"
      strokeWidth={2}
      d="m104 80 21-25 15 35-36 25z"
      opacity={0.7}
    />
  </Svg>
);
export default SvgOnboarding1;
