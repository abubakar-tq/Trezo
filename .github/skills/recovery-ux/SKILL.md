---
name: recovery-ux
description: "Use when designing, building, or refactoring any UI/UX related to account recovery, guardians, ZK-Email, ERC-4337 smart accounts, or security thresholds. Enforces product psychology and mental models over raw technical implementation."
---

# Trezo Mobile: Recovery UX Constraints

This skill governs how Trezo translates the terrifying complexity of ZK-Email, ERC-4337 Smart Accounts, and Social Recovery into a zero-friction, highly-trusted Web2 mental model.

## 1. THE GOLDEN RULE (Strict Boundary)

**Technical terms are NEVER shown in user-facing UI.**
If a user sees a developer term, the UI has failed. They belong _only_ in developer/debug menus.

- ❌ `ERC-4337 Smart Account` → ✅ `Trezo Account`
- ❌ `ZK-Email Guardian` → ✅ `Trusted Email`
- ❌ `Social Recovery Guardian` → ✅ `Trusted Contact`
- ❌ `Guardian Threshold` → ✅ `Approval Requirement`
- ❌ `Passkey Validator` → ✅ `Device Passkey / Face ID`
- ❌ `UserOp`, `Bundler`, `Salt`, `Calldata` → ❌ _(Never Surface)_
- ❌ `Delay Window`, `Timelock` → ✅ `Security Wait Period`

## 2. Guardian Lifecycle UI States

A guardian must be visually tracked through 7 distinct psychological states.

1. **`Invited`** (Awaiting action)
   - **Visual:** Warning/Amber hue, dashed border, spinner.
   - **Context:** "Awaiting [Name]'s confirmation."
2. **`Pending`** (Confirming on-chain)
   - **Visual:** Pulsing primary color.
   - **Context:** "Securing your setup..."
3. **`Active`** (Fully protecting)
   - **Visual:** Success/Emerald green, solid shield/check icon.
   - **Context:** "Actively protecting your account."
4. **`Recovering`** (Currently signing a recovery request)
   - **Visual:** Pulsing alert/blue hue.
   - **Context:** "[Name] is helping you recover."
5. **`Inactive`** (Changed email/phone, unreachable)
   - **Visual:** Muted red/gray.
   - **Context:** "Connection lost. Please update or remove."
6. **`Removed`** (Explicitly revoked by user)
   - **Visual:** Visible in a collapsible "Removed Contacts" section with timestamp. Never in active list, never hidden completely (audit trail).
   - **Context:** "Removed on [Date]."
7. **`Expired`** (Invitation timed out)
   - **Visual:** Red accent with a refresh icon.
   - **Context:** "Invitation expired. Resend invite."

## 3. Threshold Configuration UX ("X of Y")

Understanding "I need 2 out of 3 friends" is cognitively expensive if designed poorly.

- **Never use raw numbers in a vacuum.** (❌ "Threshold: 2").
- **Visual Fractionation:** Always show Steppers or Visual Blocks.
- **Dynamic Feedback:** If a user increases threshold but lacks guardians, intercept _before_ transaction: "You need to add 1 more Trusted Contact to require 3 approvals."

## 4. The "Recovery Score" Widget Logic

The Recovery Score ensures security gamification. Every combination has a deterministic additive score.

| Method                  | Points  |
| ----------------------- | ------- |
| Passkey active          | 20      |
| Email recovery verified | 25      |
| Phone recovery verified | 20      |
| 1 Active Guardian       | 15      |
| 2+ Active Guardians     | 25      |
| Threshold configured    | 10      |
| **Max**                 | **100** |

**Score Color/Visual Guidance:**

- **0–40%** → Neutral gray ("Not set up yet")
- **41–74%** → Amber ("Getting there")
- **75–99%** → Teal/Blue ("Almost protected")
- **100%** → Emerald green ("Fully protected")

## 5. Designing "Recovery Overrides" (Delays/Expiries)

- Show an explicit, ticking countdown timer: "Recovery unlocking in 11 hours, 45 minutes."
- Show clear instructions: "Your Trusted Contacts have approved. Waiting on standard security delay."
- Show a prominent **"Cancel Recovery"** button for the original owner to halt malicious takeovers.
