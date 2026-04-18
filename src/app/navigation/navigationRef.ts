import { createNavigationContainerRef } from "@react-navigation/native";

import { AuthStackParamList, RootStackParamList } from "@/src/types/navigation";

export type AppNavigationParamList = RootStackParamList & AuthStackParamList;

export const navigationRef = createNavigationContainerRef<AppNavigationParamList>();

export const navigate = <T extends keyof AppNavigationParamList>(
  screen: T,
  params?: AppNavigationParamList[T],
) => {
  if (navigationRef.current && navigationRef.isReady()) {
    (navigationRef as unknown as { navigate: (s: T, p?: AppNavigationParamList[T]) => void }).navigate(
      screen,
      params,
    );
  }
};
