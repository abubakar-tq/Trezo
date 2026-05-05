/**
 * Trezo Mobile: Design Token Registry
 * Layout and motion tokens. All colors live in theme/themes.ts via useAppTheme().
 */

// ============================================================================
// TYPOGRAPHY SCALE
// ============================================================================
export const Typography = {
  display: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    lineHeight: 40,
  },
  headline: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    lineHeight: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  overline: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
};

// ============================================================================
// SPACING SYSTEM (8-Point Grid)
// ============================================================================
export const Spacing = {
  sp1: 4, // p-1
  sp2: 8, // p-2
  sp3: 12, // p-3
  sp4: 16, // p-4 (default container)
  sp6: 24, // p-6
  sp8: 32, // p-8 (major section gap)
};

// ============================================================================
// BORDER RADIUS
// ============================================================================
export const BorderRadius = {
  sm: 4, // Subtle curves
  md: 8, // Default
  lg: 16, // Prominent cards
  xl: 24, // Large modals
  full: 9999, // Fully rounded
};

// ============================================================================
// ELEVATION / SHADOW SYSTEM
// ============================================================================
export const Shadows = {
  // Level 1: Cards — subtle shadow
  level1: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  // Level 2: Modals — medium shadow
  level2: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  // Level 3: Bottom sheets — strong shadow
  level3: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};

// ============================================================================
// MOTION / ANIMATION DURATIONS
// ============================================================================
export const Motion = {
  fast: 200, // Tab switch
  normal: 300, // Transaction confirm
  slow: 350, // Security Center enter
  slower: 400, // Guardian approval (spring)
};

// ============================================================================
// INTERACTIVE STATE OPACITIES
// ============================================================================
export const OpacityStates = {
  default: 1,
  hover: 0.9,
  active: 0.8, // Tailwind active:opacity-80
  disabled: 0.5,
};
