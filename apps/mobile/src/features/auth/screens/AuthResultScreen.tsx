import { NavigationProp, RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import React, { useMemo } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { SigninIcon } from "@/assets/components";
import { AuthStackParamList } from "@/src/types/navigation";
import { AuthGradientButton, AuthScaffold } from "@features/auth/components";
import { useAuthFlowStore } from "@store/useAuthFlowStore";

const messages = {
  "account-created": {
    title: "Welcome to Trezo",
    subtitle:
      "You're verified! Sign in with the credentials you just created to start exploring your wallet dashboard.",
    button: "Go to sign in",
  },
  "password-updated": {
    title: "Password updated",
    subtitle:
      "Your account is secure again. Use your new password the next time you sign in to Trezo.",
    button: "Return to sign in",
  },
} as const;

type AuthResultRoute = RouteProp<AuthStackParamList, "AuthResult">;
type AuthResultNavigation = NavigationProp<AuthStackParamList>;

const AuthResultScreen: React.FC = () => {
  const navigation = useNavigation<AuthResultNavigation>();
  const route = useRoute<AuthResultRoute>();
  const setLastSuccess = useAuthFlowStore((state) => state.setLastSuccess);
  const { type, email } = route.params;

  const content = useMemo(() => messages[type], [type]);

  const handleContinue = () => {
    try {
      setLastSuccess(null);
      navigation.reset({
        index: 0,
        routes: [{ name: "Login", params: { email } }],
      });
    } catch {
      navigation.navigate("Login", { email });
      Alert.alert("Navigation", "We couldn't reset the stack, redirected to sign in instead.");
    }
  };

  return (
    <AuthScaffold
      title={content.title}
      subtitle={content.subtitle}
      icon={<SigninIcon />}
      glowColor="#60a5fa"
    >
      <View style={styles.content}>
        <AuthGradientButton label={content.button} onPress={handleContinue} />
        <Text style={styles.helperText}>Email: {email}</Text>
      </View>
    </AuthScaffold>
  );
};

const styles = StyleSheet.create({
  content: {
    width: "100%",
    rowGap: 16,
  },
  helperText: {
    textAlign: "center",
    color: "#9ca3af",
    fontSize: 12,
  },
});

export default AuthResultScreen;
