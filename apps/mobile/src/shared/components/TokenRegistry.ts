/**
 * Trezo Mobile — Design Token Registry
 * Layout, motion, typography, and ceremonial tokens.
 * All theme-mode colors live in theme/themes.ts via useAppTheme().
 * See design.md for the full design rulebook.
 */

// ============================================================================
// FONT FAMILIES — Tri-Font Architecture
// Serifs for nouns of importance. Sans for verbs of action. Mono for numbers.
// ============================================================================
export const FontFamilies = {
  // Body / UI — buttons, descriptions, labels, nav items
  sans: "Inter",
  sansBold: "Inter-Bold",
  sansBlack: "Inter-ExtraBold",

  // Key headings (nouns) — recovery titles, guardian screens, settings sections
  // Use sparingly: only where the screen demands weight and ceremony
  serif: "PlayfairDisplay-Regular",
  serifBold: "PlayfairDisplay-Bold",

  // Numbers / addresses — balances, token amounts, tx hashes, wallet addresses
  // JetBrains Mono: designed for code, aligns numbers vertically like a ledger
  mono: "JetBrainsMono-Regular",
  monoMedium: "JetBrainsMono-Medium",
};

// ============================================================================
// TYPOGRAPHY SCALE
// Rule: Large text = light weight (300). Heavy weight (800+) = small brand marks.
// The tension between thin-large and heavy-small is the luxury typographic signal.
// ============================================================================
export const Typography = {
  // Hero balance display — Inter Light, largest, thinnest
  display: {
    fontSize: 32,
    fontWeight: '300' as const,
    lineHeight: 40,
    letterSpacing: -0.5,
    fontFamily: FontFamilies.sans,
  },
  // Screen headlines without ceremony
  headline: {
    fontSize: 24,
    fontWeight: '600' as const,
    lineHeight: 32,
    letterSpacing: -0.3,
    fontFamily: FontFamilies.sans,
  },
  // Ceremonial headlines — recovery, guardian, zkEmail screens only
  headlineSerif: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 32,
    letterSpacing: 0,
    fontFamily: FontFamilies.serifBold,
  },
  // Card headers, modal titles
  title: {
    fontSize: 20,
    fontWeight: '500' as const,
    lineHeight: 28,
    letterSpacing: -0.2,
    fontFamily: FontFamilies.sans,
  },
  // Body text, descriptions
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0,
    fontFamily: FontFamilies.sans,
  },
  // Labels, secondary info
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    letterSpacing: 0,
    fontFamily: FontFamilies.sans,
  },
  // Kickers, ALL-CAPS section labels — widest tracking
  overline: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
    letterSpacing: 6,
    fontFamily: FontFamilies.sans,
  },
  // Brand mark "TREZO" — maximum weight, tracked
  brand: {
    fontSize: 16,
    fontWeight: '900' as const,
    lineHeight: 20,
    letterSpacing: 4,
    fontFamily: FontFamilies.sansBlack,
  },

  // Mono: balance primary — large, medium weight, ledger-feel
  monoLg: {
    fontSize: 20,
    fontWeight: '500' as const,
    lineHeight: 28,
    letterSpacing: -0.5,
    fontFamily: FontFamilies.monoMedium,
  },
  // Mono: token amounts, prices
  monoMd: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    letterSpacing: 0,
    fontFamily: FontFamilies.mono,
  },
  // Mono: addresses, tx hashes — smallest, most compact
  monoSm: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    letterSpacing: 0,
    fontFamily: FontFamilies.mono,
  },
};

// ============================================================================
// SPACING — Two parallel systems
// Use phi (Fibonacci/golden ratio) for layout composition.
// Use sp (8-point grid) for component-level spacing.
// ============================================================================

// Fibonacci / Golden Ratio — for screen layout, section gaps, vertical rhythm
// Sequence: each value ≈ sum of two preceding (4→8→12→20→32→52→84)
export const Phi = {
  phi1: 4,
  phi2: 8,
  phi3: 12,
  phi4: 20,
  phi5: 32,
  phi6: 52,
  phi7: 84,
};

// 8-Point Grid — for component padding, gap, margin
export const Spacing = {
  sp1: 4,
  sp2: 8,
  sp3: 12,
  sp4: 16,
  sp5: 20,
  sp6: 24,
  sp8: 32,
  sp10: 40,
  sp12: 48,
};

// Touch Targets — iOS HIG and Material minimums
export const TouchTargets = {
  min: 44,       // iOS minimum — never below for tappable elements
  comfort: 52,   // preferred for primary CTAs and confirm buttons
};

// ============================================================================
// BORDER RADIUS
// ============================================================================
export const BorderRadius = {
  sm: 4,     // Badges, chips
  md: 8,     // Inputs, secondary buttons
  lg: 16,    // Cards, list containers
  xl: 24,    // Modals, bottom sheets, primary buttons
  full: 9999, // Pills, avatars, toggles
};

// ============================================================================
// ELEVATION / SHADOW SYSTEM
// ============================================================================
export const Shadows = {
  level1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 8,
    elevation: 2,
  },
  level2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.40,
    shadowRadius: 16,
    elevation: 4,
  },
  level3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.50,
    shadowRadius: 32,
    elevation: 8,
  },
};

// Accent glow shadows — for active CTAs and contextual color events
export const GlowShadows = {
  violet: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  cyan: {
    shadowColor: '#06B6D4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 20,
    elevation: 10,
  },
  emerald: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  gold: {
    shadowColor: '#C9A961',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
};

// ============================================================================
// MOTION — Easing curves and spring configs
// Rule: outExpo for entrances. Spring(interaction) for touch. inOutQuart for modals.
// Never linear. Never bouncy spring (damping < 15).
// ============================================================================

// Bezier control points for use with Easing.bezier() in react-native-reanimated
export const EasingCurves = {
  // Fast start, soft landing — classical clock hand settling. Use for screen entrances.
  outExpo: [0.16, 1, 0.3, 1] as const,
  // Deliberate, symmetrical. Use for modal open/close, tab transitions.
  inOutQuart: [0.77, 0, 0.175, 1] as const,
  // Smooth, natural. Use for list item animations, card entrances.
  outCubic: [0.33, 1, 0.68, 1] as const,
};

// Spring configs for withSpring() in react-native-reanimated
export const SpringConfig = {
  // Touch feedback — modern, Vision Pro-adjacent. Use for button press, swipe interactions.
  interaction: { damping: 25, stiffness: 200, mass: 1 },
  // Screen entrance — settled, deliberate. Use for modals sliding up, sheets appearing.
  entrance: { damping: 30, stiffness: 180, mass: 1 },
};

// Duration scale — use with EasingCurves above
export const Motion = {
  micro: 150,    // Tap feedback, opacity toggles
  fast: 200,     // Tab switch, chip selection
  normal: 300,   // Screen transition, confirm button
  slow: 500,     // Modal entrance, security screens
  ambient: 600,  // Contextual color events, glow pulses
  // Skia scene loops (locked — do not use for UI)
  orb: 9000,
  constellation: 16000,
  shield: 14000,
};

// Interactive state opacities
export const OpacityStates = {
  default: 1,
  hover: 0.9,
  active: 0.97,  // very subtle for luxury feel — not 0.8
  disabled: 0.4,
};

// ============================================================================
// CEREMONIAL COLORS — Recovery / Guardian / zkEmail screens ONLY
// Pale gold. Not warm brass. The temperature difference is the luxury signal.
// #C9A961 = Florentine manuscript gold. #B5894D = Vegas hotel lobby brass.
// ============================================================================
export const CeremonialColors = {
  gold: "#C9A961",
  goldMuted: "#8B7A4E",
  goldSoft: "rgba(201, 169, 97, 0.10)",
  goldHairline: "rgba(201, 169, 97, 0.08)",
  goldGlass: "rgba(201, 169, 97, 0.04)",
};

// ============================================================================
// CONTEXTUAL COLOR EVENTS
// Only two exist in the entire app. Never add a third.
// Emerald = value arrives. Cyan = value departs.
// ============================================================================
export const ContextualEvents = {
  // Value arrival — emerald ambient glow on balance card, 1200ms then returns
  valueArrival: {
    color: "#10B981",
    glowColor: "rgba(16, 185, 129, 0.15)",
    duration: 1200,
    scope: "balance-card-only",
  },
  // Value departure — cyan halo on confirm button while tx screen is active
  valueDeparture: {
    color: "#06B6D4",
    glowColor: "rgba(6, 182, 212, 0.20)",
    duration: 0, // persists while transaction confirmation screen is open
    scope: "confirm-button-and-immediate-container",
  },
} as const;
