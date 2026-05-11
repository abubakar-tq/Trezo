## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- For exploring code, use semantic indexing/codebase search first.
- Use graphify after semantic search when relationships, call graphs, inheritance, or architecture remain unclear.
- Read raw files only after semantic and graphify context are insufficient, and then only the smallest relevant file/range set.
- Never scan the whole repository blindly.
- Before answering architecture or codebase questions, do semantic search first; if results are not satisfactory, read graphify-out/GRAPH_REPORT.md for god nodes and community structure.
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files.
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## context and tooling

Rules:
- Use Context7 for current library/API documentation before relying on model memory, especially Expo React Native, viem, wagmi, ERC-4337 tooling, Supabase, Foundry, OpenZeppelin, Solady, zk-email, Roo/Codex, and MCP configuration.
- Use Exa MCP for web search only for current external facts, release notes, security advisories, package status, service docs, or when Context7 does not cover the source.
- Use Exa `get_code_context_exa` for external code examples and public library usage patterns when Context7 is insufficient.
- Use Exa `web_search_exa` for broad current web search and `crawling_exa` only for specific URLs that need page extraction.
- Use RTK for compact read-only command output when it preserves the signal: `rtk git status`, `rtk ls`, `rtk find`, `rtk grep`, and `rtk npm list`.
- Do not use RTK when exact full output is needed for debugging, auditing, or failure analysis.
- Keep `contracts/lib` readable because it is tracked dependency source. Do not add it to `.rooignore` or `.gitignore`.
- Do not open or search `contracts/lib` by default. Use it only when imports/inheritance, failing tests, ERC-4337 EntryPoint, zk-email dependencies, OpenZeppelin, or Solady behavior are directly relevant.
- `.graphifyignore` may exclude `contracts/lib` to keep Graphify focused and low-cost; that does not make the dependency source unreadable.

## codex security lenses

Use the relevant installed/local security lenses before finalizing Solidity or recovery changes:
- Reentrancy and callback safety for external calls, token hooks, and ETH/token transfers.
- External-call safety for low-level calls, ERC-1271 checks, arbitrary token integrations, and push-vs-pull flows.
- Input and arithmetic safety for public inputs, zero values, rounding, casting, fees, shares, and unchecked blocks.
- Semantic guard consistency for modifiers, pause checks, auth checks, recovery policy checks, and access control.
- State invariant checks for balances, passkey sets, guardian sets, thresholds, nonces, pending recovery state, and conservation relationships.
- Oracle/flash-loan analysis only when price, DEX, lending, or oracle state is involved.
- DoS/griefing analysis for loops, batch operations, guardian thresholds, unbounded sets, external-call failure paths, and gas-sensitive flows.

## local recovery plan

This repo has local, gitignored agent execution plans at:
- `plan.md` for the short master direction
- `agent-plans/recovery/README.md` for level-specific recovery execution files

Before implementing recovery work:
- Read `plan.md` after the graphify report.
- Read the matching file under `agent-plans/recovery/` for the level or phase being implemented.
- Treat the existing `SmartAccount`, `PasskeyValidator`, `SocialRecovery`, `EmailRecovery`, mobile `userOps.ts`, and Supabase recovery tables as the baseline.
- Do not redesign recovery from scratch unless the plan is explicitly replaced.

Current recovery direction:
- Level 1: existing passkey/device adds a new passkey/device.
- Level 2: on-chain guardian recovery with EIP-712 approvals, ERC-1271 support, nonce/deadline/chain binding, timelock, and permissionless submission.
- Level 3: zk-email guardian recovery after Level 1 and Level 2 are stable.

Hard rules:
- Recovery preserves the same smart-account address.
- Backend orchestration is UX only; valid recovery proofs must be permissionless to submit.
- No `onlyBackend` / `onlyRelayer` gate in recovery contracts.
- Use shared recovery request/hash helpers before changing multiple recovery methods.
- Do not start new work from zk-email unless the task is specifically scoped to existing email-recovery setup or deployment.

@RTK.md

## learning scaffold

For changes matching ADR criteria — paths in `.claude/settings.json` `learning.adrPaths` (currently: `contracts/**`, `apps/mobile/src/features/recovery/**`, `apps/mobile/src/features/wallet/services/**`, `scripts/deploy/**`), OR 3+ files with structural impact — include the following block in the response and invoke `/log-decision`:

```
* Insight ---------------------------------
- Why this approach (1 line)
- Alternative considered + why rejected (1 line)
- Trade-off accepted or risk to watch (1 line)
-------------------------------------------
```

Rules:
- Don't insert the block for trivial edits (typos, renames, single-function tweaks, formatting).
- Same trigger criteria as `log-decision` skill — single source of truth.
- When reading a file matching an ADR's `Path globs:` frontmatter, surface that ADR's title + Decision section in chat before editing (passive lookback).
- When introducing a concept the user might not know, prefix with [explainer] and include a 2-line plain-English explanation.

User-facing commands:
- `/log-decision <one-line context>` — force-log an ADR even when triggers don't fire.
- `/review-decisions` — quiz me on past decisions (active recall, spaced repetition).

The PostToolUse hook prints an advisory `[learning-scaffold]` reminder. Ignore it for sessions you deem exploratory only — it doesn't block work.
