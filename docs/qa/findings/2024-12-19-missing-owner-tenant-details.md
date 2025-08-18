# Finding: Overview Tab Missing Owner and Tenant Details

- ID: 20241219-MISSING-OWNER-TENANT-DETAILS
- Status: Open
- Severity: S2
- Priority: P1
- Area: Data Display
- Role(s): Vendor
- Device/Viewport: Android Samsung M33
- Build/Commit: Debug Build, 2024-12-19

## Summary
The Overview tab on the contract detail screen is missing owner and tenant details, which are essential information for vendors to understand the contract context and stakeholders involved.

## Environment
- URL/Route: `/dashboard/vendor/contracts/view?id=<contract_id>`
- Account: Vendor account
- Data preconditions: User logged in as vendor with contracts available

## Steps to Reproduce
1. Navigate to vendor dashboard contracts page
2. Click on any contract to view details
3. Go to the Overview tab
4. Look for owner and tenant information
5. Observe that these details are missing

## Expected Behavior
- Overview tab should display owner details (name, contact info)
- Overview tab should display tenant details (name, contact info)
- All stakeholder information should be clearly visible
- Information should help vendors understand who they're working with

## Actual Behavior
- Owner details are missing from Overview tab
- Tenant details are missing from Overview tab
- Only basic contract information is displayed
- Missing essential stakeholder context

## Visual Evidence
- Screenshot(s): `./attachments/2024-12-19-missing-owner-tenant-details.png`
- Video (optional): Screen recording showing Overview tab

## Accessibility Notes (if any)
- Missing information affects user understanding of contract context
- No specific accessibility issues noted

## Suggested Fix (optional)
- Add owner details section to Overview tab
- Add tenant details section to Overview tab
- Ensure proper data fetching for stakeholder information
- Display contact information for both parties
- Consider adding profile pictures or avatars

## Links
- Code: `src/app/dashboard/vendor/contracts/view/page.tsx`
- Related finding(s): Unknown owner issue in contract cards
- Backlog entry: `docs/backlog.md` - Sprint 2 section

## Verification Notes (filled by QA on retest)
- Fix build/PR: 
- Re-test date/device:
- Result: 
- Regression coverage added: yes/no
