import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Text, View } from "react-native";

type PlaceholderProps = {
  width: string | number;
  height: string | number;
};

const OnboardingPlaceholder: React.FC<PlaceholderProps> = ({ width, height }) => {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <LinearGradient
        colors={["#1877f2", "#6945ed", "#8b5cf6"] as const}
        style={{
          width: 200,
          height: 200,
          borderRadius: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 24, fontWeight: "bold" }}>
          Trezo
        </Text>
      </LinearGradient>
    </View>
  );
};

export default OnboardingPlaceholder;
