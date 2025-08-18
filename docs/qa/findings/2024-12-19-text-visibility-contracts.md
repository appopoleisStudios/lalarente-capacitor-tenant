# Finding: Text Visibility Issues in Vendor Contracts Page

- ID: 20241219-TEXT-VISIBILITY-CONTRACTS
- Status: Open
- Severity: S2
- Priority: P1
- Area: Accessibility
- Role(s): Vendor
- Device/Viewport: Android Samsung M33
- Build/Commit: Debug Build, 2024-12-19

## Summary
Hint text and typed input text in the vendor contracts page are too light and almost invisible, making it difficult for users to read and interact with form elements. This affects search functionality and filter dropdowns.

## Environment
- URL/Route: `/dashboard/vendor/contracts`
- Account: Vendor account
- Data preconditions: User logged in as vendor with contracts available

## Steps to Reproduce
1. Navigate to vendor dashboard contracts page
2. Look at the search bar with placeholder "Search contracts..."
3. Try typing in the search field
4. Observe filter dropdowns ("Completed", "All Types", "All Priorities", "Newest First")
5. Notice the light gray text on white background

## Expected Behavior
- Placeholder text should be clearly visible with adequate contrast
- Typed input text should be clearly visible and readable
- Filter dropdown text should be easily readable
- All text should meet accessibility contrast standards

## Actual Behavior
- Placeholder text "Search contracts..." appears in very light gray on white background
- Filter dropdown text is also light gray and difficult to read
- Typed input text is almost invisible
- "Not specified" and "Not rated" values in contract cards are also too light

## Visual Evidence
- Screenshot(s): `./attachments/2024-12-19-contracts-text-visibility.png`
- Video (optional): Screen recording showing text visibility issues

## Accessibility Notes (if any)
- Text contrast ratio likely below WCAG AA standards (4.5:1 for normal text)
- Affects users with visual impairments
- May cause eye strain for all users

## Suggested Fix (optional)
- Increase text color contrast for placeholder text
- Ensure typed input text uses darker colors
- Update filter dropdown text colors
- Review and update all light gray text elements in the contracts page
- Consider using Tailwind's text-gray-600 or darker instead of text-gray-400

## Links
- Code: `src/app/dashboard/vendor/contracts/page.tsx`
- Related finding(s): None
- Backlog entry: `docs/backlog.md` - Ongoing section

## Verification Notes (filled by QA on retest)
- Fix build/PR: 
- Re-test date/device:
- Result: 
- Regression coverage added: yes/no
