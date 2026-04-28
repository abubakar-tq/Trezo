---
name: microcopy
description: "Use when writing ANY user-facing text, error states, or instructions in the Trezo app. Enforces calm, non-technical, and highly trusted fintech tones."
---

# Trezo Mobile: Microcopy & Tone Guidelines

## 1. Core Tone

Trezo's voice is **Calm, Transparent, and Professional.** We are a highly secure financial product.

- **No Alarmism:** Never use phrases like "Fatal Error," "Failed," or "Lost."
- **Yes Safety:** Always reassure the user that funds are safe when transactions don't execute.

## 2. Error Writing Standard

Never blame the user, and never expose raw RPC revert errors.

- ❌ "Error: UserOp reverted under threshold"
- ✅ "Transaction expired. Your funds are safe—please try again."
- ❌ "JSON RPC timeout 400"
- ✅ "Network is slow to respond. Your request is safely queued."

## 3. Technical Translation Map

- Private Key → Passkey / Secure Device ID
- Revert → Didn't go through
- Hash / TxID → Transaction Receipt
- Smart Contract → Trezo System
