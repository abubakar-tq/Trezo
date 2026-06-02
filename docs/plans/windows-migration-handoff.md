# Windows Migration Handoff — Trezo Wallet

**Date:** 2026-05-06
**From:** WSL2 Ubuntu (`/home/bakar/Desktop/BlockChain/trezo`)
**To:** Windows native (`D:\trezo`)
**User:** Bakar (Windows username)

---

## Why we moved

WSL2 had insufficient memory (7.4GB total, only ~2.5GB available) causing:
- Gradle build daemon OOM crashes during Android builds
- Kotlin compiler daemon being killed by the OS
- Native C++ compilation (Skia, react-native modules) consuming all available RAM
- Tried adjusting `gradle.properties` (heap size, parallel=false, in-process Kotlin) but base memory was still insufficient

**Decision:** Move main project to Windows, use WSL only via VS Code Remote-WSL extension for Foundry/contracts (where Foundry runs faster due to permission/symlink handling).

---

## Current state on Windows (`D:\trezo`)

### ✅ Completed
1. **Folder copied** from `\\wsl.localhost\Ubuntu\home\bakar\Desktop\BlockChain\trezo` to `D:\trezo`
2. **Git intact** — all branches present:
   - `chore/merge-onramp` (current branch)
   - `feat/mobile-polish-pass`
   - `feat/onramp`, `feat/indexer-ponder`, etc.
3. **Dependencies installed** — `npm install` completed (1460 packages)
4. **Expo dev server** runs successfully (`npm run start` shows QR code)
5. **Memory files copied** to `C:\Users\Bakar\.claude\projects\-home-bakar-Desktop-BlockChain-trezo\memory\`

### ⚠️ Known warnings (non-blocking)
- Node 20.18.0 installed; some packages prefer >=20.19.4 (warnings only, builds work)
- Submodules show as "modified" in `git status` — normal after WSL→Windows transfer
- 36 npm vulnerabilities (18 low, 13 moderate, 5 high) — typical for Expo/RN projects

### ❌ Not yet done
- `git submodule update --init --recursive` (Foundry submodules) — only needed if using Foundry on Windows
- Foundry not installed on Windows (intentional — using WSL terminal instead)
- Android Studio + SDK not verified (needed for `npm run android`)
- For Foundry: just use `wsl` in VS Code terminal, no extension needed

---

## Commits made on `chore/merge-onramp` before migration

1. `chore: add root workspace package.json and npm scripts`
2. `fix(mobile): resolve Expo entry point for workspace hoisting` (changed `main: "node_modules/expo/AppEntry.js"` → `"expo/AppEntry"`)
3. `chore(backend,contracts): update ponder indexer config and Makefile`
4. `chore: update .gitignore for docs and Foundry libraries`

## Commits made on `feat/mobile-polish-pass` before migration

1. `docs: add environment file examples for backend services` (3 .env.example files)

---

## Important config decisions

### `apps/mobile/.env`
- `EXPO_PUBLIC_PASSKEY_RP_ID=abubakar-tq.github.io` (kept original, NOT `adeel56.github.io`)
- `EXPO_PUBLIC_LAPTOP_IP=10.63.71.80` (kept original, NOT `10.45.194.26`)
- `EXPO_PUBLIC_GUARDIAN_PORTAL_URL=http://localhost:5173/` (kept original, NOT prod URL)
- Added: `EXPO_PUBLIC_CHAIN_ID=31337`, `EXPO_PUBLIC_RAMP_MODE=mock`, `EXPO_PUBLIC_TRANSAK_STAGING_API_KEY`, `SUPABASE_ANON_PUBLIC`, `SUPABASE_SERVICE_ROLE`

### `apps/mobile/android/gradle.properties`
- These changes are still in the repo but were originally for WSL workarounds:
  - `org.gradle.jvmargs=-Xmx1536m` (reduced from default for WSL OOM)
  - `kotlin.compiler.execution.strategy=in-process`
  - `kotlin.incremental=false`
  - `org.gradle.parallel=false`
  - `reactNativeArchitectures=arm64-v8a` (only one arch instead of all 4)
- **On Windows with more RAM, you can revert these for faster builds:**
  - `org.gradle.jvmargs=-Xmx4g` (or higher)
  - `org.gradle.parallel=true`
  - `reactNativeArchitectures=arm64-v8a,x86_64` (add x86_64 for emulator)

---

## Workflow on Windows

### Mobile development (Windows native)
```powershell
cd D:\trezo
npm run start           # Expo dev server
npm run android         # Build Android (needs Android SDK)
npm run ios             # Build iOS (only works on macOS)
```

### Contract development (via WSL terminal — no extension needed)

**Option 1: VS Code integrated terminal with WSL** (recommended)
1. In VS Code on Windows, open terminal (`Ctrl+``)
2. Click dropdown next to `+` → select **Ubuntu (WSL)**
3. Run forge commands:
   ```bash
   cd /mnt/d/trezo/contracts
   forge build
   forge test -vv
   make help
   ```

**Option 2: PowerShell + wsl command**
```powershell
wsl                              # Enter WSL
cd /mnt/d/trezo/contracts        # Navigate to Windows-mounted dir
forge test -vv
exit                             # Back to PowerShell
```

**Why this works without Remote-WSL extension:**
- Windows D: drive is mounted at `/mnt/d/` in WSL
- File I/O speed is identical to using Remote-WSL extension
- Forge runs in WSL-native binary, not Windows
- Edit files in VS Code on Windows (fast), compile in WSL terminal (also fast)

**When you DO need Remote-WSL extension:**
- Only if you want full VS Code Linux LSP/IntelliSense for Solidity from inside WSL
- For just running `forge` commands, terminal `wsl` is enough

### Both environments share the same `.git` directory
- Edit and commit from either Windows or WSL terminal
- Same repo, same branches, same history

---

## If you're starting a new Claude Code session

**Paste this into Claude:**

> I'm continuing work on the Trezo wallet project. I just moved from WSL2 (where I had memory crashes) to Windows native at `D:\trezo`. Read `docs/plans/windows-migration-handoff.md` for the full context. My current branch is `chore/merge-onramp`. I want to [describe your task].

**Key files Claude should read for context:**
- `CLAUDE.md` (project conventions)
- `docs/plans/windows-migration-handoff.md` (this file)
- Memory files at `C:\Users\Bakar\.claude\projects\-home-bakar-Desktop-BlockChain-trezo\memory\MEMORY.md`

---

## Common issues you might hit

### Issue: `expo: not found` after npm install
**Fix:** Check `apps/mobile/node_modules/.bin/expo` exists. If not, run `npm install` from root again.

### Issue: Android build fails with "JAVA_HOME not set"
**Fix:**
```powershell
$env:JAVA_HOME = "$env:LOCALAPPDATA\Android\Sdk\tools\openjdk"
```
Or set it permanently via Windows env vars (System Properties → Environment Variables).

### Issue: Gradle build fails, OOM
**Fix:** Edit `apps/mobile/android/gradle.properties`:
- `org.gradle.jvmargs=-Xmx4g` (Windows has more RAM than WSL2)

### Issue: `git status` shows submodule changes
**Fix:** Either ignore (cosmetic) or run `git submodule update --init --recursive` (only needed for Foundry).

### Issue: Long path errors on Windows
**Fix:** Enable Windows long paths:
```powershell
# Run as admin
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
                 -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
git config --system core.longpaths true
```

### Issue: `forge build` fails with "Source ... not found" for `lib/modulekit/node_modules/@ERC4337/...` or `solarray/...`
**Cause:** modulekit's `node_modules/` is populated with **pnpm symlinks** that point into a content-addressable `.pnpm/` store. When the project was copied from `\\wsl.localhost\Ubuntu\...\trezo\` to `D:\trezo\` via a Windows-side copy (Explorer / robocopy), Linux symlinks didn't translate to NTFS junctions — they became **0-byte stub files** at the symlink names. Forge's resolver lands on those empty stubs and reports "Source not found." The root `npm install` in `D:\trezo` does **not** fix this, because modulekit is a Foundry submodule outside the npm workspace tree and uses pnpm.

The same broken-symlinks pattern also produces 69 stub files under `contracts/lib/webauthn-sol/lib/FreshCryptoLib/solidity/tests/hardhat/node_modules/.bin/`. Those aren't needed for our build, so they're suppressed via `git update-index --skip-worktree`.

**Fix:** from a WSL terminal:
```bash
cd /mnt/d/trezo/contracts
make bootstrap
```
which runs `pnpm install --frozen-lockfile --config.node-linker=hoisted --config.package-import-method=copy` inside `lib/modulekit/`. The `node-linker=hoisted` + `package-import-method=copy` flags are mandatory: a plain `pnpm install` against a Windows-mounted drive (`/mnt/d/`) fails with `ERR_PNPM_EACCES` during pnpm's tmp-directory rename step. Run `make bootstrap` again any time you wipe `contracts/lib/modulekit/node_modules` or re-clone the repo on Windows.

### Issue: Need Foundry on Windows (not via WSL)
**Fix:**
```powershell
curl -L https://foundry.paradigm.xyz | iex
git submodule update --init --recursive
cd contracts
forge build
```

---

## Memory file locations

- **WSL (original):** `/home/bakar/.claude/projects/-home-bakar-Desktop-BlockChain-trezo/memory/`
- **Windows (copied):** `C:\Users\Bakar\.claude\projects\-home-bakar-Desktop-BlockChain-trezo\memory\`

Memory contains: project context, infra layout, debugging notes, conventions.

---

## Quick verification commands (Windows)

```powershell
cd D:\trezo
git status                           # Should show "On branch chore/merge-onramp"
git branch -a                        # Should list all branches
node --version                       # Should show v20.x
npm --version                        # Should show 11.x
npm list --depth=0 --workspace apps/mobile   # Verify mobile deps installed
```
