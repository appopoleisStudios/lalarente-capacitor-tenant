# Usability & QA Findings Log

Add each new finding as a row below and create a detailed file in `docs/qa/findings/` using the template.

| Date | ID | Title | Severity | Priority | Area | Role | Route | Status | Owner | Link |
|------|----|-------|----------|----------|------|------|-------|--------|-------|------|
| 2024-12-19 | VD-001 | Vendor Dashboard Data Fetch Lag | Medium | High | Performance | Vendor | /dashboard/vendor/ | Open | Dev Team | [Details](./findings/2024-12-19-vendor-dashboard-lag.md) |
| 2024-12-19 | ON-001 | App Stuck on Vendor Onboarding Checklist | Medium | High | Auth | Vendor | /onboarding | Open | Dev Team | [Details](./findings/2024-12-19-onboarding-stuck.md) |
| 2024-12-19 | TV-001 | Text Visibility Issues in Vendor Contracts Page | Medium | High | Accessibility | Vendor | /dashboard/vendor/contracts | Open | Dev Team | [Details](./findings/2024-12-19-text-visibility-contracts.md) |
| 2024-12-19 | DO-001 | Contract Cards Show "Unknown Owner" and Fixed SLA 48h | Low | Medium | Data Display | Vendor | /dashboard/vendor/contracts | Open | Dev Team | [Details](./findings/2024-12-19-unknown-owner-sla.md) |
| 2024-12-19 | NB-001 | Back Button on Header is Invisible on Contract Detail Screen | Medium | High | Navigation | Vendor | /dashboard/vendor/contracts/view | Open | Dev Team | [Details](./findings/2024-12-19-invisible-back-button.md) |
| 2024-12-19 | OT-001 | Overview Tab Missing Owner and Tenant Details | Medium | High | Data Display | Vendor | /dashboard/vendor/contracts/view | Open | Dev Team | [Details](./findings/2024-12-19-missing-owner-tenant-details.md) |
| 2024-12-19 | SB-001 | Documents Tab Missing Submit Button After File Upload | Medium | High | File Upload | Vendor | /dashboard/vendor/contracts/view | Open | Dev Team | [Details](./findings/2024-12-19-missing-submit-button-documents.md) |
| 2024-12-19 | MS-001 | Message Sending Failed in Actions Tab | Medium | High | Communication | Vendor | /dashboard/vendor/contracts/view | Open | Dev Team | [Details](./findings/2024-12-19-message-send-failed.md) |
| 2024-12-19 | BA-001 | Back Arrows Invisible on All Screens Due to Light Color | Medium | High | Navigation | Vendor | All screens | Open | Dev Team | [Details](./findings/2024-12-19-invisible-back-arrows.md) |
| 2024-12-19 | NP-001 | Notes on Actions Tab Do Not Persist on Reload | Medium | High | Data Persistence | Vendor | /dashboard/vendor/contracts/view | Open | Dev Team | [Details](./findings/2024-12-19-notes-not-persisting.md) |
| 2024-12-19 | ST-001 | Sign Contract Screen Has Very Light Data Text Making It Invisible | Medium | High | Accessibility | Vendor | /dashboard/vendor/contracts/sign | Open | Dev Team | [Details](./findings/2024-12-19-sign-contract-text-visibility.md) |
| 2024-12-19 | SO-001 | Sign Contract Screen Missing Signature Options | Medium | High | Contract Signing | Vendor | /dashboard/vendor/contracts/sign | Open | Dev Team | [Details](./findings/2024-12-19-missing-signature-options.md) |
| 2024-12-19 | SC-001 | Sign Contract Button Fails with Error | Medium | High | Contract Signing | Vendor | /dashboard/vendor/contracts/sign | Open | Dev Team | [Details](./findings/2024-12-19-sign-contract-button-failed.md) |

## How to add a new finding
1) Create a file from the template: `docs/qa/templates/finding-template.md`
2) Save as: `docs/qa/findings/YYYY-MM-DD-<short-page-or-feature>-<slug>.md`
3) Add a row to the table above with a link to the file
4) If it requires work, also add an item in `docs/backlog.md` under the appropriate sprint

## Current summary (manual)
- Open: 13
- In Progress: 0
- Ready for Verify: 0
- Verified: 0
