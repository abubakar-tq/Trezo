import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';

const AnimatedSplashBackground: React.FC = () => {
  // Animation values
  const backgroundFloat = useSharedValue(0);
  const diamondRotation = useSharedValue(0);
  const circleScale = useSharedValue(1);

  useEffect(() => {
    // Floating background elements
    backgroundFloat.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    
    // Diamond rotation
    diamondRotation.value = withRepeat(
      withTiming(360, { duration: 12000, easing: Easing.linear }),
      -1,
      false
    );
    
    // Circle pulsing
    circleScale.value = withRepeat(
      withTiming(1.2, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [backgroundFloat, diamondRotation, circleScale]);

  // Animated styles
  const floatingStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(backgroundFloat.value, [0, 1], [0, -20]) },
      { scale: interpolate(backgroundFloat.value, [0, 1], [1, 1.05]) }
    ],
    opacity: interpolate(backgroundFloat.value, [0, 1], [0.6, 0.9]),
  }));
  
  const diamondStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${diamondRotation.value}deg` }],
  }));
  
  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }],
    opacity: interpolate(circleScale.value, [1, 1.2], [0.7, 0.9]),
  }));

  return (
    <View style={styles.container}>
      {/* Static Base Gradient - No Animation */}
      <LinearGradient
        colors={[
          "#0a0a0f",
          "#1a0f2e", 
          "#2d1b4e",
          "#1a0f2e",
          "#0a0a0f"
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Floating gradient orbs - positioned and contained */}
      <Animated.View style={[floatingStyle, styles.orb1]}>
        <LinearGradient
          colors={["rgba(24, 119, 242, 0.4)", "transparent"]}
          style={styles.orb1Gradient}
        />
      </Animated.View>
      
      <Animated.View style={[floatingStyle, styles.orb2]}>
        <LinearGradient
          colors={["rgba(105, 69, 237, 0.3)", "transparent"]}
          style={styles.orb2Gradient}
        />
      </Animated.View>
      
      <Animated.View style={[floatingStyle, styles.orb3]}>
        <LinearGradient
          colors={["rgba(168, 85, 247, 0.25)", "transparent"]}
          style={styles.orb3Gradient}
        />
      </Animated.View>

      {/* Geometric decorations */}
      <View style={styles.geometricContainer}>
        {/* Animated diamond - top left */}
        <Animated.View 
          style={[diamondStyle, styles.diamond]}
        >
          <LinearGradient
            colors={["#8b5cf6", "#a855f7", "#c084fc"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.diamondGradient}
          />
        </Animated.View>
        
        {/* Animated circle - top right */}
        <Animated.View 
          style={[circleStyle, styles.circle]}
        >
          <LinearGradient
            colors={["#1877f2", "#3b82f6", "#60a5fa"]}
            style={styles.circleGradient}
          />
        </Animated.View>
        
        {/* Static geometric elements */}
        <View style={styles.verticalLine} />
        <View style={styles.horizontalLine} />
        
        {/* Floating lines */}
        <View style={styles.floatingLine1Container}>
          <LinearGradient
            colors={["rgba(139, 92, 246, 0.6)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.floatingLine1}
          />
        </View>
        
        <View style={styles.floatingLine2Container}>
          <LinearGradient
            colors={["rgba(24, 119, 242, 0.5)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.floatingLine2}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb1: {
    position: 'absolute',
    top: 80,
    left: 64,
  },
  orb1Gradient: {
    width: 128,
    height: 128,
    borderRadius: 64,
  },
  orb2: {
    position: 'absolute',
    bottom: 128,
    right: 48,
  },
  orb2Gradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
  },
  orb3: {
    position: 'absolute',
    top: '33%',
    right: 32,
  },
  orb3Gradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  geometricContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  diamond: {
    position: 'absolute',
    top: 80,
    left: 32,
  },
  diamondGradient: {
    width: 24,
    height: 24,
    transform: [{ rotate: '45deg' }],
    borderRadius: 4,
  },
  circle: {
    position: 'absolute',
    top: 120,
    right: 48,
  },
  circleGradient: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  verticalLine: {
    position: 'absolute',
    top: 240,
    left: 48,
    width: 8,
    height: 48,
    backgroundColor: 'rgba(168, 85, 247, 0.4)',
    borderRadius: 4,
  },
  horizontalLine: {
    position: 'absolute',
    bottom: 192,
    right: 64,
    width: 48,
    height: 8,
    backgroundColor: 'rgba(96, 165, 250, 0.4)',
    borderRadius: 4,
  },
  floatingLine1Container: {
    position: 'absolute',
    top: '25%',
    left: 24,
  },
  floatingLine1: {
    width: 64,
    height: 2,
  },
  floatingLine2Container: {
    position: 'absolute',
    bottom: '33%',
    right: 40,
    transform: [{ rotate: '90deg' }],
  },
  floatingLine2: {
    width: 48,
    height: 2,
  },
});

export default AnimatedSplashBackground;
