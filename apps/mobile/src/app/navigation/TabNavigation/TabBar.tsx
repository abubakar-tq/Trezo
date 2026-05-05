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

const TAB_ICON_MAP: Record<
  string,
  React.ComponentProps<typeof Feather>["name"]
> = {
  Home: "home",
  Browser: "globe",
  Portfolio: "pie-chart",
  Dex: "repeat",
  Profile: "user",
};

// Thin top-pill indicator width — fixed, centers on each tab
const INDICATOR_WIDTH = 28;

const TabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { theme } = useAppTheme();
  const { colors, mode } = theme;
  const insets = useSafeAreaInsets();

  const styles = useMemo(() => createStyles(colors), [colors]);

  // Keyboard slide-away
  const visibility = useRef(new Animated.Value(0)).current;

  // Indicator horizontal position (springs between tabs)
  const indicatorLeft = useRef(new Animated.Value(0)).current;

  // Per-tab icon scale for fluid tap feedback
  const tabScales = useRef(
    state.routes.map((_, i) =>
      new Animated.Value(i === state.index ? 1 : 0.86),
    ),
  ).current;

  const tabLayouts = useRef<Record<string, { x: number; width: number }>>({});

  // Keyboard hide/show
  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

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

  // Slide indicator + animate each tab's icon scale
  useEffect(() => {
    const routeKey = state.routes[state.index]?.key;
    if (!routeKey) return;
    const layout = tabLayouts.current[routeKey];
    if (!layout) return;

    Animated.spring(indicatorLeft, {
      toValue: layout.x + (layout.width - INDICATOR_WIDTH) / 2,
      useNativeDriver: false,
      stiffness: 300,
      damping: 26,
      mass: 0.55,
    }).start();

    state.routes.forEach((_, i) => {
      Animated.spring(tabScales[i], {
        toValue: i === state.index ? 1 : 0.86,
        useNativeDriver: true,
        stiffness: 280,
        damping: 22,
        mass: 0.55,
      }).start();
    });
  }, [state.index, state.routes, indicatorLeft, tabScales]);

  const glass = useMemo(
    () => ({
      background: withAlpha(colors.surfaceElevated, 0.97),
      border: withAlpha(colors.borderMuted, mode === "dark" ? 0.6 : 0.3),
    }),
    [colors, mode],
  );

  const animatedContainerStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: visibility.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 90 + insets.bottom],
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
          paddingBottom: Math.max(
            insets.bottom,
            Platform.OS === "ios" ? 16 : 10,
          ),
          shadowColor: withAlpha(colors.textPrimary, 0.3),
        },
      ]}
      pointerEvents={Platform.OS === "ios" ? undefined : "box-none"}
    >
      {/* Glass surface */}
      <View
        style={[
          styles.glassBackground,
          { backgroundColor: glass.background, borderColor: glass.border },
        ]}
      />

      <View style={styles.row}>
        {/* Thin sliding top-pill indicator */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            { left: indicatorLeft, backgroundColor: colors.accent },
          ]}
        />

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key] ?? {};
          const label =
            typeof options?.tabBarLabel === "string"
              ? options.tabBarLabel
              : (options?.title ?? route.name);
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
              onLayout={(e) => {
                tabLayouts.current[route.key] = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                };
                if (state.index === index) {
                  indicatorLeft.setValue(
                    e.nativeEvent.layout.x +
                      (e.nativeEvent.layout.width - INDICATOR_WIDTH) / 2,
                  );
                  tabScales[index].setValue(1);
                }
              }}
              style={styles.tab}
            >
              <Animated.View
                style={[
                  styles.iconWrap,
                  { transform: [{ scale: tabScales[index] }] },
                ]}
              >
                <Feather
                  name={iconName}
                  size={20}
                  color={isFocused ? colors.accent : colors.textSecondary}
                />
              </Animated.View>
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? colors.accent : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
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
      paddingTop: 3,
      paddingHorizontal: 10,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      overflow: "hidden",
      shadowOpacity: 0.15,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -3 },
      elevation: 14,
    },
    glassBackground: {
      ...StyleSheet.absoluteFillObject,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
    },
    row: {
      position: "relative",
      flexDirection: "row",
      alignItems: "stretch",
      justifyContent: "space-between",
      paddingVertical: 2,
      paddingHorizontal: Platform.select({ ios: 2, default: 0 }),
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      zIndex: 1,
    },
    iconWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 2,
    },
    label: {
      fontSize: 10,
      fontWeight: "600",
      letterSpacing: 0.15,
    },
    // Thin pill at the top edge — slides horizontally with spring
    activeIndicator: {
      position: "absolute",
      top: 0,
      width: INDICATOR_WIDTH,
      height: 3,
      borderRadius: 2,
    },
  });
}

export default TabBar;
