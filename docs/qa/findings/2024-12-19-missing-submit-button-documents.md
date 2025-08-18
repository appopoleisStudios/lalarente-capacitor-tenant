# Finding: Documents Tab Missing Submit Button After File Upload

- ID: 20241219-MISSING-SUBMIT-BUTTON-DOCUMENTS
- Status: Open
- Severity: S2
- Priority: P1
- Area: File Upload
- Role(s): Vendor
- Device/Viewport: Android Samsung M33
- Build/Commit: Debug Build, 2024-12-19

## Summary
On the Documents tab of the contract detail screen, users can upload files but there is no submit button to confirm the upload, leaving the upload process incomplete and unclear.

## Environment
- URL/Route: `/dashboard/vendor/contracts/view?id=<contract_id>`
- Account: Vendor account
- Data preconditions: User logged in as vendor with contracts available

## Steps to Reproduce
1. Navigate to vendor dashboard contracts page
2. Click on any contract to view details
3. Go to the Documents tab
4. Upload a file using the file upload functionality
5. Observe that there's no submit button to confirm the upload

## Expected Behavior
- After file selection, a submit button should appear
- User should be able to confirm and submit the uploaded file
- Clear indication that upload is complete
- Success message or confirmation after submission

## Actual Behavior
- File can be selected and uploaded
- No submit button appears after file selection
- Upload process feels incomplete
- No clear indication of upload status

## Visual Evidence
- Screenshot(s): `./attachments/2024-12-19-missing-submit-button-documents.png`
- Video (optional): Screen recording showing file upload process

## Accessibility Notes (if any)
- Missing submit action makes the upload process unclear
- Users may not know if their upload was successful
- No specific accessibility issues noted

## Suggested Fix (optional)
- Add a submit button after file selection
- Provide clear upload confirmation
- Show upload progress indicator
- Add success/error messages
- Ensure proper file upload validation

## Links
- Code: `src/app/dashboard/vendor/contracts/view/page.tsx`
- Related finding(s): None
- Backlog entry: `docs/backlog.md` - Sprint 2 section

## Verification Notes (filled by QA on retest)
- Fix build/PR: 
- Re-test date/device:
- Result: 
- Regression coverage added: yes/no
