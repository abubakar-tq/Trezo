---
name: mobile-design-system
description: "Use when deciding exact pixel spacing, creating NativeWind styling constraints, and adhering to visual token systems."
---

# Trezo Mobile: Design System Constraints

This skill restricts the AI agent to creating strict, standardized atomic patterns rather than raw, unorganized styles.

## 1. NativeWind Usage Guidelines

- Standardize class names (always construct layout top-down: `flex-row items-center justify-between p-4`).
- Avoid arbitrary values where design tokens should exist (use `p-4` instead of `p-[16px]`).
- All interactive components MUST have active/press opacity states applied natively via Tailwind (`active:opacity-80`).

## 2. Strict Spacing Systems (8-Point Grid)

You must adhere exclusively to the 8-point base scale for padding and margins:

- `p-1` (4px), `p-2` (8px), `p-4` (16px) - Default container padding.
- `p-6` (24px), `p-8` (32px) - Major section gaps.

## 3. The Test Showcase Constraint

- Every UI element built must first be placed and rendered within `src/features/dev/ComponentShowcase.tsx` before being utilized in actual user flows. Do not bypass the ComponentShowcase.

## 4. Color Tokens (Semantic)

- Primary: #4f46e5 (indigo) — actions, buttons
- Success: #10b981 — active guardians, protected state
- Warning: #f59e0b — pending, incomplete states
- Danger: #ef4444 — inactive guardian, failed states
- Background (dark): #04030a
- Surface (dark): #1a1625
- Surface-mid (dark): #221e30
- Card (dark): #2d2a3d

## 5. Typography Scale

- Display: 32px / Bold
- Headline: 24px / Bold
- Title: 20px / Semibold
- Body: 16px / Regular
- Caption: 14px / Regular
- Overline: 12px / Semibold

## 6. Border Radius

- sm: 4px, md: 8px, lg: 16px, xl: 24px, full: 9999px

## 7. Elevation (Shadow)

- Level 1: Cards — subtle shadow
- Level 2: Modals — medium shadow
- Level 3: Bottom sheets — strong shadow
