# Maestro vs screens (generated)

PROVEN here only means a Maestro yaml **mentions** a testID or deep-link for that route.
It does **not** mean the last run passed. Re-run Maestro to know if the phone works.

| Routes | Maestro mentions | No testID | Unproven (has testID, no Maestro) |
| ------ | ---------------- | --------- | --------------------------------- |
| 140    | 55               | 75        | 10                                |

## Unproven (testID exists, no Maestro file uses it)

- `/(owner)/applications/[id]` — ids: screening-row-background, screening-row-credit, screening-row-identity
- `/(owner)/maintenance/[id]/invoice` — ids: invoice-reject-button, invoice-approve-button, invoice-reject-confirm
- `/(owner)/messages/[id]` — ids: thread-message-input, thread-send-button
- `/(owner)/properties/[id]/view3d` — ids: view3d-close, view3d-title, view3d-error-back
- `/(tenant)/messages/[id]` — ids: thread-message-input, thread-send-button
- `/(tenant)/properties/[id]` — ids: tenant-view-3d
- `/(tenant)/properties/[id]/view3d` — ids: view3d-close, view3d-title, view3d-error-back
- `/(vendor)/messages/[id]` — ids: thread-message-input, thread-send-button
- `/auth/login` — ids: email-input, password-input, sign-in-button, create-account-link
- `/auth/register` — ids: register-business-name, register-full-name, register-email, register-password, register-confirm-password, register-submit

## No testID (Maestro cannot target the screen)

- `/(owner)/add-property`
- `/(owner)/application-competition`
- `/(owner)/deposits`
- `/(owner)/documents/[id]`
- `/(owner)/inspections/[id]`
- `/(owner)/inspections/new`
- `/(owner)/insurance`
- `/(owner)/insurance/[id]`
- `/(owner)/insurance/new`
- `/(owner)/invoices`
- `/(owner)/leases/[id]`
- `/(owner)/leases/create`
- `/(owner)/maintenance/[id]`
- `/(owner)/maintenance/[id]/po/[poId]`
- `/(owner)/maintenance/[id]/progress-timeline`
- `/(owner)/maintenance/[id]/quote/[quoteId]`
- `/(owner)/maintenance/new`
- `/(owner)/maintenance/select-vendors`
- `/(owner)/maintenance/send-po`
- `/(owner)/messages/new`
- `/(owner)/notifications`
- `/(owner)/privacy`
- `/(owner)/privacy/data-rights`
- `/(owner)/properties`
- `/(owner)/properties/[id]/edit`
- `/(owner)/renewals`
- `/(owner)/statements`
- `/(owner)/tax-reports`
- `/(owner)/viewings/[id]`
- `/(tenant)/applications/[id]`
- `/(tenant)/apply/[propertyId]`
- `/(tenant)/deposit`
- `/(tenant)/inspections/[id]`
- `/(tenant)/lease-journey`
- `/(tenant)/lease-renewal`
- `/(tenant)/maintenance/[id]`
- `/(tenant)/maintenance/closure-confirm`
- `/(tenant)/messages/new`
- `/(tenant)/notifications`
- `/(tenant)/privacy`
- `/(tenant)/privacy/data-rights`
- `/(tenant)/vendor-payments/result`
- `/(tenant)/viewings/[id]`
- `/(tenant)/viewings/request`
- `/(vendor)/contracts/`
- `/(vendor)/contracts/[id]`
- `/(vendor)/earnings/`
- `/(vendor)/earnings/banking`
- `/(vendor)/jobs/`
- `/(vendor)/jobs/[id]`
- `/(vendor)/jobs/[id]/progress-update`
- `/(vendor)/jobs/[id]/request-closure`
- `/(vendor)/jobs/[id]/submit-invoice`
- `/(vendor)/maintenance/[id]/po/[poId]`
- `/(vendor)/maintenance/[id]/quote/[quoteId]`
- `/(vendor)/messages/new`
- `/(vendor)/privacy`
- `/(vendor)/privacy/data-rights`
- `/(vendor)/profile/services`
