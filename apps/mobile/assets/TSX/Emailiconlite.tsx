import React from "react";
import Svg, { Path } from "react-native-svg";

const EmailIconLite = ({ width = 24, height = 24, color = "black" }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M22 5c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5zm-2 0l-8 6-8-6h16zm0 14H4V7l8 6 8-6v12z"
      fill={color}
    />
  </Svg>
);

export default EmailIconLite;
