import { NavigationProp, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import { Dimensions, FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Onboarding1, Onboarding2, Onboarding3 } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import { Button, OnboardingSlide, PageIndicator } from "@shared/components";

const { width } = Dimensions.get("window");

const pages = [
  {
    image: Onboarding1,
    title: "Welcome to Trezo",
    subtitle:
      "Trusted by thousands worldwide, empowering your Web3 journey with seamless access to assets and powerful wallet tools.",
    gradient: ["#9e9e9e", "#bdbdbd", "#e0e0e0"] as const,
  },
  {
    image: Onboarding2,
    title: "EVM Compatible",
    subtitle:
      "Manage your assets across Ethereum, Polygon, BSC and many more chains with fast, secure, and user-friendly integrations.",
    gradient: ["#2196f3", "#00bcd4", "#80deea"] as const,
  },
  {
    image: Onboarding3,
    title: "Secure & Trusted",
    subtitle:
      "Your assets are protected with military-grade encryption, giving you full control and complete peace of mind always.",
    gradient: ["#8e24aa", "#9c27b0", "#ba68c8"] as const,
  },
] as const;

const IntroductionScreen: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList<typeof pages[number]>>(null);
  const { navigate }: NavigationProp<AuthStackParamList> = useNavigation();

  console.log('📱 [IntroductionScreen] Rendering, currentPage:', currentPage);

  const handleScroll = (event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const pageIndex = Math.round(offsetX / width);
    setCurrentPage(pageIndex);
  };

  const handleGetStarted = () => {
    console.log('👉 [IntroductionScreen] Get Started pressed, navigating to Welcome');
    navigate("Welcome");
  };

  return (
    <LinearGradient
      colors={pages[currentPage].gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar style="light" backgroundColor="transparent" translucent />

        <FlatList
          ref={flatListRef}
          data={pages}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item, index }) => (
            <OnboardingSlide
              ImageComponent={item.image}
              title={item.title}
              subtitle={item.subtitle}
              index={index}
            />
          )}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />

        <View style={{ marginBottom: 32 }}>
          <PageIndicator 
            totalPages={pages.length} 
            currentPage={currentPage}
            activeColor="rgba(255, 255, 255, 0.85)"
            inactiveColor="rgba(255, 255, 255, 0.25)"
          />
        </View>

        <View style={{ paddingBottom: 48, paddingHorizontal: 24 }}>
          <Button title="Get Started" onPress={handleGetStarted} variant="primary" size="large" fullWidth />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

export default IntroductionScreen;
