import React from "react";
import { View, ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@theme";

export type TabScreenContainerProps = ViewProps & {
  children: React.ReactNode;
  paddingTopExtra?: number;
  minTopPadding?: number;
  includeBottomInset?: boolean;
  includeHorizontalInsets?: boolean;
};

const TabScreenContainer: React.FC<TabScreenContainerProps> = ({
  children,
  style,
  paddingTopExtra = 0,
  minTopPadding = 0,
  includeBottomInset = false,
  includeHorizontalInsets = false,
  ...rest
}) => {
  const insets = useSafeAreaInsets();
  const {
    theme: { colors },
  } = useAppTheme();

  const paddingTop = Math.max(insets.top, minTopPadding) + paddingTopExtra;
  const paddingBottom = includeBottomInset ? insets.bottom : 0;
  const paddingHorizontal = includeHorizontalInsets
    ? Math.max(insets.left, insets.right)
    : 0;

  return (
    <View
      {...rest}
      style={[
        {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop,
          paddingBottom,
          paddingHorizontal,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export default TabScreenContainer;
