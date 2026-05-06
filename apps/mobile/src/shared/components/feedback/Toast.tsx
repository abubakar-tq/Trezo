import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

export type ToastSeverity = "info" | "warning" | "error";

export interface ToastProps {
  visible: boolean;
  message: string;
  severity?: ToastSeverity;
  durationMs?: number;
  onHide?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  severity = "info",
  durationMs = 3000,
  onHide,
}) => {
  const { theme } = useAppTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        onHide?.();
      });
    }, durationMs);
    return () => clearTimeout(t);
  }, [visible, durationMs, opacity, onHide]);

  if (!visible) return null;

  const color =
    severity === "error" ? theme.colors.danger : severity === "warning" ? theme.colors.warning : theme.colors.accent;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { opacity, backgroundColor: withAlpha(color, 0.18), borderColor: withAlpha(color, 0.5) }]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color: theme.colors.textPrimary }]} numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 100,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
  },
});

export default Toast;
