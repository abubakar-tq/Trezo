import { useEffect } from "react";
import { Linking } from "react-native";

import { navigate } from "@app/navigation/navigationRef";
import { useUserStore } from "@store/useUserStore";

import DevicePairingService from "../services/DevicePairingService";

/**
 * Routes inbound `trezowallet://pair-device?requestId=...&secret=...` deep links
 * into the pairing flow.
 *
 * The pairing-link CONSUMER side (LoginScreen resume banner, PairDevice
 * bootstrap) depends on a stashed pending link, but nothing was wiring the OS
 * deep link into it — only the in-app QR scanner stashed links, so tapping a
 * pairing link did nothing. This mirrors LinkDeviceScreen.handlePairingUrl for
 * both cold-start (`getInitialURL`) and warm (`url` event) cases.
 *
 * Kept separate from the OAuth redirect handler in useSupabaseAuth:
 * parsePairingDeepLink returns null for any non pair-device URL and
 * handleAuthRedirect ignores non-auth URLs, so the two listeners coexist safely.
 */
export function useDevicePairingDeepLink(): void {
  const isLoggedIn = useUserStore((state) => state.isLoggedIn);

  useEffect(() => {
    let cancelled = false;

    const handleUrl = async (rawUrl: string | null | undefined) => {
      if (!rawUrl) return;
      const params = DevicePairingService.parsePairingDeepLink(rawUrl);
      if (!params || cancelled) return;
      await DevicePairingService.stashPendingDeepLink(params);
      if (cancelled) return;
      // Authenticated: jump straight to the pairing screen (it consumes the
      // stashed link). Signed out: route to login-resume, which picks the link
      // back up after sign-in.
      if (isLoggedIn) {
        navigate("PairDevice");
      } else {
        navigate("Login", { pairingMode: "resume" });
      }
    };

    Linking.getInitialURL()
      .then((url) => {
        void handleUrl(url);
      })
      .catch(() => {});

    const subscription = Linking.addEventListener("url", (event) => {
      void handleUrl(event.url);
    });

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [isLoggedIn]);
}
