import Svg, {
    Circle,
    Defs,
    Ellipse,
    G,
    LinearGradient,
    Path,
    RadialGradient,
    Stop,
} from "react-native-svg";
/* SVGR has dropped some elements not supported by react-native-svg: animateTransform, animate */
import type { SvgProps } from "react-native-svg";
const SvgOnboarding2 = (props: SvgProps) => (
  <Svg
    viewBox="0 0 208 208" // ✅ makes SVG scalable
    width="100%" // ✅ fills parent container width
    height="100%" // ✅ fills parent container height
    preserveAspectRatio="xMidYMid meet" // ✅ keeps aspect ratio
    // fill="none"
    {...props}
  >
    <Defs>
      <LinearGradient
        id="onboarding2_svg__b"
        x1="0%"
        x2="100%"
        y1="0%"
        y2="100%"
      >
        <Stop offset="0%" stopColor="#ff4500" stopOpacity={1} />
        <Stop offset="50%" stopColor="tomato" stopOpacity={1} />
        <Stop offset="100%" stopColor="gold" stopOpacity={1} />
      </LinearGradient>
      <LinearGradient
        id="onboarding2_svg__c"
        x1="100%"
        x2="0%"
        y1="0%"
        y2="100%"
      >
        <Stop offset="0%" stopColor="#ff1493" stopOpacity={1} />
        <Stop offset="50%" stopColor="#dc143c" stopOpacity={1} />
        <Stop offset="100%" stopColor="#b22222" stopOpacity={1} />
      </LinearGradient>
      <LinearGradient
        id="onboarding2_svg__d"
        x1="0%"
        x2="100%"
        y1="50%"
        y2="50%"
      >
        <Stop offset="0%" stopColor="#ff0" stopOpacity={1} />
        <Stop offset="50%" stopColor="orange" stopOpacity={1} />
        <Stop offset="100%" stopColor="#ff4500" stopOpacity={1} />
      </LinearGradient>
      <RadialGradient id="onboarding2_svg__a" cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="gold" stopOpacity={0.9} />
        <Stop offset="70%" stopColor="#ff4500" stopOpacity={0.6} />
        <Stop offset="100%" stopColor="#ff1493" stopOpacity={0.3} />
      </RadialGradient>
    </Defs>
    <Circle
      cx={104}
      cy={104}
      r={95}
      fill="url(#onboarding2_svg__a)"
      opacity={0.4}
    />
    <Path
      fill="url(#onboarding2_svg__b)"
      stroke="gold"
      strokeWidth={4}
      d="m104 60 26 15v30l-26 15-26-15V75z"
    />
    <Path
      fill="url(#onboarding2_svg__c)"
      stroke="#FF1493"
      strokeWidth={3}
      d="m104 70 16 10v20l-16 10-16-10V80z"
      opacity={0.95}
    />
    <G stroke="url(#onboarding2_svg__d)" opacity={0.8}>
      <Ellipse cx={104} cy={35} strokeWidth={4} rx={15} ry={8} />
      <Ellipse cx={104} cy={50} strokeWidth={3} rx={12} ry={6} />
      <Path strokeWidth={3} d="M104 43v17" />
      <Ellipse cx={160} cy={104} strokeWidth={4} rx={8} ry={15} />
      <Ellipse cx={145} cy={104} strokeWidth={3} rx={6} ry={12} />
      <Path strokeWidth={3} d="M130 104h23" />
      <Ellipse cx={104} cy={173} strokeWidth={4} rx={15} ry={8} />
      <Ellipse cx={104} cy={158} strokeWidth={3} rx={12} ry={6} />
      <Path strokeWidth={3} d="M104 120v45" />
      <Ellipse cx={48} cy={104} strokeWidth={4} rx={8} ry={15} />
      <Ellipse cx={63} cy={104} strokeWidth={3} rx={6} ry={12} />
      <Path strokeWidth={3} d="M78 104H55" />
    </G>
    <Path
      fill="url(#onboarding2_svg__c)"
      stroke="#FF1493"
      strokeWidth={3}
      d="m60 60 10-5 10 10-10 10-10-5-10-5z"
      opacity={0.9}
    ></Path>
    <Path
      fill="url(#onboarding2_svg__b)"
      stroke="gold"
      strokeWidth={3}
      d="m148 60 10-5 10 10-10 10-10-5-10-5z"
      opacity={0.9}
    ></Path>
    <Path
      fill="url(#onboarding2_svg__b)"
      stroke="tomato"
      strokeWidth={3}
      d="m60 148 10-5 10 10-10 10-10-5-10-5z"
      opacity={0.9}
    ></Path>
    <Path
      fill="url(#onboarding2_svg__c)"
      stroke="#DC143C"
      strokeWidth={3}
      d="m148 148 10-5 10 10-10 10-10-5-10-5z"
      opacity={0.9}
    ></Path>
    <Circle
      cx={30}
      cy={50}
      r={6}
      fill="#FF0"
      stroke="gold"
      strokeWidth={3}
    ></Circle>
    <Circle
      cx={178}
      cy={50}
      r={5}
      fill="#FF4500"
      stroke="gold"
      strokeWidth={3}
    ></Circle>
    <Circle
      cx={30}
      cy={158}
      r={6}
      fill="#FF1493"
      stroke="gold"
      strokeWidth={3}
    ></Circle>
    <Circle
      cx={178}
      cy={158}
      r={5}
      fill="orange"
      stroke="#FF0"
      strokeWidth={3}
    ></Circle>
    <Path
      stroke="url(#onboarding2_svg__d)"
      strokeWidth={2}
      d="M30 50q50-20 100 25"
      opacity={0.6}
    ></Path>
    <Path
      stroke="url(#onboarding2_svg__d)"
      strokeWidth={2}
      d="M178 50Q128 30 78 75"
      opacity={0.6}
    ></Path>
    <Path
      stroke="url(#onboarding2_svg__d)"
      strokeWidth={2}
      d="M130 105q20 23 48 53"
      opacity={0.6}
    ></Path>
    <Path
      stroke="url(#onboarding2_svg__d)"
      strokeWidth={2}
      d="M78 105q-20 23-48 53"
      opacity={0.6}
    ></Path>
    <Path fill="gold" d="M179 83.343 184.657 89 179 94.657 173.343 89z"></Path>
    <Path
      fill="#FF4500"
      d="M178 93.757 182.243 98 178 102.243 173.757 98z"
    ></Path>
    <Path
      fill="#FF1493"
      d="m179 103.343 5.657 5.657-5.657 5.657-5.657-5.657z"
    ></Path>
    <Path fill="#FF4500" d="m20 20 5-5 5 5v5l-5 5-5-5z" opacity={0.8} />
    <Path fill="gold" d="m178 20 5-5 5 5v5l-5 5-5-5z" opacity={0.8} />
    <Path fill="#FF1493" d="m20 178 5-5 5 5v5l-5 5-5-5z" opacity={0.8} />
    <Path fill="orange" d="m178 178 5-5 5 5v5l-5 5-5-5z" opacity={0.8} />
    <Circle cx={104} cy={90} r={3} fill="#FFF"></Circle>
  </Svg>
);
export default SvgOnboarding2;
