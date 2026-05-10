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

const TAB_ICON_MAP: Record<
  string,
  React.ComponentProps<typeof Feather>["name"]
> = {
  Home: "home",
  Browser: "compass",
  Portfolio: "pie-chart",
  Dex: "repeat",
  Profile: "user",
};

const INDICATOR_WIDTH = 30;

const TabBar: React.FC<BottomTabBarProps> = ({
  state,
  descriptors,
  navigation,
}) => {
  const { theme } = useAppTheme();
  const { colors, gradients } = theme;
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

  // Per-tab halo opacity — fades in behind the active icon
  const tabGlows = useRef(
    state.routes.map((_, i) =>
      new Animated.Value(i === state.index ? 1 : 0),
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

  // Slide indicator + animate icon scales + fade glows
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

      Animated.timing(tabGlows[i], {
        toValue: i === state.index ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
  }, [state.index, state.routes, indicatorLeft, tabScales, tabGlows]);

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
          shadowColor: colors.accent,
        },
      ]}
      pointerEvents={Platform.OS === "ios" ? undefined : "box-none"}
    >
      {/* Ink-dark glass surface with ghost-violet top border */}
      <View
        style={[
          styles.glassBackground,
          {
            backgroundColor: gradients.tabBar[0],
            borderColor: colors.border,
          },
        ]}
      />

      <View style={styles.row}>
        {/* Sliding top-pill indicator with violet glow */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeIndicator,
            {
              left: indicatorLeft,
              backgroundColor: colors.accent,
              shadowColor: colors.accent,
            },
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
                  tabGlows[index].setValue(1);
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
                {/* Circular violet halo behind active icon */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.iconGlow,
                    {
                      opacity: tabGlows[index],
                      backgroundColor: `${colors.accent}14`,
                    },
                  ]}
                />
                <Feather
                  name={iconName}
                  size={22}
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
      shadowOpacity: 0.22,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: -4 },
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
      paddingVertical: 10,
      zIndex: 1,
    },
    iconWrap: {
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 3,
    },
    iconGlow: {
      position: "absolute",
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    label: {
      fontSize: 11,
      fontWeight: "500",
      letterSpacing: 0.5,
    },
    activeIndicator: {
      position: "absolute",
      top: 0,
      width: INDICATOR_WIDTH,
      height: 3,
      borderRadius: 2,
      shadowOpacity: 0.65,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
  });
}

export default TabBar;
