import React from "react";
import Svg, { Path } from "react-native-svg";

const MessageIcon = ({ width = 24, height = 24, color = "black" }) => (
  <Svg width={width} height={height} viewBox="0 0 24 24" fill="none">
    <Path
      d="M14.1667 7.29167H5.83333C5.49167 7.29167 5.20833 7.00833 5.20833 6.66667C5.20833 6.325 5.49167 6.04167 5.83333 6.04167H14.1667C14.5083 6.04167 14.7917 6.325 14.7917 6.66667C14.7917 7.00833 14.5083 7.29167 14.1667 7.29167Z"
      fill={color}
    />
  </Svg>
);

export default MessageIcon;
