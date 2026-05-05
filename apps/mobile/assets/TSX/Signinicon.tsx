import React from "react";
import { StyleSheet, View } from "react-native";
import { Image, ImageProps } from "expo-image";

/**
 * SigninIcon — Renders the official Trezo app logo (icon1.png).
 * This replaces the previous SVG-based diamond to match the actual brand identity.
 */
interface SigninIconProps extends Partial<ImageProps> {
  size?: number;
  width?: number;
  height?: number;
}

const SigninIcon: React.FC<SigninIconProps> = ({ size = 64, width, height, style, ...props }) => {
  const finalWidth = width ?? size;
  const finalHeight = height ?? size;

  return (
    <View
      style={[
        {
          width: finalWidth,
          height: finalHeight,
          borderRadius: finalWidth / 2,
          overflow: "hidden",
          backgroundColor: "#000",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.1)",
          justifyContent: "center",
          alignItems: "center",
        },
        style,
      ]}
    >
      <Image
        source={require("@/assets/images/icon_nobackground.png")}
        style={{
          width: finalWidth,
          height: finalHeight,
        }}
        contentFit="cover"
        transition={1000}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({});

export default SigninIcon;
