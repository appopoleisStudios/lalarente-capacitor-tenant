# Visible UI testing (Maestro)

These tests **use the app like a human**: you watch the simulator/emulator while Maestro taps buttons, focuses fields, and types text. No hidden `testID` hacks or mocked form fills.

## What this is / isn't

| Yes | No |
|-----|-----|
| Real taps on "Sign In", "Lala AI", etc. | Jest unit tests |
| Visible typing in email/password/chat fields | API-only checks |
| Runs on iOS Simulator / Android emulator | Headless-only automation |
| You watch every step on screen | CI-only invisible runs (optional later) |

## One-time setup

1. **Install Maestro**
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Add Maestro to your shell PATH** (installer uses `~/.maestro/bin` — npm does not load `.zshrc`)
   ```bash
   echo 'export PATH="$PATH:$HOME/.maestro/bin"' >> ~/.zshrc
   source ~/.zshrc
   ~/.maestro/bin/maestro --version
   ```
   Our npm scripts also auto-detect `~/.maestro/bin/maestro` if PATH is missing. You can override with:
   `export MAESTRO_BIN="$HOME/.maestro/bin/maestro"`

3. **Build or run the app on a simulator** (same bundle id as production dev build)
   ```bash
   npx expo run:ios
   # or
   npx expo run:android
   ```
   App id: `com.lalarente.app` (not Expo Go).

4. **Credentials**
   ```bash
   cp .maestro/.env.example .maestro/.env
   # Edit .maestro/.env with tenant + owner QA logins
   ```

## Run tests (watch the simulator)

```bash
# Quick smoke (4 flows)
npm run test:e2e

# All shipped Build 5 client fixes (16 flows)
npm run test:e2e:shipped

# Record MP4 per flow for client demo
npm run test:e2e:video
```

Single flow:

```bash
npm run test:e2e -- .maestro/flows/02-tenant-lala-ai.yaml
```

Full coverage map: [QA_E2E_COVERAGE.md](./QA_E2E_COVERAGE.md)

## Record new tests by using the app

Best way to add coverage without writing YAML by hand:

```bash
npm run test:e2e:record -- .maestro/flows/05-my-flow.yaml
```

Maestro opens the app; you log in, navigate, tap — it **records** visible interactions into a flow file. Review/edit the YAML, then commit.

## Flows included

See [QA_E2E_COVERAGE.md](./QA_E2E_COVERAGE.md) for the full PR / Sheet 2 mapping (16 flows covering merged #6–#10).

## Tips

- Keep the **simulator window visible** while tests run.
- If a step fails, Maestro leaves the app on the failing screen — easy to debug.
- Prefer matching **visible text** (button labels, placeholders) over `testID`.
- Native-only flows (camera upload) may need manual steps or Maestro's image/permission helpers later.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Maestro is not installed" | Add `export PATH="$PATH:$HOME/.maestro/bin"` to `~/.zshrc`, or run `~/.maestro/bin/maestro --version` to confirm install |
| "App not found" | Install dev build with `npx expo run:ios` first |
| Login timeout | Check `.maestro/.env` credentials |
| Lala AI fails | Confirm `GROQ_API_KEY` on Supabase Edge |
| Wrong screen | Re-record with `npm run test:e2e:record` |

## Quick check on Mac mini

```bash
ls -la ~/.maestro/bin/maestro
git pull origin main --no-edit   # avoids opening vim for merge messages
npm run test:e2e
```

### `git pull` opens vim

That usually means Git wants a **merge commit message** or you have a **merge conflict**.

- Exit vim: press `Esc`, type `:wq` and Enter (save and quit), or `:q!` and Enter (quit without saving).
- Pull without opening an editor:
  ```bash
  GIT_EDITOR=true git pull origin main --no-edit
  ```
- If pull failed with conflicts: `git status`, fix conflicted files, then `git add .` and `git commit` (or `git merge --abort` to undo the merge).

Keep local changes before pull: `git stash -u && git pull origin main --no-edit && git stash pop`
