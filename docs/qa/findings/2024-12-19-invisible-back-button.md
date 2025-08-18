# Finding: Back Button on Header is Invisible on Contract Detail Screen

- ID: 20241219-INVISIBLE-BACK-BUTTON
- Status: Open
- Severity: S2
- Priority: P1
- Area: Navigation
- Role(s): Vendor
- Device/Viewport: Android Samsung M33
- Build/Commit: Debug Build, 2024-12-19

## Summary
The back button on the header of the contract detail screen (`contracts/{id}`) is invisible due to light color, making it difficult for users to navigate back to the previous screen.

## Environment
- URL/Route: `/dashboard/vendor/contracts/view?id=<contract_id>`
- Account: Vendor account
- Data preconditions: User logged in as vendor with contracts available

## Steps to Reproduce
1. Navigate to vendor dashboard contracts page
2. Click on any contract to view details
3. Look at the header back button
4. Observe that the back button is invisible or barely visible

## Expected Behavior
- Back button should be clearly visible with adequate contrast
- Button should be easily clickable and recognizable
- Should follow accessibility standards for navigation elements

## Actual Behavior
- Back button appears invisible due to very light color
- Users cannot see the navigation element
- Makes it difficult to return to the previous screen

## Visual Evidence
- Screenshot(s): `./attachments/2024-12-19-invisible-back-button.png`
- Video (optional): Screen recording showing invisible back button

## Accessibility Notes (if any)
- Navigation element not visible violates accessibility standards
- Users cannot navigate back without restarting the app
- Affects all users but especially those with visual impairments

## Suggested Fix (optional)
- Increase contrast of back button color
- Use darker color for back arrow icon
- Ensure button meets WCAG contrast requirements
- Consider adding a background or border to make it more visible

## Links
- Code: `src/app/dashboard/vendor/contracts/view/page.tsx`
- Related finding(s): Similar issue with other back buttons
- Backlog entry: `docs/backlog.md` - Ongoing section

## Verification Notes (filled by QA on retest)
- Fix build/PR: 
- Re-test date/device:
- Result: 
- Regression coverage added: yes/no
