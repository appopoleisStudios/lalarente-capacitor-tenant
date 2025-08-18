# QA & Usability Findings – Process

This folder standardizes how we capture, triage, and resolve manual testing and usability findings.

## Goals
- Make manual test findings easy to log, search, and resolve
- Keep a clear trail from finding → fix → verification
- Feed improvements back into `docs/backlog.md` and test plans

## Where to log
- Index log: `docs/qa/usability-findings.md` (table of all findings)
- One finding = one markdown file under `docs/qa/findings/` (use the template)
- Release and regression checklists under `docs/qa/checklists/`

## How to log a finding
1) Copy the template:
   - From: `docs/qa/templates/finding-template.md`
   - To: `docs/qa/findings/YYYY-MM-DD-<short-page-or-feature>-<slug>.md`
2) Fill all required fields (Environment, Steps, Expected vs Actual, Severity, Priority, Screenshots)
3) Add a row to `docs/qa/usability-findings.md` table linking to the new file
4) If applicable, add a backlog item under the relevant sprint in `docs/backlog.md`

## Severity & Priority
- Severity (impact on users):
  - S1 Critical: blocks core flow or data loss
  - S2 High: major usability or correctness defect
  - S3 Medium: noticeable but non-blocking issue
  - S4 Low: cosmetic or copy
- Priority (when to fix): P0 now, P1 next release, P2 later

## Triage workflow
- Daily triage: assign owner, set target sprint/milestone
- Link to code location (file/function) if known
- Convert to external issue tracker (GitHub/Jira) if/when needed
- Move to "Ready for Verify" when a fix PR lands; include commit/PR ref

## Verification
- Re-run the Steps to Reproduce on the same environment/device
- If fixed, set Status=Verified and date; otherwise, update notes
- Add regression test or checklist item if applicable

## Release gates
A release must have:
- All S1 and S2 findings resolved or explicitly waived by product
- Release checklist completed in `docs/qa/checklists/release-qa-checklist.md`

## Useful references
- Test plan: `docs/manual-test-plan.md`
- Backlog: `docs/backlog.md`
