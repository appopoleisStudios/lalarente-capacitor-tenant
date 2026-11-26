# REVIEW.md

How pull requests in this repo are reviewed. The Senior Auditor (khadeejahdreamcode) follows this file, and it is the required code-owner approver on `main`. Claude merges only after that approval.

## Inputs the reviewer reads first
1. The linked Plane issue (ID in the PR description).
2. `docs/changes/<plane-id>-<slug>/plan.md` (and `intent.md` / `spec.md` if present). The diff is checked against the plan.
3. CI results and the author's verification evidence (output of the repo's verify command).

## Three passes, every PR
Tag every finding with its pass.

| Pass | Question |
|---|---|
| **[bug]** | Does the change do what the plan says without breaking existing behaviour? Edge cases, error paths, null/empty input, concurrency, migrations. |
| **[security]** | Secrets, auth and authorisation, injection, unsafe input handling, personal data exposure, new network calls, dependency risk. Run Semgrep on changed files. |
| **[plan]** | Does the diff match `plan.md` and the Plane issue? Anything extra (scope creep) or missing? Unrelated refactors or reformatting are findings. |

## Severity
- **Important** — only if it breaks behaviour, leaks data, or breaches a policy (security, compliance, the plan). Important findings → **REQUEST CHANGES**.
- **Minor** — correctness risk worth fixing but not blocking. Listed, does not block.
- **Nit** — style and naming. **Maximum 5 per review.** Drop the rest.

## Verdict
- **APPROVE**: no Important findings, verify command passes, plan matched.
- **REQUEST CHANGES**: one or more Important findings. Each one says what is wrong, where (`file:line`), and what fixed looks like.
- Bug fixes must include a test that fails without the fix (failing test first). No test → Important [plan].
- The reviewer never pushes code to the PR and never approves a PR it authored.

## Review comment format
```
## Verdict: APPROVE | REQUEST CHANGES
Plane: <ID> · Plan: <path> · Verify: pass/fail
### Important
- [security] path/file.ts:42 — <what> → <fix>
### Minor
- [bug] ...
### Nits (max 5)
- ...
```

## Repo-specific notes
<!-- Add rules that only apply to this repo (e.g. migrations, payment code, patient data). -->
