# docs/changes — one folder per change

Every non-trivial change gets a folder: `docs/changes/<plane-id>-<short-slug>/`.
Plane stays the source of truth for status; each file names the Plane ID, and the Plane issue links the commit.

| File | Written by | Accepted when | Triggers |
|---|---|---|---|
| `intent.md` | Whoever has the idea, with Claude | Product owner merges it | Spec work |
| `spec.md` | Claude from the intent, policy skills loaded | Owner resolves flagged policy conflicts | Plan mode |
| `plan.md` | Engineer + Claude in plan mode (read-only) | Tech lead approves the PR that adds it | Coding |

Rules
- **No plan, no code.** Code PRs reference an approved `plan.md` (trivial fixes say why they skip it).
- A good plan lets someone who never saw the conversation build the change from it alone.
- Bug fixes: commit a failing test first, then `touch .claude/tests-locked`, fix the code, remove the lock.
- Copy the templates from `_template/`.
