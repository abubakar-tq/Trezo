# Antigravity ContextOps Setup

The AI Context rules for this repository use a state-of-the-art **ContextOps** hierarchical structure to reduce token waste and improve AI targeting.

## Global Context & Tooling

### graphify & repomix
- This repository has a dedicated, git-ignored local AST Repomap setup at `.antigravity/repomap.xml` powered by Repomix.
- ALWAYS read `.antigravity/repomap.xml` to gain a compressed, AST-level understanding of the entire codebase's classes, functions, and architecture before blindly searching. This is your primary alternative to `graphify`.
- The repomap is automatically regenerated on every git commit, merge, checkout, and rebase via local git hooks (`post-commit`, `post-merge`, `post-checkout`, `post-rewrite`).
- If you significantly modify files in a session, you MUST run `npx repomix -c .antigravity/repomix.config.json --quiet` to keep the repomap current *before* you commit.
- For exploring code, use semantic indexing/codebase search first.
- Use graphify (`graphify-out/`) after semantic search when relationships, call graphs, inheritance, or architecture remain unclear.
- After modifying code files, run `graphify update .` to keep the graph current.

### context and tooling
- Use Context7 for current library/API documentation before relying on model memory (Expo, viem, wagmi, Supabase, Foundry, OpenZeppelin, Solady, zk-email).
- Use Exa MCP for current external facts, release notes, security advisories.
- Use RTK for compact read-only command output (`rtk git status`, `rtk grep`).
- Keep `contracts/lib` readable because it is tracked dependency source.

### learning scaffold
For changes matching ADR criteria OR 3+ files with structural impact, include the following block in your response and invoke `/log-decision`:
```
* Insight ---------------------------------
- Why this approach (1 line)
- Alternative considered + why rejected (1 line)
- Trade-off accepted or risk to watch (1 line)
-------------------------------------------
```

## Scoped Context (ContextOps)
When working in a specific directory, you **MUST** read its local `.context/` file to inherit its specialized architecture and security rules before generating code:

- `contracts/.context/security.md` - Smart contract security lenses.
- `contracts/.context/recovery.md` - Smart contract recovery plan.
- `apps/mobile/src/.context/recovery.md` - Mobile application recovery rules.
- `apps/mobile/src/.context/expo.md` - Expo and React Native best practices.
