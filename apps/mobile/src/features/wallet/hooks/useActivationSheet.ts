import { useCallback, useRef } from "react";

import type { ActivationSheetHandle } from "@features/wallet/components/ActivationSheet";

export function useActivationSheet() {
  const ref = useRef<ActivationSheetHandle>(null);

  const requireActiveOnChain = useCallback(
    (chainId: number, isActive: boolean, onReady: () => void) => {
      if (isActive) {
        onReady();
        return;
      }
      ref.current?.present(chainId, onReady);
    },
    [],
  );

  return { ref, requireActiveOnChain };
}
