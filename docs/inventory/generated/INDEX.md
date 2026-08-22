# Generated inventory index

Generated: 2026-08-16T13:24:07.358Z

Do not edit by hand. Re-run `node scripts/generate-product-inventory.mjs`.

## Route counts

| Role   | Leaf routes |
| ------ | ----------- |
| root   | 2           |
| owner  | 53          |
| tenant | 40          |
| vendor | 28          |
| admin  | 14          |
| auth   | 3           |

## Full route tree

### root

- `/`
- `/test-components`

### owner

- `/(owner)/`
- `/(owner)/add-property`
- `/(owner)/ai-chat`
- `/(owner)/application-competition`
- `/(owner)/applications`
- `/(owner)/applications/[id]`
- `/(owner)/arrears`
- `/(owner)/compliance`
- `/(owner)/dashboard`
- `/(owner)/deposits`
- `/(owner)/documents`
- `/(owner)/documents/[id]`
- `/(owner)/early-termination`
- `/(owner)/holding-deposit`
- `/(owner)/inspections`
- `/(owner)/inspections/[id]`
- `/(owner)/inspections/new`
- `/(owner)/insurance`
- `/(owner)/insurance/[id]`
- `/(owner)/insurance/new`
- `/(owner)/invoices`
- `/(owner)/leases/[id]`
- `/(owner)/leases/create`
- `/(owner)/maintenance`
- `/(owner)/maintenance/[id]`
- `/(owner)/maintenance/[id]/invoice`
- `/(owner)/maintenance/[id]/po/[poId]`
- `/(owner)/maintenance/[id]/progress-timeline`
- `/(owner)/maintenance/[id]/quote/[quoteId]`
- `/(owner)/maintenance/[id]/review-closure`
- `/(owner)/maintenance/history/[propertyId]`
- `/(owner)/maintenance/new`
- `/(owner)/maintenance/select-vendors`
- `/(owner)/maintenance/send-po`
- `/(owner)/messages`
- `/(owner)/messages/[id]`
- `/(owner)/messages/new`
- `/(owner)/notifications`
- `/(owner)/payment-disputes`
- `/(owner)/privacy`
- `/(owner)/privacy/data-rights`
- `/(owner)/profile`
- `/(owner)/properties`
- `/(owner)/properties/[id]`
- `/(owner)/properties/[id]/edit`
- `/(owner)/properties/[id]/view3d`
- `/(owner)/renewals`
- `/(owner)/rent-roll`
- `/(owner)/statements`
- `/(owner)/tax-reports`
- `/(owner)/tenants`
- `/(owner)/viewings`
- `/(owner)/viewings/[id]`

### tenant

- `/(tenant)/`
- `/(tenant)/ai-chat`
- `/(tenant)/application-status`
- `/(tenant)/applications/[id]`
- `/(tenant)/apply/[propertyId]`
- `/(tenant)/arrears`
- `/(tenant)/dashboard`
- `/(tenant)/deposit`
- `/(tenant)/documents`
- `/(tenant)/early-termination`
- `/(tenant)/holding-deposit`
- `/(tenant)/inspections/[id]`
- `/(tenant)/lease`
- `/(tenant)/lease-journey`
- `/(tenant)/lease-renewal`
- `/(tenant)/maintenance`
- `/(tenant)/maintenance/[id]`
- `/(tenant)/maintenance/closure-confirm`
- `/(tenant)/maintenance/report`
- `/(tenant)/maintenance/verify`
- `/(tenant)/messages`
- `/(tenant)/messages/[id]`
- `/(tenant)/messages/new`
- `/(tenant)/notifications`
- `/(tenant)/payment-disputes`
- `/(tenant)/payments`
- `/(tenant)/privacy`
- `/(tenant)/privacy/data-rights`
- `/(tenant)/profile`
- `/(tenant)/properties/[id]`
- `/(tenant)/properties/[id]/view3d`
- `/(tenant)/reports`
- `/(tenant)/search`
- `/(tenant)/vendor-payments/`
- `/(tenant)/vendor-payments/[invoiceId]`
- `/(tenant)/vendor-payments/checkout`
- `/(tenant)/vendor-payments/result`
- `/(tenant)/viewings`
- `/(tenant)/viewings/[id]`
- `/(tenant)/viewings/request`

### vendor

- `/(vendor)/`
- `/(vendor)/ai-chat`
- `/(vendor)/contracts/`
- `/(vendor)/contracts/[id]`
- `/(vendor)/dashboard`
- `/(vendor)/earnings/`
- `/(vendor)/earnings/banking`
- `/(vendor)/jobs/`
- `/(vendor)/jobs/[id]`
- `/(vendor)/jobs/[id]/progress-update`
- `/(vendor)/jobs/[id]/request-closure`
- `/(vendor)/jobs/[id]/submit-invoice`
- `/(vendor)/maintenance`
- `/(vendor)/maintenance/[id]`
- `/(vendor)/maintenance/[id]/po/[poId]`
- `/(vendor)/maintenance/[id]/quote/[quoteId]`
- `/(vendor)/maintenance/[id]/quote/edit`
- `/(vendor)/maintenance/[id]/quote/new`
- `/(vendor)/messages`
- `/(vendor)/messages/[id]`
- `/(vendor)/messages/new`
- `/(vendor)/notifications`
- `/(vendor)/privacy`
- `/(vendor)/privacy/data-rights`
- `/(vendor)/profile/`
- `/(vendor)/profile/documents`
- `/(vendor)/profile/edit`
- `/(vendor)/profile/services`

### admin

- `/admin/DashboardPage`
- `/admin/DevAuditPage`
- `/admin/DevEnvPage`
- `/admin/DevGithubPage`
- `/admin/DevLogsPage`
- `/admin/DevPlanePage`
- `/admin/DevSupabasePage`
- `/admin/LeasesPage`
- `/admin/LoginPage`
- `/admin/MaintenancePage`
- `/admin/PaymentsPage`
- `/admin/PropertiesPage`
- `/admin/UsersPage`
- `/admin/VendorPayoutsPage`

### auth

- `/auth/login`
- `/auth/register`
- `/auth/signout`

## API orphans (defined, zero callers outside file)

- `getAccessToken` — src/features/ai-chat/api/lalaChatApi.ts
- `parseInvokeError` — src/features/ai-chat/api/lalaChatApi.ts
- `calculateAffordabilityRatio` — src/features/applications/api/applicationCompetition.api.ts
- `getPropertyDeposits` — src/features/applications/api/holdingDeposit.api.ts
- `getDocumentStats` — src/features/documents/api/documentsApi.ts
- `getExpiringDocuments` — src/features/documents/api/documentsApi.ts
- `logAccess` — src/features/documents/api/documentsApi.ts
- `updateDocument` — src/features/documents/api/documentsApi.ts
- `calculateDepositRefund` — src/features/inspections/api/inspectionsApi.ts
- `cancelInspection` — src/features/inspections/api/inspectionsApi.ts
- `compareInspections` — src/features/inspections/api/inspectionsApi.ts
- `finalizeInspection` — src/features/inspections/api/inspectionsApi.ts
- `getLeaseInspections` — src/features/inspections/api/inspectionsApi.ts
- `getMoveInInspection` — src/features/inspections/api/inspectionsApi.ts
- `getPropertyInspections` — src/features/inspections/api/inspectionsApi.ts
- `getTenantInspections` — src/features/inspections/api/inspectionsApi.ts
- `rescheduleInspection` — src/features/inspections/api/inspectionsApi.ts
- `startInspection` — src/features/inspections/api/inspectionsApi.ts
- `updateInspectionNotes` — src/features/inspections/api/inspectionsApi.ts
- `createPolicy` — src/features/insurance/api/insuranceClaims.api.ts
- `getPropertyPolicies` — src/features/insurance/api/insuranceClaims.api.ts
- `updateClaimStatus` — src/features/insurance/api/insuranceClaims.api.ts
- `checkExpiredForAutoConversion` — src/features/leases/api/leaseAutomation.api.ts
- `checkPendingEscalations` — src/features/leases/api/leaseAutomation.api.ts
- `convertToMonthToMonth` — src/features/leases/api/leaseAutomation.api.ts
- `processRentEscalation` — src/features/leases/api/leaseAutomation.api.ts
- `getOverdueNotices` — src/features/leases/api/leaseExpiry.api.ts
- `getTerminationDetails` — src/features/leases/api/leaseTermination.api.ts
- `calculateTotals` — src/features/maintenance/api/invoices/invoices.api.ts
- `generateInvoiceNumber` — src/features/maintenance/api/invoices/invoices.api.ts
- `getInvoiceById` — src/features/maintenance/api/invoices/invoices.api.ts
- `getInvoicesByOwner` — src/features/maintenance/api/invoices/invoices.api.ts
- `logAuditEvent` — src/features/maintenance/api/invoices/invoices.api.ts
- `validateLineItems` — src/features/maintenance/api/invoices/invoices.api.ts
- `findVendorByPO` — src/features/maintenance/api/purchase-orders/poActions.api.ts
- `getCompleteHistory` — src/features/maintenance/api/purchase-orders/poAudit.api.ts
- `createPO` — src/features/maintenance/api/purchase-orders/purchaseOrders.api.ts
- `getPOByContract` — src/features/maintenance/api/purchaseOrdersApi.ts
- `acceptQuoteOld` — src/features/maintenance/api/quotesApi.ts
- `rejectQuoteOld` — src/features/maintenance/api/quotesApi.ts
- `requestRevision` — src/features/maintenance/api/quotesApi.ts
- `createQuoteRequests` — src/features/maintenance/api/vendors/vendorQuoteRequests.api.ts
- `getQuoteRequestsForVendor` — src/features/maintenance/api/vendors/vendorQuoteRequests.api.ts
- `updateQuoteRequestStatus` — src/features/maintenance/api/vendors/vendorQuoteRequests.api.ts
- `addMediationMessage` — src/features/maintenance/api/work/tenantVerification.api.ts
- `autoApproveExpiredClosures` — src/features/maintenance/api/work/tenantVerification.api.ts
- `flagForMediation` — src/features/maintenance/api/work/tenantVerification.api.ts
- `getMediationMessages` — src/features/maintenance/api/work/tenantVerification.api.ts
- `markAsEmergencyRepair` — src/features/maintenance/api/work/tenantVerification.api.ts
- `overrideTenantVerification` — src/features/maintenance/api/work/tenantVerification.api.ts
- `addProgressNote` — src/features/maintenance/api/work/workProgress.api.ts
- `getProgressTimeline` — src/features/maintenance/api/work/workProgress.api.ts
- `archiveThread` — src/features/messaging/api/messagesApi.ts
- `closeThread` — src/features/messaging/api/messagesApi.ts
- `getThreadSummaries` — src/features/messaging/api/messagesApi.ts
- `onMessage` — src/features/messaging/api/messagesApi.ts
- `onUpdate` — src/features/messaging/api/messagesApi.ts
- `reopenThread` — src/features/messaging/api/messagesApi.ts
- `deleteNotification` — src/features/notifications/api/notificationsApi.ts
- `deleteReadNotifications` — src/features/notifications/api/notificationsApi.ts
- `getDefaultChannels` — src/features/notifications/api/notificationsApi.ts
- `getNotificationContent` — src/features/notifications/api/notificationsApi.ts
- `getNotificationStats` — src/features/notifications/api/notificationsApi.ts
- `getUserNotifications` — src/features/notifications/api/notificationsApi.ts
- `getUserPreferences` — src/features/notifications/api/notificationsApi.ts
- `markAllAsRead` — src/features/notifications/api/notificationsApi.ts
- `registerPushToken` — src/features/notifications/api/notificationsApi.ts
- `removePushToken` — src/features/notifications/api/notificationsApi.ts
- `sendPushNotification` — src/features/notifications/api/notificationsApi.ts
- `sendSms` — src/features/notifications/api/notificationsApi.ts
- `subscribeToNotifications` — src/features/notifications/api/notificationsApi.ts
- `updateUserPreferences` — src/features/notifications/api/notificationsApi.ts
- `buildActivityFeed` — src/features/owner/api/ownerDashboardApi.ts
- `calculateAnalytics` — src/features/owner/api/ownerDashboardApi.ts
- `calculateDocumentStats` — src/features/owner/api/ownerDashboardApi.ts
- `calculatePortfolioStats` — src/features/owner/api/ownerDashboardApi.ts
- `fetchHoldingDepositsCount` — src/features/owner/api/ownerDashboardApi.ts
- `fetchOpenDisputesCount` — src/features/owner/api/ownerDashboardApi.ts
- `fetchPendingClosureCount` — src/features/owner/api/ownerDashboardApi.ts
- `fetchPendingTerminationsCount` — src/features/owner/api/ownerDashboardApi.ts
- … +69 more

## Sleeper signal totals

- **credit-check**: 32
- **tpn**: 24
- **background-check**: 20
- **payprop**: 18
- **signiflow**: 17
- **identity-verify**: 15
- **todo-integrate**: 7
- **entegral**: 7
- **transunion**: 6
- **onfido**: 6
- **smile-identity**: 2
- **not-implemented**: 1

## Loop multipliers

```json
{
  "note": "Static JSX under-counts these. Multiply per entity (property, tenant, job).",
  "inspection": {
    "rooms": 10,
    "checklistItems": 82,
    "conditionChipsPerItem": 5,
    "photoRequiredPerRoom": true,
    "types": ["move_in", "periodic", "move_out"],
    "conservativeTapsPerConduct": 157
  },
  "complianceCertsPerProperty": ["eoc", "gas", "rates", "insurance", "fica", "popia"],
  "ficaModulesPerTenant": ["identity", "credit", "background"],
  "applicationWizardSteps": ["Personal", "Employment", "Documents", "Review"]
}
```
