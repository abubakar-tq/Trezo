/**
 * Account Status Banner Component
 * 
 * Displays a prominent banner when the user's AA wallet is not deployed.
 * Shows a warning message with a call-to-action to deploy the account.
 */

import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useWalletStore } from "@/src/features/wallet/store/useWalletStore";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";
import { withAlpha } from "@utils/color";

type AccountStatusBannerProps = {
  onDeployPress?: () => void;
};

export const AccountStatusBanner: React.FC<AccountStatusBannerProps> = ({ onDeployPress }) => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);
  
  const aaAccount = useWalletStore((state) => state.aaAccount);
  const deploymentStatus = useWalletStore((state) => state.accountDeploymentStatus);
  
  // Pulsing animation for urgency
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  useEffect(() => {
    if (aaAccount && !aaAccount.isDeployed && deploymentStatus !== 'deploying') {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [aaAccount, deploymentStatus, pulseAnim]);
  
  // Don't show banner if:
  // - No AA account exists
  // - Account is already deployed
  // - Currently deploying
  if (!aaAccount || aaAccount.isDeployed || deploymentStatus === 'deploying') {
    return null;
  }
  
  const handleDeploy = () => {
    if (onDeployPress) {
      onDeployPress();
    } else {
      navigation.navigate("DeployAccount");
    }
  };
  
  return (
    <Animated.View style={[styles.banner, { transform: [{ scale: pulseAnim }] }]}>
      <View style={styles.iconContainer}>
        <Feather name="alert-triangle" size={20} color={colors.warning} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.title}>Smart Account Not Deployed</Text>
        <Text style={styles.message}>
          Deploy your Account Abstraction wallet to unlock gasless transactions, social recovery, and multi-device access.
        </Text>
      </View>
      
      <TouchableOpacity
        style={styles.button}
        onPress={handleDeploy}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Deploy Now</Text>
        <Feather name="arrow-right" size={16} color={colors.background} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    banner: {
      backgroundColor: withAlpha(colors.warning, 0.12),
      borderWidth: 1.5,
      borderColor: withAlpha(colors.warning, 0.4),
      borderRadius: 20,
      padding: 16,
      marginHorizontal: 16,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: colors.warning,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: withAlpha(colors.warning, 0.2),
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: withAlpha(colors.warning, 0.5),
    },
    content: {
      flex: 1,
      gap: 4,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 14,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    message: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    button: {
      backgroundColor: colors.warning,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      shadowColor: colors.warning,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 3,
    },
    buttonText: {
      color: colors.background,
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  });
