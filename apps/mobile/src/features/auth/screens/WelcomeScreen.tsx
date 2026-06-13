import { NavigationProp, useNavigation } from "@react-navigation/native";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import { AuthGradientButton, AuthScaffold } from "@features/auth/components";
import type { ThemeColors } from "@theme";
import { useAppTheme } from "@theme";

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();
  const { theme } = useAppTheme();
  const { colors } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  const navigateToLogin = () => {
    navigation.navigate("Login");
  };

  const navigateToRegister = () => {
    navigation.navigate("Register");
  };

  return (
    <AuthScaffold
      title="Welcome to Trezo Wallet"
      subtitle="Choose how you'd like to continue and unlock your decentralized finance companion."
      icon={<SigninIcon />}
    >
      <View style={styles.actions}>
        <AuthGradientButton label="Sign in" onPress={navigateToLogin} />
        <TouchableOpacity activeOpacity={0.85} onPress={navigateToRegister} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Create an account</Text>
        </TouchableOpacity>
      </View>
    </AuthScaffold>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  actions: {
    rowGap: 16,
  },
  secondaryButton: {
    borderColor: `${colors.border}33`,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: colors.surfaceCard,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
});

export default WelcomeScreen;
