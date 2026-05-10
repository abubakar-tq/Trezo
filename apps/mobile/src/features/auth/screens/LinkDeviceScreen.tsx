import React from "react";
import { Text, View } from "react-native";

import { SigninIcon } from "@/assets/components";
import { AuthScaffold } from "@features/auth/components";

export function LinkDeviceScreen() {
  return (
    <AuthScaffold
      title="Link a new device"
      subtitle="Connect another device to your Trezo account."
      icon={<SigninIcon />}
    >
      <View>
        <Text>Stub — implemented in Task 2.3.</Text>
      </View>
    </AuthScaffold>
  );
}
