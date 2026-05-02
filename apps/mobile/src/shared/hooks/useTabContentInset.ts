import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const TAB_BAR_BASE_HEIGHT = 64;
const CONTENT_FOOTER_SPACING = 16;

export function useTabContentBottomInset(extra: number = 0) {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => insets.bottom + TAB_BAR_BASE_HEIGHT + CONTENT_FOOTER_SPACING + extra,
    [extra, insets.bottom],
  );
}
