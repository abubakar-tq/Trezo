import { decideBrowserBackAction, type BrowserBackState } from "../backAction";

// ── tiny assert helpers ─────────────────────────────────────────────────────
let passed = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    console.error(`FAIL: ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    process.exit(1);
  }
  passed++;
}

function state(overrides: Partial<BrowserBackState> = {}): BrowserBackState {
  return {
    tabSwitcherOpen: false,
    editing: false,
    showHome: false,
    canGoBack: false,
    ...overrides,
  };
}

// ── tests ────────────────────────────────────────────────────────────────────
console.log("running backAction.test.ts");

// The bug this guards: from a site opened off the Discover home, system back must
// unwind the in-browser hierarchy (web history -> Discover home) BEFORE leaving
// the Browser tab. "passthrough" means we did not handle it (navigator -> Home tab).

// 1. On a site with web history -> go back in the WebView.
assertEqual(
  decideBrowserBackAction(state({ showHome: false, canGoBack: true })),
  "web-go-back",
  "site with history -> web-go-back",
);

// 2. On a site at its first page (no web history) -> return to Discover home.
assertEqual(
  decideBrowserBackAction(state({ showHome: false, canGoBack: false })),
  "show-home",
  "site entry page -> show-home (the reported bug)",
);

// 3. Already on Discover home -> pass through so the navigator leaves the tab.
assertEqual(
  decideBrowserBackAction(state({ showHome: true })),
  "passthrough",
  "discover home -> passthrough",
);

// 4. URL edit field open -> exit editing first (beats web/home unwind).
assertEqual(
  decideBrowserBackAction(state({ editing: true, showHome: false, canGoBack: true })),
  "stop-editing",
  "editing beats web-go-back",
);

// 5. Tab switcher open -> close it first (highest priority).
assertEqual(
  decideBrowserBackAction(state({ tabSwitcherOpen: true, editing: true, canGoBack: true })),
  "close-tab-switcher",
  "tab switcher has top priority",
);

// 6. Precedence: tab switcher > passthrough even on discover home.
assertEqual(
  decideBrowserBackAction(state({ tabSwitcherOpen: true, showHome: true })),
  "close-tab-switcher",
  "tab switcher beats passthrough on home",
);

console.log(`OK backAction.test.ts (${passed} assertions)`);
