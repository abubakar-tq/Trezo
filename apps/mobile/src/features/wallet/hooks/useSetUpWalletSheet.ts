import { useCallback, useRef } from "react";

import type { SetUpSheetHandle } from "@features/wallet/components/SetUpWalletSheet";

export function useSetUpWalletSheet() {
  const ref = useRef<SetUpSheetHandle>(null);

  const requireProvisioned = useCallback(
    (isProvisioned: boolean, onReady: () => void) => {
      if (isProvisioned) {
        onReady();
        return;
      }
      ref.current?.present(onReady);
    },
    [],
  );

  return { ref, requireProvisioned };
}
