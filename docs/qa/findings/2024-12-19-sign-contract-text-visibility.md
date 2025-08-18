# Finding: Sign Contract Screen Has Very Light Data Text Making It Invisible

- ID: 20241219-SIGN-CONTRACT-TEXT-VISIBILITY
- Status: Open
- Severity: S2
- Priority: P1
- Area: Accessibility
- Role(s): Vendor
- Device/Viewport: Android Samsung M33
- Build/Commit: Debug Build, 2024-12-19

## Summary
The Sign Contract screen displays contract data text in very light colors, making it almost invisible and difficult to read. This affects the user's ability to review contract details before signing.

## Environment
- URL/Route: `/dashboard/vendor/contracts/sign?id=<contract_id>`
- Account: Vendor account
- Data preconditions: User logged in as vendor with contracts available

## Steps to Reproduce
1. Navigate to vendor dashboard contracts page
2. Click on any contract to view details
3. Go to the Sign Contract screen
4. Look at the contract data and details displayed
5. Observe that the text is very light and almost invisible

## Expected Behavior
- Contract data should be clearly visible with adequate contrast
- All text should be easily readable
- Contract details should be reviewable before signing
- Text should meet accessibility standards

## Actual Behavior
- Contract data text appears in very light colors
- Text is almost invisible against the background
- Users cannot read contract details properly
- Makes contract review impossible

## Visual Evidence
- Screenshot(s): `./attachments/2024-12-19-sign-contract-text-visibility.png`
- Video (optional): Screen recording showing invisible text on sign contract screen

## Accessibility Notes (if any)
- Text contrast ratio likely below WCAG AA standards
- Users cannot review contract details before signing
- Affects users with visual impairments
- May cause legal issues if users sign without reading

## Suggested Fix (optional)
- Increase text color contrast for all contract data
- Use darker colors for contract details
- Ensure all text meets WCAG contrast requirements
- Review and update all light text elements in the sign contract screen
- Consider using Tailwind's text-gray-700 or darker instead of light gray

## Links
- Code: `src/app/dashboard/vendor/contracts/sign/page.tsx`
- Related finding(s): Text visibility issues in contracts page
- Backlog entry: `docs/backlog.md` - Ongoing section

## Verification Notes (filled by QA on retest)
- Fix build/PR: 
- Re-test date/device:
- Result: 
- Regression coverage added: yes/no
