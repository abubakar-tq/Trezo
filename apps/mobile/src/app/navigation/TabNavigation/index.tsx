import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import React from "react";
import { View } from "react-native";

import { TabStackParamList } from "@/src/types/navigation";

import { BrowserScreen } from "@features/browser";
import { DexScreen } from "@features/dex";
import { HomeScreen } from "@features/home";
import ProfileScreen from "@features/profile/screens/ProfileScreen";
import PortfolioScreen from "@features/portfolio/screens/PortfolioScreen";
import { useAppTheme } from "@theme";
import TabBar from "./TabBar";

const Tab = createBottomTabNavigator<TabStackParamList>();

const TabNavigation = () => {
  const { theme } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Tab.Navigator
        initialRouteName="Home"
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={() => ({
          headerShown: false,
          sceneContainerStyle: {
            backgroundColor: theme.colors.background,
          },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Browser" component={BrowserScreen} />
        <Tab.Screen name="Portfolio" component={PortfolioScreen} />
        <Tab.Screen name="Dex" component={DexScreen} options={{ title: "DEX" }} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
    </View>
  );
};

export default TabNavigation;