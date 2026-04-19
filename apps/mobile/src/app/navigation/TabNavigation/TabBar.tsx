/**
 * Custom TabBar with brighter accent and sliding indicator.
 * Visually prominent, animated, no infinite scroll.
 */
import { Feather } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Animated,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

const TAB_ICON_MAP: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
  Home: "home",
  Browser: "globe",
  Portfolio: "pie-chart",
  Dex: "hexagon",
  Profile: "user",
};

const INDICATOR_HORIZONTAL_MARGIN = 6;
const INDICATOR_VERTICAL_MARGIN = 6;

const TabBar: React.FC<BottomTabBarProps> = ({ state, descriptors, navigation }) => {
  const { theme } = useAppTheme();
  const { colors, mode } = theme;
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => createStyles(colors), [colors]);
  const visibility = useRef(new Animated.Value(0)).current;
  const indicatorLeft = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, () => {
      Animated.timing(visibility, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      Animated.timing(visibility, {
        toValue: 0,
        duration: 210,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visibility]);

  useEffect(() => {
    const routeKey = state.routes[state.index]?.key;
    if (!routeKey) {
      return;
    }
    const layout = tabLayouts.current[routeKey];
    if (!layout) {
      return;
    }
    Animated.spring(indicatorLeft, {
      toValue: layout.x + INDICATOR_HORIZONTAL_MARGIN,
      useNativeDriver: false,
      stiffness: 220,
      damping: 22,
      mass: 0.7,
    }).start();
    Animated.spring(indicatorWidth, {
      toValue: Math.max(layout.width - INDICATOR_HORIZONTAL_MARGIN * 2, 0),
      useNativeDriver: false,
      stiffness: 240,
      damping: 26,
      mass: 0.7,
    }).start();
  }, [state.index, state.routes, indicatorLeft, indicatorWidth]);

  const glass = useMemo(() => ({
    background: withAlpha(colors.surfaceElevated, mode === "dark" ? 0.86 : 0.96),
    border: withAlpha(colors.borderMuted, mode === "dark" ? 0.65 : 0.35),
    separator: withAlpha(colors.borderMuted, mode === "dark" ? 0.5 : 0.28),
    accentFill: withAlpha(colors.accent, mode === "dark" ? 0.28 : 0.18),
    accentBorder: withAlpha(colors.accent, mode === "dark" ? 0.55 : 0.34),
  }), [colors, mode]);

  const animatedContainerStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: visibility.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 96 + insets.bottom],
          }),
        },
      ],
      opacity: visibility.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0],
      }),
    }),
    [visibility, insets.bottom],
  );

  return (
    <Animated.View
      style={[
        styles.container,
        animatedContainerStyle,
        {
          paddingBottom: Math.max(insets.bottom, Platform.OS === "ios" ? 18 : 12),
          shadowColor: withAlpha(colors.textPrimary, 0.45),
        },
      ]}
      pointerEvents={Platform.OS === "ios" ? undefined : "box-none"}
    >
      <View style={[styles.glassBackground, { backgroundColor: glass.background, borderColor: glass.border }]} />

      <View style={styles.row}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeMask,
            {
              left: indicatorLeft,
              width: indicatorWidth,
              backgroundColor: glass.accentFill,
              borderColor: glass.accentBorder,
            },
          ]}
        />
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key] ?? {};
          const label =
            typeof options?.tabBarLabel === "string"
              ? options.tabBarLabel
              : options?.title ?? route.name;
          const iconName = TAB_ICON_MAP[route.name] ?? "circle";

          const handlePress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          const handleLongPress = () => {
            navigation.emit({ type: "tabLongPress", target: route.key });
          };

          return (
            <Pressable
              key={route.key}
              onPress={handlePress}
              onLongPress={handleLongPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options?.tabBarAccessibilityLabel}
              onLayout={(event) => {
                tabLayouts.current[route.key] = {
                  x: event.nativeEvent.layout.x,
                  width: event.nativeEvent.layout.width,
                };
                if (state.index === index) {
                  indicatorLeft.setValue(event.nativeEvent.layout.x + INDICATOR_HORIZONTAL_MARGIN);
                  indicatorWidth.setValue(
                    Math.max(event.nativeEvent.layout.width - INDICATOR_HORIZONTAL_MARGIN * 2, 0),
                  );
                }
              }}
              style={styles.tab}
            >
              <View style={styles.iconRow}>
                <Feather
                  name={iconName}
                  size={21}
                  color={isFocused ? colors.accent : colors.textSecondary}
                  style={{ transform: [{ scale: isFocused ? 1 : 0.96 }] }}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? colors.accent : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {index < state.routes.length - 1 ? (
                <View
                  pointerEvents="none"
                  style={[styles.separator, { backgroundColor: glass.separator }]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
};

function createStyles(_colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingTop: 6,
      paddingHorizontal: 12,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      overflow: "hidden",
    },
    glassBackground: {
      ...StyleSheet.absoluteFillObject,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
    },
    row: {
      position: "relative",
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "space-between",
      paddingVertical: 6,
      paddingHorizontal: Platform.select({ ios: 4, default: 2 }),
    },
    tab: {
      flex: 1,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      borderRadius: 18,
      zIndex: 1,
    },
    iconRow: {
      marginBottom: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    label: {
      fontSize: 12,
      fontWeight: "600",
      marginTop: 2,
    },
    separator: {
      position: "absolute",
      top: 12,
      right: -2,
      width: StyleSheet.hairlineWidth,
      height: "52%",
    },
    activeMask: {
      position: "absolute",
      top: INDICATOR_VERTICAL_MARGIN,
      bottom: INDICATOR_VERTICAL_MARGIN,
      borderRadius: 16,
      borderWidth: 1,
    },
  });
}

export default TabBar;