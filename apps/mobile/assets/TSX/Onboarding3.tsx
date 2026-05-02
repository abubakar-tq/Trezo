import * as React from "react";
import { Image } from "expo-image";
import { View, StyleSheet } from "react-native";

const Onboarding3 = (props: any) => (
  <View style={[styles.container, { width: props.width || 300, height: props.height || 300 }]}>
    <Image
      source={require("@/assets/images/rings.png")}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      transition={1000}
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Onboarding3;
