---
name: mobile-uiux-psychology
description: "Use when drafting layouts, deciding on animations, placing buttons, or organizing visual hierarchy on a screen. Enforces cognitive load reduction, trust markers, and scanning patterns."
---

# Trezo Mobile: UI/UX Psychology & Layout Constraints

Crypto wallets fail because they demand too much cognitive load. Trezo succeeds because we manage the **Fogg Behavior Model**: Motivation is high, so we must make Ability incredibly easy by removing friction and adding extreme clarity.

## 1. The Rule of One (Visual Hierarchy)

A screen can only have **ONE** primary action.

- If the screen is "Send Money", the only filled button is "Review & Send".
- "Cancel", "Max", or "Edit" must be ghost buttons, text links, or tertiary interfaces.
- Never place two primary buttons (same visual weight) side-by-side.

## 2. Scanning Patterns (Z and F)

Users don't read; they scan in Z or F patterns.

- **Top-Left / Center-Top:** Most critical data (e.g., Wallet Balance, Recovery Score).
- **Middle:** Quick Actions (Send, Receive, Security Center).
- **Bottom right:** The primary submission action (e.g., "Confirm").

## 3. Trust Markers Architecture

Deploy trust markers exactly at moments of friction (signing transactions, adding guardians).

- **Lock Icons**: Use beside inputs that write to the blockchain.
- **Shield Icons**: Use next to security metrics.
- **Microcopy**: Reassure the user during delays (e.g., "Protected by your device" or "Verified and encrypted").

## 4. Managing Anxiety (Loading & Errors)

- **Zero Spinners for Data**: Never use a spinner while fetching an account balance or list. Use **Skeletons** to prove the app's structure is stable and merely waiting for sync.
- **Spinners for Actions**: Use spinners _inside_ buttons when a user clicks "Approve."
- **Destructive Friction**: Deleting an account or removing a guardian must use a **Hold-to-Confirm** or **Slide-to-Confirm** gesture.

## 5. The "Empty State" Rule

An empty screen must never look broken.

- **Always provide a call to action.**
- Example: Instead of "No Guardians", show "You have 0 Trusted Contacts. Add one to increase your Security Score by 15%."
