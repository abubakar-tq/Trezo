# Trezo Design System

**Version:** 1.0 — Quiet Spectrum + Atelier Accents  
**Status:** Active rulebook. Every screen, component, and animation defers to this file.

---

## Brand Statement

> "A trust instrument for people who refuse to choose between sovereignty and safety — designed with the gravity of a private banking relationship and the clarity of a contemporary tool."

Trezo is not a vault. It is a **trust**. A vault keeps others out. A trust keeps your assets safe even if you lose the key. This distinction must be felt in every pixel: restrained, weighty, considered — never aggressive, never flashy, never cheap.

---

## Design Principles

1. **Restraint is the luxury signal.** More negative space always beats more elements.
2. **The app notices what matters.** Two moments of color — money in, money out. Everything else is quiet.
3. **Classical bones, modern surface.** Symmetry, ratio-derived spacing, weight contrast in type. Motion and live data as the modern layer.
4. **Gold is ceremonial, not decorative.** Pale gold appears only when the app is doing something legally weighted: setting up recovery, managing guardians, signing zkEmail.
5. **Never pure white. Never raw neon.** Ivory for text, refined violet for accent, terracotta for errors.

---

## Color System

### Primary Palette — Noir Mode (Dark)

| Token | Hex / RGBA | Usage |
|-------|-----------|-------|
| `background` | `#060608` | Base screen background — ink black with barely-perceptible violet undertone |
| `surface` | `rgba(14,12,18,0.92)` | Bottom sheets, sidebars |
| `surfaceCard` | `rgba(18,15,24,0.70)` | Cards, list rows |
| `surfaceElevated` | `rgba(24,20,32,0.95)` | Modals, overlays |
| `surfaceMuted` | `rgba(14,12,18,0.40)` | Disabled / secondary backgrounds |
| `border` | `rgba(124,58,237,0.10)` | Ghost violet — primary dividers and card outlines |
| `borderMuted` | `rgba(124,58,237,0.05)` | Hairlines, subtle separators |
| `glass` | `rgba(244,241,234,0.02)` | Glassmorphism fill — ivory-tint, barely visible |
| `glassBorder` | `rgba(124,58,237,0.08)` | Glass container borders |

### Text Hierarchy — Warm Ivory

| Token | Hex | Usage |
|-------|-----|-------|
| `textPrimary` | `#F4F1EA` | All primary content — warm ivory, never pure white |
| `textSecondary` | `#8E8B85` | Labels, metadata |
| `textMuted` | `#5C5A55` | Timestamps, tertiary data |
| `textOnAccent` | `#F4F1EA` | Text on violet/cyan buttons |

> **Rule:** Never use `#FFFFFF`. Pure white on OLED dark is aggressive. `#F4F1EA` (warm ivory) reads as paper — it has memory and weight.

### Accent System

| Token | Hex | Usage |
|-------|-----|-------|
| `accent` | `#7C3AED` | Violet-700 — primary brand accent, CTAs, selected states, focus rings |
| `accentAlt` | `#06B6D4` | Cyan-500 — contextual action accent (outbound transactions, interactive links) |
| `accentSoft` | `rgba(124,58,237,0.12)` | Soft background for accent-adjacent surfaces |

> **Rule:** `accent` (violet) is the default. `accentAlt` (cyan) appears only on outbound/action flows. Never use them simultaneously on the same screen.

### Semantic States

| Token | Hex | Psychology |
|-------|-----|-----------|
| `success` | `#10B981` | Emerald — from locked ShieldScene. Positive, arrived, complete. |
| `successSoft` | `rgba(16,185,129,0.12)` | |
| `warning` | `#F59E0B` | Amber — unchanged |
| `danger` | `#E8654F` | **Terracotta** — not crimson. Mature warning, not panic signal. Clay, brick, Pompeian. |
| `dangerSoft` | `rgba(232,101,79,0.12)` | |

> **Rule on danger:** Never use pure red (`#EF4444`, `#DC2626`). Red is an alarm. Terracotta is a notice. A wallet that screams "ERROR" in crimson is one that trains users to feel anxiety. A wallet that uses terracotta trains users to feel informed.

### Ceremonial Layer — Recovery / Guardian / zkEmail Only

These colors are **not in the regular theme**. They appear exclusively when the app is performing legally weighted actions: recovery setup, guardian management, zkEmail enrollment, threshold configuration. Treat these screens like signing a document.

| Name | Value | Usage |
|------|-------|-------|
| `gold` | `#C9A961` | Pale gold — primary ceremonial accent |
| `goldMuted` | `#8B7A4E` | Inactive borders, resting states in recovery flows |
| `goldSoft` | `rgba(201,169,97,0.10)` | Background tint on recovery cards |
| `goldHairline` | `rgba(201,169,97,0.08)` | Border on recovery screen containers |
| `goldGlass` | `rgba(201,169,97,0.04)` | Glass fill on guardian management modals |

> **Why pale gold, not warm brass:** `#C9A961` is cool-yellow gold — Florentine manuscripts, gilt book edges, Klimt. `#B5894D` is warm-orange brass — Vegas hotel lobbies. The temperature shift is the difference between "genuinely is wealthy" and "trying to look wealthy." Every implementation of gold must use `#C9A961` exactly.

### Contextual Color Events

Two moments in the app where color shifts. Only these two. No others.

**1. Value Arrival** — Money/assets enter the wallet
- Color: `#10B981` (emerald)
- Glow: `rgba(16,185,129,0.15)` ambient, balance card only
- Duration: 1200ms, `easeInOut`, then returns to violet-noir resting state
- Scope: Balance card background glow ONLY. Nothing else changes.

**2. Value Departure** — User is authorizing an outbound transaction
- Color: `#06B6D4` (cyan)
- Glow: `rgba(6,182,212,0.20)` halo on confirm button and its immediate container
- Duration: Persists while transaction confirmation screen is active
- Scope: Confirm button + immediate container halo ONLY. Everything else stays violet-noir.

> **Rule:** These are the app's two heartbeats. The emerald breath when something arrives. The cyan focus when something leaves. No other contextual color shifts exist. If a third one is proposed, reject it.

---

## Typography System — Tri-Font Architecture

Three fonts. Three roles. Never mixed.

### Font Stack

| Role | Font | Free? | Usage |
|------|------|-------|-------|
| **Numbers / Addresses** | JetBrains Mono | ✅ Open source | All balances, token amounts, wallet addresses, tx hashes |
| **Key Headings (Nouns)** | Playfair Display | ✅ Google Fonts | Recovery section titles, Guardian headings, Settings page titles, Modal headers for important actions |
| **Body / UI** | Inter | ✅ Google Fonts | Everything else — buttons, descriptions, labels, nav items |

> **The pattern:** Serifs for nouns of importance. Sans for verbs of action. Mono for numbers. A user reads "Recovery" in Playfair and unconsciously processes: this is a document. They press "Confirm" in Inter and it feels like a clear action. They see "0.4821 ETH" in JetBrains Mono and it reads like a ledger entry.

### Type Scale

| Token | Size | Weight | Font | Line Height | Letter Spacing | Usage |
|-------|------|--------|------|------------|----------------|-------|
| `display` | 32px | 300 (Light) | Inter | 40px | -0.5 | Hero balances display, splash amounts |
| `headline` | 24px | 600 | Inter | 32px | -0.3 | Screen titles (sans context) |
| `headline-serif` | 24px | 700 | Playfair Display | 32px | 0 | Recovery/Guardian screen titles |
| `title` | 20px | 500 | Inter | 28px | -0.2 | Card headers, modal titles |
| `body` | 16px | 400 | Inter | 24px | 0 | Body text, descriptions |
| `caption` | 14px | 400 | Inter | 20px | 0 | Labels, secondary info |
| `overline` | 11px | 500 | Inter | 16px | +6 | Kickers, ALL-CAPS section labels (e.g. "TREZO SAFE") |
| `mono-lg` | 20px | 500 | JetBrains Mono | 28px | -0.5 | Balance primary display |
| `mono-md` | 16px | 400 | JetBrains Mono | 24px | 0 | Token amounts, prices |
| `mono-sm` | 13px | 400 | JetBrains Mono | 18px | 0 | Addresses, tx hashes |
| `brand` | 16px | 900 | Inter | 20px | +4 | "TREZO" brand mark only |

> **Luxury Contrast Rule:** Large text should be weight 300 (Light). The headline is light and spacious. Brand marks, numbers, and CTAs are heavy (600–900). This tension between thin large and heavy small is the typographic fingerprint of premium brands (Apple, Rolex, Porsche). Never use bold for large display text.

---

## Spacing System — Golden Ratio Sequence

Two parallel systems. Use the Fibonacci sequence (`phi`) for layout composition. Use the 8-point grid (`sp`) for component-level spacing.

### Fibonacci / Golden Ratio (layout)

| Token | Value | Use |
|-------|-------|-----|
| `phi1` | 4px | Icon-to-label gap |
| `phi2` | 8px | Tight component padding |
| `phi3` | 12px | List item internal padding |
| `phi4` | 20px | Default card padding |
| `phi5` | 32px | Section gap |
| `phi6` | 52px | Large section break |
| `phi7` | 84px | Hero vertical rhythm |

### 8-Point Grid (components)

| Token | Value |
|-------|-------|
| `sp1` | 4px |
| `sp2` | 8px |
| `sp3` | 12px |
| `sp4` | 16px |
| `sp5` | 20px |
| `sp6` | 24px |
| `sp8` | 32px |
| `sp10` | 40px |
| `sp12` | 48px |

### Touch Targets

| Name | Value | Rule |
|------|-------|------|
| `touchMin` | 44px | iOS minimum (HIG). Never below this for tappable elements |
| `touchComfort` | 52px | Preferred for primary actions (CTAs, confirm buttons) |

---

## Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 4px | Badges, tags, small chips |
| `md` | 8px | Inputs, secondary buttons |
| `lg` | 16px | Cards, list containers |
| `xl` | 24px | Modals, bottom sheets |
| `full` | 9999px | Pills, avatar circles, toggle switches |

> **Rule:** Default to `lg` (16px) for cards. Never mix `sm` and `xl` on the same card — pick a radius register and stay in it.

---

## Motion & Animation

### Easing Curves

| Name | Bezier | Feel | Use |
|------|--------|------|-----|
| `outExpo` | `[0.16, 1, 0.3, 1]` | Fast start, soft landing — classical clock hand | Screen entrances, cards appearing |
| `inOutQuart` | `[0.77, 0, 0.175, 1]` | Deliberate, symmetrical | Modal open/close, tab transitions |
| `outCubic` | `[0.33, 1, 0.68, 1]` | Smooth, natural | List item animations |

### Spring Config (react-native-reanimated withSpring)

| Name | Damping | Stiffness | Use |
|------|---------|-----------|-----|
| `interaction` | 25 | 200 | Button press feedback, interactive elements |
| `entrance` | 30 | 180 | Modals entering, sheets sliding up |

> **Rule:** Never `Easing.linear` for UI interactions. Never bouncy spring (damping < 15). `outExpo` for entrances. Spring with `interaction` config for touch feedback. `inOutQuart` for modal/overlay transitions.

### Duration Scale

| Token | Value | Use |
|-------|-------|-----|
| `micro` | 150ms | Tap feedback, opacity toggles |
| `fast` | 200ms | Tab switch, chip selection |
| `normal` | 300ms | Screen transition, confirm button |
| `slow` | 500ms | Modal entrance, security screens |
| `ambient` | 600ms+ | Contextual color events, glow pulses |

> **Luxury motion rule:** Slow is rich. Fast is cheap. If an animation feels instant, add 50ms. If it feels sluggish, check whether it's using `outExpo` — flat linear motion always reads as slow even at equal duration.

---

## Elevation & Glass

### Glass Surfaces

All cards and elevated surfaces use glassmorphism with **ivory-tint glass**, not white-tint.

```
glass fill:   rgba(244, 241, 234, 0.02)   — barely-there ivory tint
glass border: rgba(124, 58, 237, 0.08)    — ghost violet edge
```

For **ceremonial screens** (recovery/guardian):
```
glass fill:   rgba(201, 169, 97, 0.04)    — gold-tint glass
glass border: rgba(201, 169, 97, 0.08)    — gold hairline
```

### Shadow Levels

| Level | Shadow | Use |
|-------|--------|-----|
| `level1` | `0 2px 8px rgba(0,0,0,0.3)` | Cards |
| `level2` | `0 4px 16px rgba(0,0,0,0.4)` | Modals, bottom sheets |
| `level3` | `0 8px 32px rgba(0,0,0,0.5)` | Full-screen overlays |

For accent glow (active state on CTA buttons):
```
violet glow:  0 0 20px rgba(124, 58, 237, 0.35)
cyan glow:    0 0 20px rgba(6, 182, 212, 0.30)
emerald glow: 0 0 16px rgba(16, 185, 129, 0.25)
```

---

## Iconography

- **Stroke weight:** 1.5px — never filled, never 1px (too delicate on mobile), never 2px (too heavy)
- **Color:** `textSecondary` (#8E8B85) for all inactive icons. `accent` (#7C3AED) for active/selected state.
- **Gold icons:** Ceremonial screens only — shield icon on recovery, guardian avatar icons
- **Size:** 24px standard, 20px compact list rows, 28px hero/primary actions
- **Never:** Colored icon libraries (e.g. emoji-style multicolor). All icons must be single-color line art.

---

## Component Rules

### Button

| Variant | Background | Border | Text | Use |
|---------|-----------|--------|------|-----|
| Primary | `accent` (#7C3AED) | none | `textOnAccent` (#F4F1EA) | One per screen max |
| Secondary | `glass` | `border` (violet ghost) | `textPrimary` | Supporting actions |
| Danger | `dangerSoft` | `danger` (terracotta) | `danger` | Destructive — delete, revoke |
| Ghost | transparent | `border` | `textSecondary` | Tertiary actions |
| Ceremonial | `goldSoft` | `goldHairline` | `gold` | Recovery/guardian confirmation only |

- **Height:** 52px (`touchComfort`) for primary. 44px (`touchMin`) for secondary/ghost.
- **Corner radius:** `xl` (24px) for primary. `lg` (16px) for secondary.
- **Active state:** Scale to `0.97`, opacity to `0.9`. Spring `interaction` config.
- **Glow on primary:** `0 0 20px rgba(124,58,237,0.35)` — always present, not just on press.

### Card

- Background: `surfaceCard` — `rgba(18,15,24,0.70)`
- Border: `border` — `rgba(124,58,237,0.10)`
- Radius: `lg` (16px)
- Padding: `phi4` (20px)
- Shadow: `level1`
- Press feedback: Scale to `0.98`, opacity to `0.95`. Spring `entrance` config.

### Input

- Background: `inputBackground` — `rgba(14,12,18,0.80)`
- Border: `inputBorder` — `rgba(124,58,237,0.15)`
- Focus border: `accent` — `#7C3AED` at full opacity, `0 0 0 2px rgba(124,58,237,0.20)` outer glow
- Radius: `md` (8px)
- Height: 52px
- Text: `textPrimary` (#F4F1EA)
- Placeholder: `textMuted` (#5C5A55)

### Modal / Bottom Sheet

- Background: `surfaceElevated` — `rgba(24,20,32,0.95)`
- Top border: `glassBorder` — `rgba(124,58,237,0.08)`
- Radius (top corners): `xl` (24px)
- Entrance: `withSpring`, `entrance` config, slide from bottom
- Backdrop: `rgba(0,0,0,0.7)` with blur if platform supports

---

## Recovery Flow Treatment

Recovery, guardian management, zkEmail, and threshold configuration screens are **ceremonial**. They must feel slower, more deliberate, more typographically rich than the rest of the app.

Rules exclusive to recovery flows:

1. **Screen title:** Playfair Display 24px — the serif signals "this is a document"
2. **Background tint:** Add `rgba(201,169,97,0.03)` over the base `#060608` — imperceptible but warm
3. **Card borders:** `goldHairline` instead of `border`
4. **CTA button:** Use the Ceremonial button variant (gold border, gold text)
5. **Progress indicators:** Gold fill (`#C9A961`) on active step, `goldMuted` on inactive
6. **Confirmation screens:** Add a 300ms pause before the confirm button becomes active — a "moment of weight" that distinguishes this from a routine action
7. **Success state:** Emerald ambient glow + Playfair "Complete" heading

These are the screens that sell the product. A recovery flow that feels like signing a legal document is the screenshot that makes someone recommend Trezo to another person.

---

## Modes

### Noir (Default)
Base: `#060608` — cold ink. Violet borders. Ivory text.
Suited to: focused sessions, portfolio management, trading.

### Dusk (Future — Phase 7)
Base: `#141210` — warm charcoal. Same accent system. Same ivory text.
Suited to: long sessions, outdoor use, users who find Noir too intense.
Framed as **"Noir / Dusk"** in settings — not "Dark / Light". Both are dark. One is cold, one is warm.
Implementation: duplicate darkTheme with warm-shifted backgrounds. Accent colors unchanged.

---

## Locked Assets — Do Not Touch

These files are frozen. They define the visual DNA that the rest of the app extends, not replaces.

| File | What It Defines |
|------|----------------|
| `AnimatedSplashBackground.tsx` | Deep purple base (`#0a0a0f → #2d1b4e`), violet/purple orbs, geometric accents |
| `PasskeyOrbScene.tsx` | Violet family: `#8B5CF6`, `#A78BFA`, `#C4B5FD` — TREZO SAFE |
| `MultiChainScene.tsx` | Cyan family: `#06B6D4`, `#22D3EE`, `#67E8F9` — TREZO CORE |
| `ShieldScene.tsx` | Emerald family: `#10B981`, `#34D399`, `#6EE7B7` — TREZO MESH |
| `OnboardingScreen.tsx` | Layout, typography, brand voice for all onboarding |

---

## Things Never To Do

| Rule | Because |
|------|---------|
| Never use `#FFFFFF` as text color | Too harsh on OLED dark. Use `#F4F1EA` |
| Never use `#EF4444` or `#DC2626` as error color | That's an alarm, not an error. Use `#E8654F` terracotta |
| Never use `#00FFFF` or `#FF00FF` as accent | Those are raw neon. Use `#7C3AED` (violet) and `#06B6D4` (cyan) |
| Never put gold on anything outside recovery flows | Gold is ceremonial. Using it casually destroys the signal |
| Never use bold (700+) for large display text | Light weight at large sizes IS the luxury signal |
| Never use 3+ accent colors on one screen | Pick violet OR cyan. Never both |
| Never hardcode colors — always pull from theme or CeremonialColors | Dark mode and future theme variants break with hardcoded values |
| Never use linear easing for UI transitions | Linear reads as robotic. Use `outExpo` or spring |
| Never make a touch target smaller than 44px | iOS HIG minimum. Non-negotiable |
| Never add a third contextual color event | Emerald (arrival) and Cyan (departure) are the only two. A third creates noise |
| Never use filled icons | 1.5px stroke line icons only. Filled icons read as clipart |
| Never change the locked Skia scenes | They define the visual promise. The app keeps it |
