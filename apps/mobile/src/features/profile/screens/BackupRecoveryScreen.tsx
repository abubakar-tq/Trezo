import { NavigationProp, useNavigation } from "@react-navigation/native";
import React from "react";

import { RootStackParamList } from "@/src/types/navigation";
import SecurityCenterScreen from "@features/recovery/screens/SecurityCenterScreen";

const BackupRecoveryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  return (
    <SecurityCenterScreen
      onManageGuardians={() => navigation.navigate("GuardianRecovery")}
      onConfigureThreshold={() => navigation.navigate("GuardianRecovery")}
      onAddContact={() => navigation.navigate("AddContact")}
      onEmailRecovery={() => navigation.navigate("EmailRecovery")}
    />
  );
};

export default BackupRecoveryScreen;
