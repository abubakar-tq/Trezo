import type { SvgProps } from "react-native-svg";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
const SvgKeyicon = (props: SvgProps) => (
  <Svg width={48} height={48} fill="none" {...props}>
    <Rect width={48} height={48} fill="url(#keyicon_svg__a)" rx={24} />
    <Path
      fill="#fff"
      d="M31.79 16.22c-2.96-2.95-7.76-2.95-10.7 0-2.07 2.05-2.69 5-1.89 7.6l-4.7 4.7c-.33.34-.56 1.01-.49 1.49l.3 2.18c.11.72.78 1.4 1.5 1.5l2.18.3c.48.07 1.15-.15 1.49-.5l.82-.82c.2-.19.2-.51 0-.71l-1.94-1.94a.754.754 0 0 1 0-1.06c.29-.29.77-.29 1.06 0l1.95 1.95c.19.19.51.19.7 0l2.12-2.11c2.59.81 5.54.18 7.6-1.87 2.95-2.95 2.95-7.76 0-10.71M26.5 24a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5"
    />
    <Defs>
      <LinearGradient
        id="keyicon_svg__a"
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
export default SvgKeyicon;
