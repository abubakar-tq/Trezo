import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, AccessibilityInfo } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { useAppTheme } from "@theme";
import type { SimulationStatus } from "@features/transactions/types/txPreview";

type Props = { loading: boolean; status?: SimulationStatus; revertReason?: string };

const FADE_DURATION = 200;

export function SimulationStatusPill({ loading, status, revertReason }: Props) {
  const { theme } = useAppTheme();
  const c = theme.colors;

  // opacity for the "Simulating…" state (1 while loading, fades to 0 when resolved)
  const loadingOpacity = useSharedValue(loading ? 1 : 0);
  // opacity for the resolved state (0 while loading, fades to 1 when resolved)
  const resolvedOpacity = useSharedValue(loading ? 0 : 1);

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      const duration = reduceMotion ? 0 : FADE_DURATION;
      if (loading) {
        loadingOpacity.value = withTiming(1, { duration });
        resolvedOpacity.value = withTiming(0, { duration });
      } else {
        loadingOpacity.value = withTiming(0, { duration });
        resolvedOpacity.value = withTiming(1, { duration });
      }
    });
  }, [loading, loadingOpacity, resolvedOpacity]);

  const loadingStyle = useAnimatedStyle(() => ({ opacity: loadingOpacity.value }));
  const resolvedStyle = useAnimatedStyle(() => ({ opacity: resolvedOpacity.value }));

  const resolvedContent = getResolvedContent(status, revertReason, c);

  return (
    <View style={styles.container}>
      {/* Simulating pill — fades out when resolved */}
      <Animated.View style={[StyleSheet.absoluteFill, loadingStyle]} pointerEvents={loading ? "auto" : "none"}>
        <Pill bg={c.accentSoft} fg={c.accent}>
          <ActivityIndicator size="small" color={c.accent} />
          <Label fg={c.accent}>Simulating on-chain…</Label>
        </Pill>
      </Animated.View>

      {/* Resolved pill — fades in when loading finishes */}
      <Animated.View style={[StyleSheet.absoluteFill, resolvedStyle]} pointerEvents={loading ? "none" : "auto"}>
        <Pill bg={resolvedContent.bg} fg={resolvedContent.fg}>
          {resolvedContent.children}
        </Pill>
      </Animated.View>

      {/* Invisible spacer so the container has the right height */}
      <View style={styles.sizer} />
    </View>
  );
}

function getResolvedContent(
  status: SimulationStatus | undefined,
  revertReason: string | undefined,
  c: ReturnType<typeof useAppTheme>["theme"]["colors"],
) {
  if (status === "revert") {
    return {
      bg: c.dangerSoft,
      fg: c.danger,
      children: <Label fg={c.danger}>Will fail: {revertReason ?? "reverts"}</Label>,
    };
  }
  if (status === "unknown") {
    return {
      bg: c.warningSoft,
      fg: c.warning,
      children: <Label fg={c.warning}>{"Couldn't simulate changes — proceed with care"}</Label>,
    };
  }
  // success (or undefined — not yet resolved, but resolved overlay will be invisible)
  return {
    bg: c.successSoft,
    fg: c.success,
    children: <Label fg={c.success}>✓ Simulation passed</Label>,
  };
}

function Pill({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: fg }]}>{children}</View>
  );
}

function Label({ fg, children }: { fg: string; children: React.ReactNode }) {
  return (
    <Text style={[styles.txt, { color: fg }]} numberOfLines={2}>
      {children}
    </Text>
  );
}

const PILL_HEIGHT = 46; // paddingVertical 11 * 2 + ~24 text

const styles = StyleSheet.create({
  container: { marginTop: 16, height: PILL_HEIGHT },
  sizer: { height: PILL_HEIGHT },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  txt: { fontSize: 13, fontWeight: "600" },
});
