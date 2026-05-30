# HANDOFF PROMPT — Profile Cleanup (Stream A)

Run in a fresh Claude terminal at `D:\trezo`. This can run in parallel with the Stream B (core screens) build — they touch mostly different files, but BOTH branch from `feat/mobile-polish-pass`, so merge them back one at a time and resolve any `RootNavigation.tsx` overlap.

---

```
We're implementing the Profile ecosystem cleanup (Stream A) for the Trezo wallet (apps/mobile, Expo React Native).

SETUP — do this first:
1. Use the superpowers using-git-worktrees skill to create an isolated worktree. Branch FROM `feat/mobile-polish-pass` (not main). Name the branch `feat/profile-cleanup`.
2. Do NOT run `npm install` in the worktree (deps resolve to root D:\trezo\node_modules). Stream A adds no new deps.

READ FIRST (tracked, your worktree will have them):
- docs/plans/2026-05-31-profile-cleanup-spec.md   (LOCKED design spec — source of truth)
- docs/plans/2026-05-31-profile-cleanup-plan.md   (task-by-task plan, with exact files + line numbers)
- docs/plans/2026-05-30-mobile-redesign-spec.md   (global design system: tokens, radius scale, restraint principle)

Then execute the plan with the superpowers subagent-driven-development skill, task by task in order (Task 1 deletes+nav first). Dispatch Sonnet 4.6 implementers per task; you (orchestrator) stay on Opus for sequencing + the two-stage review (spec-compliance then code-quality). Escalate a single task to Opus only if it returns BLOCKED or fails review twice.

HARD RULES (also in the plan's CRITICAL CONSTRAINTS — re-read them):
- SAFETY: do NOT change on-chain recovery logic (module install, guardian set, threshold, timelock, UserOp building). This is light-clean only: delete dead screens, gate dev UI behind __DEV__, split EmailRecovery by state, build the hub, surface remove-guardian, relabel in plain language. Plain-language labels wrap the SAME contract params. Verify recovery still works end-to-end on testnet at the end.
- No jest. Tests = plain tsx scripts, relative imports only, pure no-RN-import logic with sibling __tests__, registered in apps/mobile package.json `test:dapp`. Reference: src/features/browser/utils/backAction.ts.
- Never --no-verify. Never add a `Co-Authored-By: Claude` trailer.
- Anti-slop restraint (Profile-scoped): color = signal not decoration; healthy state calm/near-monochrome (faint violet icon chips, soft-glow active dots); amber ONLY on needs-action. Do NOT restyle the core screens (that's Stream B).
- After each task: `cd apps/mobile && npx tsc --noEmit` (no new errors in touched files) and `npm run test:dapp` (green); commit with a clear message.

When all tasks + the self-review checklist are done, summarize what changed and stop. I'll review and merge feat/profile-cleanup into feat/mobile-polish-pass myself.
```

---

## Notes for the user (you)

- **Parallel with Stream B:** Profile (Stream A) and Core (Stream B) touch mostly different files. The one overlap is `src/app/navigation/RootNavigation.tsx` (Stream A removes 3 screens; Stream B may not touch it). Merge the two branches back **one at a time**; if the second cherry-pick/merge conflicts on RootNavigation, it'll be a small manual resolve.
- **Model tiering:** same as Stream B — Opus high orchestrator + Sonnet implementers; escalate on BLOCKED/2x-fail.
- **No new deps**, so no root `npm install` needed for this stream (unlike Stream B's fonts).
- **Biggest task is Task 3** (EmailRecovery split, 2263 lines). If a Sonnet implementer struggles, that's the one to escalate to Opus.
