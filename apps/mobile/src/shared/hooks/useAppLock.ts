import { useEffect } from "react";
import { AppState, AppStateStatus } from "react-native";

import { useAppLockStore } from "@store/useAppLockStore";
import { useAuthFlowStore } from "@store/useAuthFlowStore";
import { useUserStore } from "@store/useUserStore";

const APP_LOCK_TIMEOUT_MS = 2 * 60 * 1000;

export const useAppLock = () => {
  const initialize = useAppLockStore((state) => state.initialize);
  const lock = useAppLockStore((state) => state.lock);
  const lockEnabled = useAppLockStore((state) => state.lockEnabled);
  const lastUnlockedAt = useAppLockStore((state) => state.lastUnlockedAt);
  const unlock = useAppLockStore((state) => state.unlock);
  const setAuthContext = useAppLockStore((state) => state.setAuthContext);
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);
  const guardNavigation = useAuthFlowStore((state) => state.guardNavigation);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    // If guardNavigation is true (Device Verification screen active), unlock and disable app lock
    if (guardNavigation) {
      unlock();
      setAuthContext(false);
      return;
    }

    // Otherwise, set auth context based on login state
    setAuthContext(isLoggedIn);
    if (!isLoggedIn) {
      unlock();
    }
  }, [isLoggedIn, guardNavigation, setAuthContext, unlock]);

  useEffect(() => {
    let backgroundedAt: number | null = null;

    const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (status === "background" || status === "inactive") {
        backgroundedAt = Date.now();
      }

      if (status === "active") {
        // If guard navigation is active, don't lock
        if (!lockEnabled || !isLoggedIn || guardNavigation) {
          backgroundedAt = null;
          return;
        }

        const now = Date.now();
        const elapsedSinceBackground = backgroundedAt ? now - backgroundedAt : null;
        backgroundedAt = null;

        const elapsedSinceUnlock = lastUnlockedAt ? now - lastUnlockedAt : Number.POSITIVE_INFINITY;

        const shouldLock =
          !lastUnlockedAt ||
          (elapsedSinceBackground !== null && elapsedSinceBackground >= APP_LOCK_TIMEOUT_MS) ||
          elapsedSinceUnlock >= APP_LOCK_TIMEOUT_MS;

        if (shouldLock) {
          lock();
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isLoggedIn, guardNavigation, lastUnlockedAt, lock, lockEnabled]);
};
