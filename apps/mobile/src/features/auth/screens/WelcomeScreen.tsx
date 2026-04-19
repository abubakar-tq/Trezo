import { NavigationProp, useNavigation } from "@react-navigation/native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import { AuthGradientButton, AuthScaffold } from "@features/auth/components";

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<AuthStackParamList>>();

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

const styles = StyleSheet.create({
  actions: {
    rowGap: 16,
  },
  secondaryButton: {
    borderColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(23,20,25,0.85)",
  },
  secondaryText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default WelcomeScreen;
