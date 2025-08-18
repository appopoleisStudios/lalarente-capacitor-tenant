# Finding: Back Arrows Invisible on All Screens Due to Light Color

- ID: 20241219-INVISIBLE-BACK-ARROWS
- Status: Open
- Severity: S2
- Priority: P1
- Area: Navigation
- Role(s): Vendor
- Device/Viewport: Android Samsung M33
- Build/Commit: Debug Build, 2024-12-19

## Summary
Back arrows on all screens throughout the app are invisible due to very light color, making navigation extremely difficult for users. This affects the entire app's usability and navigation flow.

## Environment
- URL/Route: All screens with back navigation
- Account: Vendor account
- Data preconditions: User logged in as vendor

## Steps to Reproduce
1. Navigate to any screen in the app
2. Look for back arrow buttons in headers
3. Observe that back arrows are invisible or barely visible
4. Try to navigate back using the invisible arrows

## Expected Behavior
- Back arrows should be clearly visible with adequate contrast
- Navigation should be intuitive and accessible
- All navigation elements should meet accessibility standards
- Users should be able to easily navigate back

## Actual Behavior
- Back arrows appear invisible due to very light color
- Users cannot see navigation elements
- Makes it impossible to navigate back without restarting the app
- Affects all screens throughout the application

## Visual Evidence
- Screenshot(s): `./attachments/2024-12-19-invisible-back-arrows.png`
- Video (optional): Screen recording showing invisible back arrows across multiple screens

## Accessibility Notes (if any)
- Critical navigation failure violates accessibility standards
- Users cannot navigate the app properly
- Affects all users but especially those with visual impairments
- Makes the app unusable for navigation

## Suggested Fix (optional)
- Increase contrast of all back arrow icons
- Use darker colors for navigation elements
- Ensure all navigation buttons meet WCAG contrast requirements
- Consider adding backgrounds or borders to make arrows more visible
- Apply consistent styling across all navigation elements

## Links
- Code: All navigation components and header components
- Related finding(s): Invisible back button on contract detail screen
- Backlog entry: `docs/backlog.md` - Ongoing section

## Verification Notes (filled by QA on retest)
- Fix build/PR: 
- Re-test date/device:
- Result: 
- Regression coverage added: yes/no
