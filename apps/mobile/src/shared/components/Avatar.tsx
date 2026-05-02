import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

type AvatarProps = {
  size?: number;
  uri?: string | null;
  label?: string;
};

const getInitials = (label?: string) => {
  if (!label) return "";
  const parts = label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) return "";
  return parts
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const Avatar: React.FC<AvatarProps> = ({ size = 44, uri, label }) => {
  const initials = getInitials(label);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.initials, { fontSize: size / 2 }]}>{initials || "?"}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 255, 255, 0.2)",
  },
  initials: {
    color: "#f9fafb",
    fontWeight: "700",
  },
});

export default Avatar;
