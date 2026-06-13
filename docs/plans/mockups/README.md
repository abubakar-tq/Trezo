# Redesign mockups (visual source of truth)

Static HTML mockups built with the real design tokens + fonts. Open in any browser. These are the **locked visual reference** — match these, do not redrift. They use placeholder glyphs for icons; the real build uses Feather line icons per the design system.

**Restraint principle (applies everywhere, esp. Profile):** color = signal, not decoration. Healthy state is calm/near-monochrome (muted text, faint violet-tinted icon chips, soft-glow active dots). Loud color (amber) appears ONLY when something needs action. No color spray.

## Stream B — core screens
- `core-home.html` — Home, empty ($0) vs funded states.
- `core-portfolio.html` — Portfolio: no-lock tiered chart (dimmed disabled periods + warm tap message), allocation bar, holdings, Popular-on-testnet shelf (ETH→Buy, USDC/LINK→Swap).
- `core-portfolio-chart-tiers.html` — the tiered chart explainer ($0 / day-1 / matured) — no seeding, fills in over time.
- `core-discover.html` — Discover single-scroll: Search → Trending → Market (reclaimed MarketExplorer) → Apps → News. Browser chrome untouched.
- `core-token-detail.html` — Token Detail bottom-sheet (full 1D/1W/1M/1Y price chart) + testnet-gated actions; Apps + News segments.

## Stream A — profile cleanup
- `profile-ia-map.html` — before/after navigation map (~31 → ~15 screens; the 8 cuts).
- `profile-root-hub-devices.html` — **the locked "warmer v3" visual level**: Profile root (Security/Wallet/Preferences), Recovery & Backup hub (healthy + needs-action), Devices trim.
- `profile-email-recovery-split.html` — EmailRecovery monolith split into Setup wizard vs Manage.
- `profile-remaining.html` — Email Recovery Manage (remove-guardian + weights-behind-Advanced), Guardians cleaned (dev UI gated), Compromised slimmed, Browser Settings tone fix.
