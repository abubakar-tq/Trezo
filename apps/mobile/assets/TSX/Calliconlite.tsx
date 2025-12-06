import React from "react";
import Svg, { Path } from "react-native-svg";

const CallIconLite = ({ width = 24, height = 24, color = "black" }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M21.384 17.339c-1.234-1.191-2.819-2.04-4.296-2.311-.31-.054-.63-.003-.89.13l-1.84 1.01c-3.21-1.74-6.34-4.87-8.08-8.08l1.01-1.84c.133-.26.184-.58.13-.89-.271-1.477-1.12-3.062-2.31-4.296C4.004.026 2.07 0 2.07 0S.026 1.934 1.08 5.038c1.293 3.81 3.56 7.52 6.68 10.64s6.83 5.387 10.64 6.68c3.104 1.054 5.038 1.08 5.038 1.08s.026-1.934-1.054-3.033z"
      fill={color}
    />
  </Svg>
);

export default CallIconLite;
