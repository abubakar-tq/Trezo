import { NavigationProp, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import { Dimensions, FlatList, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Onboarding1, Onboarding2, Onboarding3 } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import { Button } from "@shared/components";
import OnboardingSlide from "@shared/components/ui/OnboardingSlide";

const { width } = Dimensions.get("window");

const pages = [
  {
    image: Onboarding1,
    title: "Your Keys.\nYour Wallet.",
    subtitle:
      "Passkey-first security means only you control your assets. No seed phrases. No compromises.",
    badge: "Passkey-First",
    gradient: ["#060312", "#0D0626", "#140B3C"] as [string, string, string],
    accentColor: "#8B5CF6",
    glowColor: "rgba(139, 92, 246, 0.38)",
  },
  {
    image: Onboarding2,
    title: "Every Chain.\nOne Wallet.",
    subtitle:
      "Ethereum, Polygon, BSC and 10+ EVM networks — all managed from a single beautiful interface.",
    badge: "10+ Networks",
    gradient: ["#030B1A", "#05152E", "#072044"] as [string, string, string],
    accentColor: "#06B6D4",
    glowColor: "rgba(6, 182, 212, 0.38)",
  },
  {
    image: Onboarding3,
    title: "Built to\nProtect You.",
    subtitle:
      "Multi-layer security with social recovery and passkey validation. Recover anything, lose nothing.",
    badge: "Military-Grade",
    gradient: ["#030A08", "#051610", "#08201A"] as [string, string, string],
    accentColor: "#10B981",
    glowColor: "rgba(16, 185, 129, 0.38)",
  },
];

const IntroductionScreen: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const { navigate } = useNavigation<NavigationProp<AuthStackParamList>>();

  const handleMomentumScrollEnd = (event: {
    nativeEvent: { contentOffset: { x: number } };
  }) => {
    const pageIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentPage(pageIndex);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="transparent" translucent />

      {/* Per-page background gradient — transitions smoothly via state */}
      <LinearGradient
        colors={pages[currentPage].gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Thin-line progress indicators (reference style) */}
        <View style={styles.indicators}>
          {pages.map((_, i) => (
            <View
              key={i}
              style={[
                styles.indicator,
                {
                  backgroundColor:
                    i <= currentPage
                      ? "rgba(255,255,255,0.9)"
                      : "rgba(255,255,255,0.22)",
                },
              ]}
            />
          ))}
        </View>

        {/* Slides */}
        <FlatList
          ref={flatListRef}
          data={pages}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item, index }) => (
            <OnboardingSlide
              ImageComponent={item.image}
              title={item.title}
              subtitle={item.subtitle}
              badge={item.badge}
              index={index}
              isActive={currentPage === index}
              accentColor={item.accentColor}
              glowColor={item.glowColor}
            />
          )}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          style={styles.list}
        />

        {/* CTA button */}
        <View style={styles.buttonArea}>
          <Button
            label="Get Started"
            onPress={() => navigate("Welcome")}
            variant="primary"
            size="lg"
            fullWidth
          />
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#060312",
  },
  safeArea: {
    flex: 1,
  },
  indicators: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  indicator: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  list: {
    flex: 1,
  },
  buttonArea: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
  },
});

export default IntroductionScreen;
