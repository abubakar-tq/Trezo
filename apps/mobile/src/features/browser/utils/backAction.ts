// Pure decision logic for the Browser tab's Android system/gesture back press.
//
// Without this, the bottom-tab navigator's default backBehavior ("firstRoute")
// sends every back press straight to the Home tab. We instead unwind the
// in-browser hierarchy first; "passthrough" is the one case where we let the
// navigator do its default (leave the Browser tab).
//
// Kept pure (no react-native imports) so it is unit-testable under the repo's
// tsx test runner. The screen maps each action onto its native side effect.

export type BrowserBackState = {
  /** The full-screen tab switcher modal is open. */
  tabSwitcherOpen: boolean;
  /** The top-bar URL field is in edit mode. */
  editing: boolean;
  /** The Discover home (trending/sites) is showing instead of a WebView. */
  showHome: boolean;
  /** The active WebView has back history (from its nav state). */
  canGoBack: boolean;
};

export type BrowserBackAction =
  | "close-tab-switcher"
  | "stop-editing"
  | "web-go-back"
  | "show-home"
  | "passthrough";

/**
 * Decide what a system/gesture back press should do inside the Browser tab,
 * as an ordered priority ladder. "passthrough" means we did not handle it —
 * the caller should let the navigator perform its default (switch to Home).
 */
export function decideBrowserBackAction(state: BrowserBackState): BrowserBackAction {
  if (state.tabSwitcherOpen) return "close-tab-switcher";
  if (state.editing) return "stop-editing";
  if (!state.showHome) {
    return state.canGoBack ? "web-go-back" : "show-home";
  }
  return "passthrough";
}
