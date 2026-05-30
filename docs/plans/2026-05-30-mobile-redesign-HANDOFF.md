# HANDOFF PROMPT — Mobile Redesign (run in a fresh Claude terminal)

Copy the block below into a new Claude Code terminal opened at `D:\trezo`. It will set up an isolated worktree off `feat/mobile-polish-pass` and implement the locked redesign plan.

---

```
We're implementing a locked mobile dark-mode redesign for the Trezo wallet (apps/mobile, Expo React Native).

SETUP — do this first:
1. Use the superpowers using-git-worktrees skill to create an isolated worktree. Branch FROM `feat/mobile-polish-pass` (not main). Name the branch `feat/mobile-redesign-core`.
2. CRITICAL: do NOT run `npm install` inside the worktree — worktrees under D:\trezo resolve node_modules upward to the root D:\trezo\node_modules. One task (font packages) requires a root install; when you reach it, ask me to run it at D:\trezo myself.

READ THESE (in the worktree; they live in docs/plans/, which is gitignored but present on disk — if missing in the new worktree, read them by absolute path from D:\trezo\.claude\worktrees\dapp-connect\docs\plans\):
- docs/plans/2026-05-30-mobile-redesign-spec.md   (LOCKED design spec — source of truth)
- docs/plans/2026-05-30-mobile-redesign-plan.md   (task-by-task implementation plan)
- docs/plans/mockups/core-*.html                  (VISUAL reference — open in a browser, match these; README has the anti-slop restraint rule)

Then execute the plan with the superpowers subagent-driven-development skill (or executing-plans), task by task, in order: Stream 0 (Tasks 1–3) first — it gates everything — then Stream B (Tasks 4–8).

HARD RULES (from the repo + the plan's CRITICAL CONSTRAINTS section — re-read them):
- No jest. Tests are plain tsx scripts, relative imports only; pure logic in no-RN-import modules with sibling __tests__; register in apps/mobile package.json `test:dapp`. Reference pattern: src/features/browser/utils/backAction.ts.
- Never --no-verify. Never add a `Co-Authored-By: Claude` trailer to commits.
- Do NOT touch the Browser webview chrome (only DiscoverHome content). Do NOT restyle the benchmark screens (Splash, Onboarding first-3, Simulation/DEX) — they only get the global font/token fixes.
- Testnet-demoable: no dead buttons; gated actions per spec §7 (ETH→Buy via Transak, USDC/LINK→Swap).
- After each task: `cd apps/mobile && npx tsc --noEmit` (add no new errors in touched files) and `npm run test:dapp` (green); then commit with a clear message. Do not batch unrelated changes.
- The P0 is Task 1 (load fonts — they have NEVER loaded; every screen currently renders system font). Verify it visibly on device before moving on.

When all tasks + the plan's self-review checklist are done, summarize what changed and stop. I'll review and merge feat/mobile-redesign-core into feat/mobile-polish-pass myself.
```

---

## Notes for the user (you)

- **Build order:** Stream 0 (fonts + tokens + helpers) must land before the screens. The font load (Task 1) is the single biggest visual lift and needs a one-time `npm install` at `D:\trezo` (the other terminal will ask you).
- **Parallel work:** while that terminal builds, we keep designing **Profile** here. When Profile is locked, I'll write a second plan + handoff for Stream A.
- **Merging:** the other terminal stops at a finished branch; you merge `feat/mobile-redesign-core` → `feat/mobile-polish-pass` and test on device (restart Metro with `-c` so fonts pick up).
- **Still parked (separate, unrelated):** the in-app browser back-nav fix on `feat/dapp-connect` (commit `224f5b12f`, conflict-free) still needs merging into `feat/mobile-polish-pass` whenever you want it.
