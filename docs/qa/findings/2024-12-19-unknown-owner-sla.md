# Finding: Contract Cards Show "Unknown Owner" and Fixed SLA 48h

- ID: 20241219-UNKNOWN-OWNER-SLA
- Status: Open
- Severity: S3
- Priority: P2
- Area: Data Display
- Role(s): Vendor
- Device/Viewport: Android Samsung M33
- Build/Commit: Debug Build, 2024-12-19

## Summary
All contract cards in the vendor dashboard show "Unknown owner" instead of actual property owner names, and all contracts display a fixed "SLA: 48h" regardless of the actual service level agreement. This suggests data mapping or display issues.

## Environment
- URL/Route: `/dashboard/vendor/contracts`
- Account: Vendor account
- Data preconditions: User logged in as vendor with contracts available

## Steps to Reproduce
1. Navigate to vendor dashboard contracts page
2. Look at contract cards in the list
3. Observe the "Unknown owner" text in each contract card
4. Notice that all contracts show "SLA: 48h" regardless of contract type

## Expected Behavior
- Contract cards should display actual property owner names
- SLA should reflect the actual service level agreement for each contract
- Different contracts should show different SLA values based on their configuration

## Actual Behavior
- All contract cards show "Unknown owner" instead of real owner names
- All contracts display "SLA: 48h" regardless of contract type or configuration
- This appears to be a data mapping or fallback value issue

## Visual Evidence
- Screenshot(s): `./attachments/2024-12-19-contracts-text-visibility.png`
- Video (optional): Screen recording showing contract cards

## Accessibility Notes (if any)
- No specific accessibility issues noted
- Data accuracy issue rather than accessibility

## Suggested Fix (optional)
- Check database relationships between contracts and property owners
- Verify data mapping in contract card component
- Ensure owner information is properly fetched and displayed
- Review SLA field mapping and ensure it shows actual contract SLA values
- Check if this is a test data issue or actual data mapping problem

## Links
- Code: `src/app/dashboard/vendor/contracts/page.tsx` and contract card components
- Related finding(s): None
- Backlog entry: `docs/backlog.md` - Sprint 2 or Ongoing section

## Verification Notes (filled by QA on retest)
- Fix build/PR: 
- Re-test date/device:
- Result: 
- Regression coverage added: yes/no
