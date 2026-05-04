import React from "react";
import { Dimensions, Text, View } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

const { width } = Dimensions.get("window");

type OnboardingSlideProps = {
  ImageComponent: React.ComponentType<{ width: string | number; height: string | number }>;
  title: string;
  subtitle: string;
  index: number;
};

const OnboardingSlide: React.FC<OnboardingSlideProps> = ({
  ImageComponent,
  title,
  subtitle,
  index,
}) => {
  return (
    <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
      <Animated.View
        entering={FadeInDown.delay(200 * index).duration(800)}
        style={{
          width: '92%',
          aspectRatio: 1,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderRadius: 9999,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          marginBottom: 48,
          shadowColor: "#000",
          shadowOffset: {
            width: 0,
            height: 10,
          },
          shadowOpacity: 0.25,
          shadowRadius: 20,
          elevation: 10,
        }}
      >
        <ImageComponent width="98%" height="98%" />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(400 * index).duration(800)} style={{ marginBottom: 16 }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', textAlign: 'center', paddingHorizontal: 20 }}>
          {title}
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(600 * index).duration(800)}>
        <Text style={{ color: 'white', fontSize: 16, textAlign: 'center', opacity: 0.8, paddingHorizontal: 20, lineHeight: 24 }}>
          {subtitle}
        </Text>
      </Animated.View>
    </View>
  );
};

export default OnboardingSlide;
