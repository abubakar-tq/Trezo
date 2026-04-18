import * as React from "react";
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
/* SVGR has dropped some elements not supported by react-native-svg: animate, animateTransform */
import type { SvgProps } from "react-native-svg";
const SvgOnboarding3 = (props: SvgProps) => (
  <Svg
    viewBox="0 0 208 208"       // ✅ makes SVG scalable
    width="100%"                // ✅ fills parent container width
    height="100%"               // ✅ fills parent container height
    fill="none"
    preserveAspectRatio="xMidYMid meet"  // ✅ keeps aspect ratio
    {...props}
    
  >
    <Defs>
      <LinearGradient
        id="onboarding3_svg__b"
        x1="0%"
        x2="100%"
        y1="0%"
        y2="100%"
      >
        <Stop
          offset="0%"
          stopColor="#0ff" stopOpacity={1}
        />
        <Stop
          offset="50%"
          stopColor="#00ced1" stopOpacity={1}
        />
        <Stop
          offset="100%"
          stopColor="#20b2aa" stopOpacity={1}
        />
      </LinearGradient>
      <LinearGradient
        id="onboarding3_svg__c"
        x1="100%"
        x2="0%"
        y1="0%"
        y2="100%"
      >
        <Stop
          offset="0%"
          stopColor="#ff0" stopOpacity={1}
        />
        <Stop
          offset="50%"
          stopColor="gold" stopOpacity={1}
        />
        <Stop
          offset="100%"
          stopColor="orange" stopOpacity={1}
        />
      </LinearGradient>
      <LinearGradient
        id="onboarding3_svg__d"
        x1="0%"
        x2="100%"
        y1="0%"
        y2="100%"
      >
        <Stop
          offset="0%"
          stopColor="#fff" stopOpacity={1}
        />
        <Stop
          offset="50%"
          stopColor="#f0f0f0" stopOpacity={1}
        />
        <Stop
          offset="100%"
          stopColor="#e0e0e0" stopOpacity={1}
        />
      </LinearGradient>
      <LinearGradient
        id="onboarding3_svg__e"
        x1="0%"
        x2="100%"
        y1="50%"
        y2="50%"
      >
        <Stop
          offset="0%"
          stopColor="#0ff" stopOpacity={1}
        />
        <Stop
          offset="50%"
          stopColor="#ff0" stopOpacity={1}
        />
        <Stop
          offset="100%"
          stopColor="#00ff7f" stopOpacity={1}
        />
      </LinearGradient>
      <RadialGradient id="onboarding3_svg__a" cx="50%" cy="50%" r="50%">
        <Stop
          offset="0%"
          stopColor="#0ff" stopOpacity={0.9}
        />
        <Stop
          offset="50%"
          stopColor="gold" stopOpacity={0.6}
        />
        <Stop
          offset="100%"
          stopColor="#ff0" stopOpacity={0.3}
        />
      </RadialGradient>
    </Defs>
    <Circle
      cx={104}
      cy={104}
      r={90}
      fill="url(#onboarding3_svg__a)"
      opacity={0.5}
    />
    <Path
      fill="url(#onboarding3_svg__b)"
      stroke="#0FF"
      strokeWidth={4}
      d="M104 25q26 10 46 30 0 30-10 55-15 30-36 50-21-20-36-50-10-25-10-55 20-20 46-30Z"
    />
    <Path
      fill="url(#onboarding3_svg__c)"
      stroke="#FF0"
      strokeWidth={3}
      d="M104 40q16 8 31 25 0 20-7 40-10 20-24 35-14-15-24-35-7-20-7-40 15-17 31-25Z"
    />
    <Rect
      width={20}
      height={25}
      x={94}
      y={80}
      fill="url(#onboarding3_svg__d)"
      stroke="#FFF"
      strokeWidth={3}
      rx={3}
    />
    <Circle
      cx={104}
      cy={70}
      r={8}
      stroke="url(#onboarding3_svg__d)"
      strokeWidth={4}
    />
    <Circle cx={104} cy={92} r={3} fill="#0FF"></Circle>
    <Circle
      cx={104}
      cy={30}
      r={5}
      fill="#0FF"
      stroke="#FF0"
      strokeWidth={3}
    ></Circle>
    <Circle
      cx={145}
      cy={75}
      r={4}
      fill="#FF0"
      stroke="#00FF7F"
      strokeWidth={3}
    ></Circle>
    <Circle
      cx={63}
      cy={75}
      r={4}
      fill="#00FF7F"
      stroke="#0FF"
      strokeWidth={3}
    ></Circle>
    <Circle
      cx={85}
      cy={130}
      r={3}
      fill="#00FF7F"
      stroke="#FF0"
      strokeWidth={2}
    ></Circle>
    <Circle
      cx={123}
      cy={130}
      r={3}
      fill="#0FF"
      stroke="#00FF7F"
      strokeWidth={2}
    ></Circle>
    <G stroke="url(#onboarding3_svg__e)" opacity={0.4}>
      <Path d="M20 20h20v20H20ZM168 20h20v20h-20ZM20 168h20v20H20ZM168 168h20v20h-20Z" />
      <Path strokeWidth={0.5} d="M30 20v20M20 30h20M178 20v20M168 30h20" />
    </G>
    <Path fill="#0FF" d="m180 80 5-5 5 5-5 5z"></Path>
    <Path fill="#FF0" d="m28 120 5-5 5 5-5 5z"></Path>
    <Path fill="#FF0" d="M175 140h3v12h-3z" />
    <Circle cx={176.5} cy={138} r={2} stroke="#FF0" strokeWidth={2} />
    <Path fill="#FF0" d="M178 145h4v2h-4zM178 148h2v2h-2z" />
    <Path fill="#00FF7F" d="M30 60h3v12h-3z" />
    <Circle cx={31.5} cy={58} r={2} stroke="#00FF7F" strokeWidth={2} />
    <Path fill="#00FF7F" d="M33 65h4v2h-4zM33 68h2v2h-2z" />
    <Path
      stroke="url(#onboarding3_svg__e)"
      strokeWidth={2}
      d="M50 50h108"
      opacity={0.6}
    ></Path>
    <Path
      stroke="url(#onboarding3_svg__e)"
      strokeWidth={2}
      d="M50 158h108"
      opacity={0.4}
    ></Path>
    <Path fill="#0FF" d="M165 45h2v2h-2z"></Path>
    <Path fill="#FF0" d="M170 50h2v2h-2z"></Path>
    <Path fill="#00FF7F" d="M40 160h2v2h-2z"></Path>
    <Path
      stroke="#FFF"
      strokeWidth={3}
      d="M104 30q11 8 21 20 0 15-5 30"
      opacity={0.8}
    />
    <Circle
      cx={104}
      cy={104}
      r={98}
      stroke="url(#onboarding3_svg__e)"
      strokeDasharray="10,5"
      strokeWidth={2}
      opacity={0.6}
    ></Circle>
  </Svg>
);
export default SvgOnboarding3;
