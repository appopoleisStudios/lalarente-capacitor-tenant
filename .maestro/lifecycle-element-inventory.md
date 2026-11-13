# Lifecycle element inventory (generated from source)

Every interactive element, alert and navigation call on each lifecycle screen. `testID` = `-` means the element has no testID today and needs one before Maestro can target it reliably. Line numbers are exact; the label and proposed testID columns are heuristics (nearest text in the JSX block) and need a human pass when the IDs are added.

| Screen                            | Elements | Without testID | Alerts  |
| --------------------------------- | -------- | -------------- | ------- |
| TenantSearchScreen                | 11       | 1              | 0       |
| TenantPropertyDetailScreen        | 9        | 0              | 4       |
| TenantRequestViewingScreen        | 9        | 2              | 5       |
| TenantViewingsScreen              | 6        | 1              | 0       |
| TenantViewingDetailScreen         | 7        | 0              | 4       |
| OwnerViewingsScreen               | 7        | 1              | 2       |
| OwnerViewingDetailScreen          | 25       | 3              | 9       |
| TenantApplicationScreen           | 23       | 0              | 25      |
| TenantApplicationStatusScreen     | 5        | 0              | 2       |
| TenantApplicationDetailScreen     | 3        | 0              | 2       |
| OwnerApplicationsScreen           | 9        | 1              | 0       |
| OwnerApplicationDetailScreen      | 20       | 4              | 12      |
| OwnerApplicationCompetitionScreen | 6        | 0              | 7       |
| TenantHoldingDepositScreen        | 4        | 0              | 2       |
| OwnerHoldingDepositScreen         | 14       | 1              | 10      |
| OwnerLeaseCreateScreen            | 20       | 0              | 5       |
| OwnerLeaseReviewScreen            | 6        | 0              | 3       |
| OwnerLeaseDetailScreen            | 12       | 2              | 11      |
| TenantLeaseScreen                 | 10       | 2              | 8       |
| TenantLeaseJourneyScreen          | 5        | 1              | 0       |
| SignatureModal                    | 4        | 0              | 2       |
| OwnerInspectionsListScreen        | 6        | 0              | 0       |
| OwnerScheduleInspectionScreen     | 8        | 0              | 3       |
| InspectionScreen                  | 31       | 2              | 10      |
| OwnerInspectionDetailScreen       | 6        | 0              | 3       |
| TenantReportsScreen               | 5        | 0              | 0       |
| TenantMaintenanceReportScreen     | 17       | 0              | 9       |
| TenantMaintenanceListScreen       | 7        | 2              | 3       |
| TenantMaintenanceDetailScreen     | 10       | 0              | 4       |
| TenantClosureConfirmScreen        | 9        | 0              | 3       |
| TenantVerificationScreen          | 12       | 0              | 8       |
| OwnerMaintenanceListScreen        | 7        | 3              | 1       |
| OwnerMaintenanceDetailScreen      | 17       | 2              | 21      |
| VendorSelectionScreen             | 10       | 1              | 11      |
| OwnerQuoteDetailScreen            | 7        | 1              | 7       |
| OwnerSendPOScreen                 | 8        | 1              | 6       |
| OwnerClosureApprovalScreen        | 8        | 0              | 7       |
| **Total**                         | **383**  | **31**         | **209** |

## 1. Search and property

### TenantSearchScreen — 11 elements, 0 alerts

`src/features/tenant/screens/TenantSearchScreen.tsx`

| #   | Line | Element          | Label / purpose              | Action                                                         | Shown when                     | Disabled when | testID now                      | Proposed testID          |
| --- | ---- | ---------------- | ---------------------------- | -------------------------------------------------------------- | ------------------------------ | ------------- | ------------------------------- | ------------------------ |
| 1   | 125  | TouchableOpacity | —                            | `() => router.push(`/(tenant)/properties/${item.id}` as any)}` | always                         | —             | "tenant-property-card"          | (keep)                   |
| 2   | 196  | TouchableOpacity | Retry                        | `loadProperties}`                                              | always                         | —             | "tenant-search-retry"           | (keep)                   |
| 3   | 215  | TextInput        | Search by location, title... | `setSearchQuery}`                                              | always                         | —             | "tenant-search-input"           | (keep)                   |
| 4   | 224  | TouchableOpacity | —                            | `() => setSearchQuery('')}>`                                   | `{searchQuery.length > 0 && (` | —             | "tenant-search-clear"           | (keep)                   |
| 5   | 229  | TouchableOpacity | Price Range                  | `() => setShowFilters(!showFilters)}`                          | always                         | —             | "tenant-search-filters-toggle"  | (keep)                   |
| 6   | 244  | TextInput        | Min                          | `setMinPrice}`                                                 | always                         | —             | "tenant-search-min-price"       | (keep)                   |
| 7   | 254  | TextInput        | Max                          | `setMaxPrice}`                                                 | always                         | —             | "tenant-search-max-price"       | (keep)                   |
| 8   | 270  | TouchableOpacity | —                            | `() => setBedrooms(bedrooms === num ? null : num)}`            | always                         | —             | {`tenant-search-bedrooms-${num} | (keep)                   |
| 9   | 293  | TouchableOpacity | —                            | `() => setPropertyType(propertyType === type ? null : type)}`  | always                         | —             | {`tenant-search-type-${type}    | (keep)                   |
| 10  | 315  | TouchableOpacity | Clear Filters                | `clearFilters}`                                                | always                         | —             | "tenant-search-clear-filters"   | (keep)                   |
| 11  | 346  | RefreshControl   | —                            | `onRefresh} />}`                                               | always                         | —             | -                               | `tenantsearch-onrefresh` |

### TenantPropertyDetailScreen — 9 elements, 4 alerts

`src/features/tenant/screens/TenantPropertyDetailScreen.tsx`

| #   | Line | Element          | Label / purpose             | Action                                                                 | Shown when                                        | Disabled when       | testID now                         | Proposed testID       |
| --- | ---- | ---------------- | --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------- | ------------------- | ---------------------------------- | --------------------- | ----------------------- | ------ |
| 1   | 294  | TouchableOpacity | Retry                       | `loadPropertyDetails}`                                                 | always                                            | —                   | "tenant-property-retry"            | (keep)                |
| 2   | 313  | TouchableOpacity | —                           | `() => router.back()}`                                                 | always                                            | —                   | "tenant-property-back"             | (keep)                |
| 3   | 321  | TouchableOpacity | ? 'heart' : 'heart-outline' | `handleShare}`                                                         | always                                            | —                   | "tenant-property-share"            | (keep)                |
| 4   | 328  | TouchableOpacity | ? 'heart' : 'heart-outline' | `handleToggleFavorite}`                                                | always                                            | —                   | "tenant-property-favorite"         | (keep)                |
| 5   | 374  | TouchableOpacity | View this property in 3D    | `() => {`                                                              | `{property.media_3d_url ? (`                      | —                   | "tenant-view-3d"                   | (keep)                |
| 6   | 531  | TouchableOpacity | —                           | `handleContactOwner}`                                                  | always                                            | —                   | "tenant-property-contact-owner"    | (keep)                |
| 7   | 553  | TouchableOpacity | View                        | `() => router.push(`/(tenant)/applications/${applicationId}` as any)}` | `{applicationId && (`                             | —                   | "tenant-property-view-application" | (keep)                |
| 8   | 568  | TouchableOpacity | —                           | `handleRequestViewing}`                                                | `{property.status === 'available' && !error && (` | `isCurrentProperty` | "tenant-property-request-viewing"  | (keep)                |
| 9   | 585  | TouchableOpacity | —                           | `handleApply}`                                                         | always                                            | `isCurrentProperty  |                                    | hasActiveApplication` | "tenant-property-apply" | (keep) |

Alerts to assert:

- L179 **Notice** buttons: []
- L183 **Error** buttons: []
- L198 **Notice** buttons: []
- L202 **Notice** buttons: []

## 2. Viewing

### TenantRequestViewingScreen — 9 elements, 5 alerts

`src/features/tenant/screens/TenantRequestViewingScreen.tsx`

| #   | Line | Element          | Label / purpose                                          | Action                                                                  | Shown when             | Disabled when | testID now                         | Proposed testID                         |
| --- | ---- | ---------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------- | ------------- | ---------------------------------- | --------------------------------------- |
| 1   | 205  | TouchableOpacity | Request Viewing                                          | `() => router.back()}`                                                  | always                 | —             | "viewing-request-back"             | (keep)                                  |
| 2   | 300  | TouchableOpacity | View Details                                             | `() => router.push(`/(tenant)/viewings/${existingViewing.id}` as any)}` | always                 | `cancelling`  | "viewing-request-existing-details" | (keep)                                  |
| 3   | 309  | TouchableOpacity | Cancel Request                                           | `handleCancelExisting}`                                                 | always                 | `cancelling`  | "viewing-request-existing-cancel"  | (keep)                                  |
| 4   | 345  | TouchableOpacity | —                                                        | `() => setShowDatePicker(true)}`                                        | always                 | —             | "viewing-request-date"             | (keep)                                  |
| 5   | 359  | TouchableOpacity | —                                                        | `() => setShowTimePicker(true)}`                                        | always                 | —             | "viewing-request-time"             | (keep)                                  |
| 6   | 373  | TextInput        | Add any questions or special requests for the viewing... | `setMessage}`                                                           | always                 | —             | "viewing-request-message"          | (keep)                                  |
| 7   | 420  | TouchableOpacity | Send Request                                             | `handleSubmit}`                                                         | always                 | `submitting`  | "viewing-request-submit"           | (keep)                                  |
| 8   | 441  | DateTimePicker   | ? 'spinner' : 'default'                                  | `handleDateChange}`                                                     | `{showDatePicker && (` | —             | -                                  | `tenantrequestviewing-handledatechange` |
| 9   | 452  | DateTimePicker   | ? 'spinner' : 'default'                                  | `handleTimeChange}`                                                     | `{showTimePicker && (` | —             | -                                  | `tenantrequestviewing-handletimechange` |

Alerts to assert:

- L84 **Cancel Viewing Request** buttons: ['No', 'Yes, Cancel']
- L96 **Error** buttons: []
- L138 **Error** buttons: []
- L148 **Invalid Date** buttons: []
- L194 **Error** buttons: []

### TenantViewingsScreen — 6 elements, 0 alerts

`src/features/tenant/screens/TenantViewingsScreen.tsx`

| #   | Line | Element          | Label / purpose   | Action                                   | Shown when                       | Disabled when | testID now                               | Proposed testID                |
| --- | ---- | ---------------- | ----------------- | ---------------------------------------- | -------------------------------- | ------------- | ---------------------------------------- | ------------------------------ |
| 1   | 173  | TouchableOpacity | Upcoming          | `() =>`                                  | always                           | —             | "tenant-viewing-card"                    | (keep)                         |
| 2   | 259  | TouchableOpacity | Browse Properties | `() => router.push('/(tenant)/search')}` | `{selectedStatus === 'all' && (` | —             | "tenant-viewings-browse"                 | (keep)                         |
| 3   | 275  | TouchableOpacity | Back              | `() => router.back()}`                   | always                           | —             | "screen-back"                            | (keep)                         |
| 4   | 300  | TouchableOpacity | Back              | `() => router.back()}`                   | always                           | —             | "screen-back"                            | (keep)                         |
| 5   | 317  | TouchableOpacity | ? '#FFF' : '#666' | `() => setSelectedStatus(filter.value)}` | always                           | —             | {`tenant-viewings-filter-${filter.value} | (keep)                         |
| 6   | 374  | RefreshControl   | —                 | `handleRefresh}`                         | always                           | —             | -                                        | `tenantviewings-handlerefresh` |

### TenantViewingDetailScreen — 7 elements, 4 alerts

`src/features/tenant/screens/TenantViewingDetailScreen.tsx`

| #   | Line | Element          | Label / purpose        | Action                                            | Shown when                  | Disabled when | testID now                          | Proposed testID |
| --- | ---- | ---------------- | ---------------------- | ------------------------------------------------- | --------------------------- | ------------- | ----------------------------------- | --------------- |
| 1   | 180  | TouchableOpacity | Viewing Details        | `() => router.back()} style={styles.backButton}>` | always                      | —             | "tenant-viewing-detail-back"        | (keep)          |
| 2   | 210  | TouchableOpacity | Viewing Details        | `() => router.back()} style={styles.backButton}>` | always                      | —             | "tenant-viewing-detail-back"        | (keep)          |
| 3   | 235  | TouchableOpacity | —                      | `handleViewProperty}>`                            | always                      | —             | "tenant-viewing-detail-property"    | (keep)          |
| 4   | 321  | TouchableOpacity | —                      | `() => {`                                         | always                      | —             | "tenant-viewing-detail-alternative" | (keep)          |
| 5   | 392  | TouchableOpacity | Call                   | `handleCallOwner}>`                               | `{viewing.owner.phone && (` | —             | "tenant-viewing-detail-call"        | (keep)          |
| 6   | 397  | TouchableOpacity | Chat                   | `() => router.push('/(tenant)/messages' as any)}` | always                      | —             | "tenant-viewing-detail-chat"        | (keep)          |
| 7   | 441  | TouchableOpacity | Cancel Viewing Request | `handleCancel}`                                   | `{canCancel && (`           | `cancelling`  | "tenant-viewing-detail-cancel"      | (keep)          |

Alerts to assert:

- L107 **Error** buttons: []
- L135 **Cancelled** buttons: ['OK']
- L140 **Error** buttons: []
- L345 **Error** buttons: []

### OwnerViewingsScreen — 7 elements, 2 alerts

`src/features/owner/screens/OwnerViewingsScreen.tsx`

| #   | Line | Element          | Label / purpose   | Action                                   | Shown when                           | Disabled when | testID now                              | Proposed testID               |
| --- | ---- | ---------------- | ----------------- | ---------------------------------------- | ------------------------------------ | ------------- | --------------------------------------- | ----------------------------- |
| 1   | 239  | TouchableOpacity | —                 | `() =>`                                  | always                               | —             | "owner-viewing-card"                    | (keep)                        |
| 2   | 335  | TouchableOpacity | Yes, viewed       | `(e) => {`                               | `{isAwaitingConfirmation(item) && (` | —             | "owner-viewing-card-viewed"             | (keep)                        |
| 3   | 346  | TouchableOpacity | No-show           | `(e) => {`                               | always                               | —             | "owner-viewing-card-noshow"             | (keep)                        |
| 4   | 392  | TouchableOpacity | Viewing Requests  | `() => router.back()}`                   | always                               | —             | "owner-viewings-back"                   | (keep)                        |
| 5   | 415  | TouchableOpacity | Viewing Requests  | `() => router.back()}`                   | always                               | —             | "owner-viewings-back"                   | (keep)                        |
| 6   | 430  | TouchableOpacity | ? '#FFF' : '#666' | `() => setSelectedStatus(filter.value)}` | always                               | —             | {`owner-viewings-filter-${filter.value} | (keep)                        |
| 7   | 487  | RefreshControl   | —                 | `handleRefresh}`                         | always                               | —             | -                                       | `ownerviewings-handlerefresh` |

Alerts to assert:

- L209 **Error** buttons: ['Cancel', 'No, no-show']
- L216 **Did the viewing happen?** buttons: ['Cancel', 'No, no-show', 'Yes, they viewed']

### OwnerViewingDetailScreen — 25 elements, 9 alerts

`src/features/owner/screens/OwnerViewingDetailScreen.tsx`

| #   | Line | Element          | Label / purpose                                                    | Action                                      | Shown when                                          | Disabled when | testID now                             | Proposed testID                             |
| --- | ---- | ---------------- | ------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------- | ------------- | -------------------------------------- | ------------------------------------------- | ------------------------------ | ------ |
| 1   | 294  | TouchableOpacity | —                                                                  | `() => setShowActionModal(false)}`          | `{actionType === 'complete' && 'Complete Viewing'}` | `processing`  | "owner-viewing-modal-close"            | (keep)                                      |
| 2   | 323  | TouchableOpacity | Suggest a different date/time instead                              | `() => setModifyDateTime(!modifyDateTime)}` | always                                              | —             | "owner-viewing-modal-modify-toggle"    | (keep)                                      |
| 3   | 339  | TouchableOpacity | —                                                                  | `() => setShowDatePicker(true)}`            | `{modifyDateTime && (`                              | —             | "owner-viewing-modal-date"             | (keep)                                      |
| 4   | 350  | TouchableOpacity | —                                                                  | `() => setShowTimePicker(true)}`            | always                                              | —             | "owner-viewing-modal-time"             | (keep)                                      |
| 5   | 366  | TextInput        | Add any notes for the tenant...                                    | `setResponseNotes}`                         | always                                              | —             | "owner-viewing-modal-notes"            | (keep)                                      |
| 6   | 384  | TextInput        | Please provide a reason...                                         | `setDeclineReason}`                         | `{actionType === 'decline' && (`                    | —             | "owner-viewing-modal-decline-reason"   | (keep)                                      |
| 7   | 404  | TouchableOpacity | —                                                                  | `() => openSlotPicker(index, 'date')}`      | always                                              | —             | "owner-viewing-modal-slot-date"        | (keep)                                      |
| 8   | 413  | TouchableOpacity | —                                                                  | `() => openSlotPicker(index, 'time')}`      | always                                              | —             | "owner-viewing-modal-slot-time"        | (keep)                                      |
| 9   | 422  | TouchableOpacity | —                                                                  | `() => removeAlternativeSlot(index)}`       | always                                              | —             | "owner-viewing-modal-slot-remove"      | (keep)                                      |
| 10  | 433  | TouchableOpacity | Add Alternative                                                    | `addAlternativeSlot}`                       | `{alternativeSlots.length < 3 && (`                 | —             | "owner-viewing-modal-slot-add"         | (keep)                                      |
| 11  | 449  | TextInput        | Add notes about the viewing (e.g., tenant feedback, next steps)... | `setResponseNotes}`                         | `{actionType === 'complete' && (`                   | —             | "owner-viewing-modal-complete-notes"   | (keep)                                      |
| 12  | 464  | TouchableOpacity | Cancel                                                             | `() => setShowActionModal(false)}`          | always                                              | `processing`  | "owner-viewing-modal-cancel"           | (keep)                                      |
| 13  | 473  | TouchableOpacity | —                                                                  | `handleConfirmAction}`                      | always                                              | `processing`  | "owner-viewing-modal-confirm"          | (keep)                                      |
| 14  | 493  | DateTimePicker   | ? 'spinner' : 'default'                                            | `handleDateChange}`                         | `{showDatePicker && (`                              | —             | -                                      | `ownerviewingdetail-handledatechange`       |
| 15  | 503  | DateTimePicker   | ? 'spinner' : 'default'                                            | `handleTimeChange}`                         | `{showTimePicker && (`                              | —             | -                                      | `ownerviewingdetail-handletimechange`       |
| 16  | 513  | DateTimePicker   | ? 'spinner' : 'default'                                            | `handleSlotPickerChange}`                   | `{showSlotPicker && activeSlotIndex != null && (`   | —             | -                                      | `ownerviewingdetail-handleslotpickerchange` |
| 17  | 537  | TouchableOpacity | Viewing Details                                                    | `() => router.back()}`                      | always                                              | —             | "owner-viewing-detail-back"            | (keep)                                      |
| 18  | 573  | TouchableOpacity | Viewing Request                                                    | `() => router.back()}`                      | always                                              | —             | "owner-viewing-detail-back"            | (keep)                                      |
| 19  | 656  | TouchableOpacity | Call                                                               | `handleCallTenant}`                         | `{viewing.tenant?.phone && (`                       | —             | "owner-viewing-detail-call"            | (keep)                                      |
| 20  | 664  | TouchableOpacity | Chat                                                               | `handleChatTenant}`                         | always                                              | —             | "owner-viewing-detail-chat"            | (keep)                                      |
| 21  | 757  | TouchableOpacity | Decline                                                            | `handleDeclinePress}`                       | `{isPending && !expired && (`                       | `processing   |                                        | !actionStatus.canDecline`                   | "owner-viewing-detail-decline" | (keep) |
| 22  | 771  | TouchableOpacity | Approve                                                            | `handleApprovePress}`                       | always                                              | `processing   |                                        | !actionStatus.canApprove`                   | "owner-viewing-detail-approve" | (keep) |
| 23  | 789  | TouchableOpacity | Cancel                                                             | `handleCancel}`                             | `{canComplete && (`                                 | `processing`  | "owner-viewing-detail-cancel"          | (keep)                                      |
| 24  | 799  | TouchableOpacity | Mark Complete                                                      | `handleCompletePress}`                      | always                                              | `processing`  | "owner-viewing-detail-complete"        | (keep)                                      |
| 25  | 813  | TouchableOpacity | Cancel Viewing                                                     | `handleCancel}`                             | `{isApproved && !canComplete && (`                  | `processing`  | "owner-viewing-detail-cancel-approved" | (keep)                                      |

Alerts to assert:

- L78 **Error** buttons: []
- L108 **Required** buttons: []
- L123 **Approved** buttons: ['OK']
- L142 **Declined** buttons: ['OK', 'OK']
- L147 **Completed** buttons: ['OK']
- L154 **Error** buttons: ['No', 'Yes, Cancel']
- L162 **Cancel Viewing** buttons: ['No', 'Yes, Cancel']
- L178 **Cancelled** buttons: ['OK']
- L184 **Error** buttons: []

## 3. Application

### TenantApplicationScreen — 23 elements, 25 alerts

`src/features/tenant/screens/TenantApplicationScreen.tsx`

| #   | Line | Element          | Label / purpose                              | Action                                           | Shown when                           | Disabled when | testID now                          | Proposed testID |
| --- | ---- | ---------------- | -------------------------------------------- | ------------------------------------------------ | ------------------------------------ | ------------- | ----------------------------------- | --------------- |
| 1   | 557  | TouchableOpacity | Apply for Property                           | `handleBack}`                                    | always                               | —             | "tenant-apply-back"                 | (keep)          |
| 2   | 623  | TouchableOpacity | Edit                                         | `() => router.push('/(tenant)/profile' as any)}` | always                               | —             | "tenant-apply-edit-personal"        | (keep)          |
| 3   | 667  | TextInput        | Enter your full name                         | `setFullName}`                                   | `{!fullName && (`                    | —             | "tenant-apply-full-name"            | (keep)          |
| 4   | 681  | TextInput        | your.email@example.com                       | `setEmail}`                                      | `{!email && (`                       | —             | "tenant-apply-email"                | (keep)          |
| 5   | 697  | TextInput        | +27 XX XXX XXXX                              | `setPhone}`                                      | `{!phone && (`                       | —             | "tenant-apply-phone"                | (keep)          |
| 6   | 712  | TextInput        | Enter your ID number                         | `setIdNumber}`                                   | `{!idNumber && (`                    | —             | "tenant-apply-id-number"            | (keep)          |
| 7   | 726  | TextInput        | YYYY-MM-DD (e.g., 1990-05-15)                | `setDateOfBirth}`                                | `{!dateOfBirth && (`                 | —             | "tenant-apply-dob"                  | (keep)          |
| 8   | 750  | TouchableOpacity | Edit                                         | `() => router.push('/(tenant)/profile' as any)}` | always                               | —             | "tenant-apply-edit-employment"      | (keep)          |
| 9   | 781  | TextInput        | Company name                                 | `setEmployer}`                                   | `{!employer && (`                    | —             | "tenant-apply-employer"             | (keep)          |
| 10  | 795  | TextInput        | Your job title                               | `setPosition}`                                   | `{!position && (`                    | —             | "tenant-apply-position"             | (keep)          |
| 11  | 809  | TextInput        | 0                                            | `setMonthlyIncome}`                              | `{!monthlyIncome && (`               | —             | "tenant-apply-income"               | (keep)          |
| 12  | 823  | TextInput        | YYYY-MM-DD (e.g., 2020-01-15)                | `setEmploymentStartDate}`                        | always                               | —             | "tenant-apply-employment-start"     | (keep)          |
| 13  | 836  | TextInput        | HR phone or email                            | `setEmployerContact}`                            | always                               | —             | "tenant-apply-employer-contact"     | (keep)          |
| 14  | 889  | TouchableOpacity | —                                            | `() => setIdDocFile(null)}`                      | always                               | —             | "tenant-apply-id-doc-remove"        | (keep)          |
| 15  | 902  | TouchableOpacity | Replace                                      | `pickIdDoc}>`                                    | always                               | —             | "tenant-apply-id-doc-replace"       | (keep)          |
| 16  | 908  | TouchableOpacity | Upload                                       | `pickIdDoc}`                                     | always                               | —             | "tenant-apply-id-doc-upload"        | (keep)          |
| 17  | 935  | TouchableOpacity | Add New                                      | `pickIncomeDoc}`                                 | always                               | —             | "tenant-apply-income-doc-add-new"   | (keep)          |
| 18  | 950  | TouchableOpacity | —                                            | `() =>`                                          | always                               | —             | "tenant-apply-income-doc-remove"    | (keep)          |
| 19  | 963  | TouchableOpacity | ? 'Add More' : 'Upload'                      | `pickIncomeDoc}`                                 | `{incomeDocFiles.length < 3 && (`    | —             | "tenant-apply-income-doc-upload"    | (keep)          |
| 20  | 992  | TouchableOpacity | —                                            | `() =>`                                          | always                               | —             | "tenant-apply-reference-doc-remove" | (keep)          |
| 21  | 1005 | TouchableOpacity | ? 'Add More' : 'Upload'                      | `pickReferenceDoc}`                              | `{referenceDocFiles.length < 3 && (` | —             | "tenant-apply-reference-doc-upload" | (keep)          |
| 22  | 1091 | TouchableOpacity | Next                                         | `handleNext}`                                    | `{currentStep < 4 ? (`               | `submitting`  | "tenant-apply-next"                 | (keep)          |
| 23  | 1100 | TouchableOpacity | ? 'Uploading documents...' : 'Submitting...' | `handleSubmit}`                                  | always                               | `submitting`  | "tenant-apply-submit"               | (keep)          |

Alerts to assert:

- L138 **Error** buttons: []
- L165 **Permission Required** buttons: []
- L196 **Upload Document** buttons: ['Take Photo', 'Choose File']
- L241 **Limit Reached** buttons: []
- L249 **Limit Reached** buttons: []
- L261 **Required** buttons: []
- L265 **Invalid** buttons: []
- L270 **Required** buttons: []
- L275 **Invalid** buttons: []
- L280 **Required** buttons: []
- L285 **Invalid** buttons: []
- L290 **Required** buttons: []
- L295 **Required** buttons: []
- L300 **Invalid** buttons: []
- L305 **Invalid** buttons: []
- L310 **Invalid** buttons: []
- L314 **Invalid** buttons: []
- L319 **Invalid** buttons: []
- L331 **Invalid** buttons: []
- L347 **Invalid** buttons: []
- L352 **Invalid** buttons: []
- L357 **Invalid** buttons: []
- L366 **Required** buttons: []
- L370 **Required** buttons: []
- L520 **Error** buttons: []

### TenantApplicationStatusScreen — 5 elements, 2 alerts

`src/features/tenant/screens/TenantApplicationStatusScreen.tsx`

| #   | Line | Element          | Label / purpose      | Action                                                   | Shown when                                      | Disabled when | testID now                           | Proposed testID |
| --- | ---- | ---------------- | -------------------- | -------------------------------------------------------- | ----------------------------------------------- | ------------- | ------------------------------------ | --------------- |
| 1   | 181  | TouchableOpacity | My Applications      | `() => router.back()}`                                   | always                                          | —             | "tenant-applications-back"           | (keep)          |
| 2   | 224  | TouchableOpacity | My Applications      | `() => router.back()}`                                   | always                                          | —             | "tenant-applications-back"           | (keep)          |
| 3   | 244  | TouchableOpacity | Browse Properties    | `() => router.push('/(tenant)/search' as any)}`          | always                                          | —             | "tenant-applications-browse"         | (keep)          |
| 4   | 324  | TouchableOpacity | —                    | `() => router.push('/(tenant)/holding-deposit' as any)}` | `{deposit && deposit.status === 'pending' && (` | —             | "tenant-applications-deposit-banner" | (keep)          |
| 5   | 412  | TouchableOpacity | Withdraw Application | `() => onWithdraw(app)}`                                 | `{canWithdraw && (`                             | —             | "tenant-applications-withdraw"       | (keep)          |

Alerts to assert:

- L142 **Error** buttons: []
- L167 **Error** buttons: []

### TenantApplicationDetailScreen — 3 elements, 2 alerts

`src/features/tenant/screens/TenantApplicationDetailScreen.tsx`

| #   | Line | Element          | Label / purpose      | Action                 | Shown when                                                               | Disabled when | testID now                    | Proposed testID |
| --- | ---- | ---------------- | -------------------- | ---------------------- | ------------------------------------------------------------------------ | ------------- | ----------------------------- | --------------- |
| 1   | 85   | TouchableOpacity | Retry                | `loadApplication}`     | always                                                                   | —             | "tenant-application-retry"    | (keep)          |
| 2   | 121  | TouchableOpacity | My Application       | `() => router.back()}` | always                                                                   | —             | "tenant-application-back"     | (keep)          |
| 3   | 245  | TouchableOpacity | Withdraw Application | `handleWithdraw}`      | `{(application.status === 'submitted' // application.status === 'under_` | —             | "tenant-application-withdraw" | (keep)          |

Alerts to assert:

- L57 **Success** buttons: ['OK']
- L61 **Error** buttons: []

### OwnerApplicationsScreen — 9 elements, 0 alerts

`src/features/owner/screens/OwnerApplicationsScreen.tsx`

| #   | Line | Element          | Label / purpose | Action                                                          | Shown when                          | Disabled when | testID now                            | Proposed testID               |
| --- | ---- | ---------------- | --------------- | --------------------------------------------------------------- | ----------------------------------- | ------------- | ------------------------------------- | ----------------------------- |
| 1   | 161  | TouchableOpacity | All             | `() => setSelectedStatus(null)}`                                | always                              | —             | "owner-applications-filter-all"       | (keep)                        |
| 2   | 173  | TouchableOpacity | —               | `() => setSelectedStatus(status)}`                              | always                              | —             | {`owner-applications-filter-${status} | (keep)                        |
| 3   | 195  | TouchableOpacity | All Properties  | `() => setSelectedProperty(null)}`                              | `{uniqueProperties.length > 1 && (` | —             | "owner-applications-property-all"     | (keep)                        |
| 4   | 212  | TouchableOpacity | —               | `() => setSelectedProperty(property.id)}`                       | `property && (`                     | —             | "owner-applications-property-chip"    | (keep)                        |
| 5   | 257  | TouchableOpacity | Retry           | `loadApplications}`                                             | always                              | —             | "owner-applications-retry"            | (keep)                        |
| 6   | 278  | TouchableOpacity | Applications    | `() => router.back()}`                                          | always                              | —             | "owner-applications-back"             | (keep)                        |
| 7   | 306  | RefreshControl   | —               | `onRefresh} />}`                                                | always                              | —             | -                                     | `ownerapplications-onrefresh` |
| 8   | 325  | TouchableOpacity | Compare         | `() =>`                                                         | `{group.activeCount >= 2 && (`      | —             | "owner-applications-compare"          | (keep)                        |
| 9   | 343  | TouchableOpacity | —               | `() => router.push(`/(owner)/applications/${item.id}` as any)}` | always                              | —             | "owner-application-card"              | (keep)                        |

### OwnerApplicationDetailScreen — 20 elements, 12 alerts

`src/features/owner/screens/OwnerApplicationDetailScreen.tsx`

| #   | Line | Element           | Label / purpose              | Action                                                                   | Shown when                                                               | Disabled when      | testID now                                  | Proposed testID                                  |
| --- | ---- | ----------------- | ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ------------------ | ------------------------------------------- | ------------------------------------------------ | --- | --------- | -------- | ------ |
| 1   | 255  | TouchableOpacity  | Retry                        | `loadApplication}`                                                       | always                                                                   | —                  | "owner-application-retry"                   | (keep)                                           |
| 2   | 281  | TouchableOpacity  | Application Details          | `() => router.back()}`                                                   | always                                                                   | —                  | "owner-application-back"                    | (keep)                                           |
| 3   | 395  | TouchableOpacity  | —                            | `async () => {`                                                          | always                                                                   | `screeningRunning` | "screening-run-button"                      | (keep)                                           |
| 4   | 456  | DocumentRow       | ID Document                  | `() => openDocument(application.id_document_url!)}`                      | `{application.id_document_url && (`                                      | —                  | -                                           | `ownerapplicationdetail-id-document`             |
| 5   | 465  | DocumentRow       | Proof of Income ${index + 1} | `() => openDocument(url)}`                                               | `application.proof_of_income_urls.length > 0 && (`                       | —                  | -                                           | `ownerapplicationdetail-proof-of-income-index-1` |
| 6   | 476  | DocumentRow       | Reference ${index + 1}       | `() => openDocument(url)}`                                               | `{application.reference_urls && application.reference_urls.length > 0 &` | —                  | -                                           | `ownerapplicationdetail-reference-index-1`       |
| 7   | 574  | TouchableOpacity  | Tenant reports payment made  | `() => router.push('/(owner)/holding-deposit' as any)}`                  | `{isPaymentClaimed(holdingDeposit) && (`                                 | —                  | "owner-application-deposit-claimed"         | (keep)                                           |
| 8   | 592  | TouchableOpacity  | —                            | `() => {`                                                                | `{holdingDeposit.status === 'paid' && (`                                 | —                  | "owner-application-deposit-apply-to-lease"  | (keep)                                           |
| 9   | 627  | TouchableOpacity  | Request Holding Deposit      | `openDepositModal}`                                                      | `{['under_review', 'shortlisted'].includes(application?.status // '') &` | —                  | "owner-application-request-holding-deposit" | (keep)                                           |
| 10  | 672  | TouchableOpacity  | Reject                       | `() => setShowRejectModal(true)}`                                        | `{application.status === 'submitted' // application.status === 'under_r` | `processing`       | "owner-application-reject"                  | (keep)                                           |
| 11  | 682  | TouchableOpacity  | Request Deposit              | `openDepositModal}`                                                      | `{!holdingDeposit && (`                                                  | `processing`       | "owner-application-request-deposit"         | (keep)                                           |
| 12  | 692  | TouchableOpacity  | —                            | `handleApprove}`                                                         | always                                                                   | `processing`       | "owner-application-approve"                 | (keep)                                           |
| 13  | 720  | TouchableOpacity  | Create Lease                 | `() => router.push(`/(owner)/leases/create?applicationId=${id}` as any)` | `) : application.status === 'approved' && !hasLease ? (`                 | —                  | "owner-application-create-lease"            | (keep)                                           |
| 14  | 731  | TouchableOpacity  | —                            | `async () => {`                                                          | `) : application.status === 'approved' && hasLease ? (`                  | —                  | "owner-application-view-lease"              | (keep)                                           |
| 15  | 763  | TextInput         | e.g. 8500                    | `setDepositAmount}`                                                      | always                                                                   | —                  | "owner-application-deposit-amount"          | (keep)                                           |
| 16  | 775  | TouchableOpacity  | Cancel                       | `() => {`                                                                | always                                                                   | —                  | "owner-application-deposit-cancel"          | (keep)                                           |
| 17  | 785  | TouchableOpacity  | Send Request                 | `handleRequestDeposit}`                                                  | always                                                                   | `processing`       | "owner-application-deposit-send"            | (keep)                                           |
| 18  | 804  | ReasonPromptModal | Reject Application           | `handleReject}`                                                          | always                                                                   | —                  | -                                           | `ownerapplicationdetail-reject-application`      |
| 19  | 906  | TouchableOpacity  | ? 'Failed' : 'Tap to verify' | `handleTap}`                                                             | always                                                                   | `updating          |                                             | isDone                                           |     | isFailed` | {testID} | (keep) |
| 20  | 927  | TouchableOpacity  | —                            | `onPress}`                                                               | always                                                                   | —                  | "owner-application-document-row"            | (keep)                                           |

Alerts to assert:

- L117 **Reminder sent** buttons: []
- L159 **Success** buttons: ['Create Lease', 'OK']
- L186 **Success** buttons: ['OK']
- L190 **Error** buttons: []
- L199 **Invalid Amount** buttons: []
- L219 **Error** buttons: []
- L234 **Error** buttons: []
- L406 **Screening complete** buttons: []
- L408 **Screening failed** buttons: []
- L610 **Error** buttons: []
- L880 **Error** buttons: ['Mark Failed']
- L895 **Error** buttons: []

### OwnerApplicationCompetitionScreen — 6 elements, 7 alerts

`src/features/owner/screens/OwnerApplicationCompetitionScreen.tsx`

| #   | Line | Element          | Label / purpose | Action                            | Shown when           | Disabled when | testID now                         | Proposed testID |
| --- | ---- | ---------------- | --------------- | --------------------------------- | -------------------- | ------------- | ---------------------------------- | --------------- |
| 1   | 265  | TouchableOpacity | Shortlist       | `() => handleShortlist(item)}`    | `{canShortlist && (` | `isLoading`   | "owner-competition-shortlist"      | (keep)          |
| 2   | 279  | TouchableOpacity | Mark Backup     | `() => handleSetBackup(item)}`    | `{canSetBackup && (` | `isLoading`   | "owner-competition-backup"         | (keep)          |
| 3   | 293  | TouchableOpacity | Select Tenant   | `() => handleSelectWinner(item)}` | `{canSelect && (`    | `isLoading`   | "owner-competition-select"         | (keep)          |
| 4   | 316  | TouchableOpacity | Applications    | `() => router.back()}`            | always               | —             | "owner-competition-back"           | (keep)          |
| 5   | 336  | TouchableOpacity | Applications    | `() => router.back()}`            | always               | —             | "owner-competition-back"           | (keep)          |
| 6   | 388  | TouchableOpacity | Promote Backup  | `handlePromoteBackup}`            | `{hasBackup && (`    | —             | "owner-competition-promote-backup" | (keep)          |

Alerts to assert:

- L78 **Error** buttons: []
- L90 **Error** buttons: []
- L103 **Error** buttons: ['Cancel']
- L135 **Error** buttons: []
- L157 **Success** buttons: []
- L160 **No Backups** buttons: []
- L163 **Error** buttons: []

## 4. Holding deposit

### TenantHoldingDepositScreen — 4 elements, 2 alerts

`src/features/tenant/screens/TenantHoldingDepositScreen.tsx`

| #   | Line | Element          | Label / purpose  | Action                             | Shown when                                                               | Disabled when | testID now                              | Proposed testID |
| --- | ---- | ---------------- | ---------------- | ---------------------------------- | ------------------------------------------------------------------------ | ------------- | --------------------------------------- | --------------- |
| 1   | 181  | TouchableOpacity | Holding Deposits | `() => router.back()}`             | always                                                                   | —             | "tenant-holding-deposit-back"           | (keep)          |
| 2   | 204  | TouchableOpacity | Holding Deposits | `() => router.back()}`             | always                                                                   | —             | "tenant-holding-deposit-back"           | (keep)          |
| 3   | 337  | TouchableOpacity | Show             | `() => {`                          | always                                                                   | —             | "tenant-holding-deposit-reference-show" | (keep)          |
| 4   | 382  | TouchableOpacity | I Have Paid      | `() => onConfirmPayment(deposit)}` | `{deposit.status === 'pending' && !isPaymentClaimed(deposit) && onConfi` | —             | "tenant-holding-deposit-i-have-paid"    | (keep)          |

Alerts to assert:

- L144 **Error** buttons: ['Cancel']
- L167 **Error** buttons: []

### OwnerHoldingDepositScreen — 14 elements, 10 alerts

`src/features/owner/screens/OwnerHoldingDepositScreen.tsx`

| #   | Line | Element            | Label / purpose        | Action                               | Shown when                        | Disabled when | testID now                              | Proposed testID                                |
| --- | ---- | ------------------ | ---------------------- | ------------------------------------ | --------------------------------- | ------------- | --------------------------------------- | ---------------------------------------------- |
| 1   | 241  | TouchableOpacity   | Holding Deposits       | `() => router.back()}`               | always                            | —             | "owner-holding-deposit-back"            | (keep)                                         |
| 2   | 270  | TouchableOpacity   | Holding Deposits       | `() => router.back()}`               | always                            | —             | "owner-holding-deposit-back"            | (keep)                                         |
| 3   | 281  | TouchableOpacity   | —                      | `() => setShowCreateModal(true)}`    | always                            | —             | "owner-holding-deposit-create"          | (keep)                                         |
| 4   | 328  | TouchableOpacity   | —                      | `() => setFilterStatus(f)}`          | always                            | —             | {`owner-holding-deposit-filter-${f}     | (keep)                                         |
| 5   | 371  | CreateDepositModal | —                      | `() => setShowCreateModal(false)}`   | always                            | —             | -                                       | `ownerholdingdeposit-setshowcreatemodal-false` |
| 6   | 460  | TouchableOpacity   | Confirm Receipt        | `() => onConfirmReceipt(deposit)}`   | always                            | —             | "owner-holding-deposit-confirm-receipt" | (keep)                                         |
| 7   | 469  | TouchableOpacity   | Not Received           | `() => onNotReceived(deposit)}`      | always                            | —             | "owner-holding-deposit-not-received"    | (keep)                                         |
| 8   | 481  | TouchableOpacity   | Apply to Lease         | `() => onApplyToLease(deposit)}`     | `{deposit.status === 'paid' && (` | —             | "owner-holding-deposit-apply"           | (keep)                                         |
| 9   | 490  | TouchableOpacity   | Refund                 | `() => onRefund(deposit)}`           | always                            | —             | "owner-holding-deposit-refund"          | (keep)                                         |
| 10  | 580  | TouchableOpacity   | Property               | `onClose}`                           | always                            | —             | "owner-holding-deposit-modal-close"     | (keep)                                         |
| 11  | 597  | TouchableOpacity   | —                      | `() => setSelectedPropertyId(p.id)}` | `{properties.length === 0 ? (`    | —             | "owner-holding-deposit-modal-property"  | (keep)                                         |
| 12  | 627  | TextInput          | tenant@example.com     | `setTenantEmail}`                    | always                            | —             | "owner-holding-deposit-modal-email"     | (keep)                                         |
| 13  | 639  | TextInput          | e.g. 5000              | `setAmount}`                         | always                            | —             | "owner-holding-deposit-modal-amount"    | (keep)                                         |
| 14  | 656  | TouchableOpacity   | Create Deposit Request | `handleCreate}`                      | always                            | `loading`     | "owner-holding-deposit-modal-create"    | (keep)                                         |

Alerts to assert:

- L128 **Error** buttons: ['Cancel']
- L145 **Refunded** buttons: []
- L148 **Error** buttons: []
- L167 **Confirmed** buttons: []
- L170 **Error** buttons: []
- L192 **Error** buttons: []
- L211 **Applied** buttons: []
- L214 **Error** buttons: []
- L533 **Invalid Amount** buttons: []
- L569 **Error** buttons: []

## 5. Lease creation and signing

### OwnerLeaseCreateScreen — 20 elements, 5 alerts

`src/features/owner/screens/OwnerLeaseCreateScreen.tsx`

| #   | Line | Element          | Label / purpose                          | Action                                         | Shown when                    | Disabled when | testID now                                 | Proposed testID |
| --- | ---- | ---------------- | ---------------------------------------- | ---------------------------------------------- | ----------------------------- | ------------- | ------------------------------------------ | --------------- |
| 1   | 273  | TouchableOpacity | Go Back                                  | `() => router.back()}`                         | always                        | —             | "owner-lease-create-go-back"               | (keep)          |
| 2   | 291  | TouchableOpacity | Create Lease                             | `() => router.back()}`                         | always                        | —             | "owner-lease-create-back"                  | (keep)          |
| 3   | 331  | TouchableOpacity | Fixed Term                               | `() => setLeaseType('fixed')}`                 | always                        | —             | "owner-lease-create-type-fixed"            | (keep)          |
| 4   | 343  | TouchableOpacity | Month-to-Month                           | `() => setLeaseType('month_to_month')}`        | always                        | —             | "owner-lease-create-type-month"            | (keep)          |
| 5   | 362  | TouchableOpacity | ? '#111' : '#999'                        | `() => setShowStartDatePicker(true)}`          | always                        | —             | "owner-lease-create-start-date"            | (keep)          |
| 6   | 374  | DateTimePicker   | Done                                     | `handleStartDateChange}`                       | `{showStartDatePicker && (`   | —             | "owner-lease-create-start-date-done"       | (keep)          |
| 7   | 382  | TouchableOpacity | Done                                     | `confirmStartDateIos}`                         | `{Platform.OS === 'ios' && (` | —             | "owner-lease-create-start-date-done"       | (keep)          |
| 8   | 396  | TouchableOpacity | ? '#111' : '#999'                        | `() => setShowEndDatePicker(true)}`            | always                        | `!startDate`  | "owner-lease-create-end-date"              | (keep)          |
| 9   | 415  | DateTimePicker   | Done                                     | `handleEndDateChange}`                         | `{showEndDatePicker && (`     | —             | "owner-lease-create-end-date-done"         | (keep)          |
| 10  | 423  | TouchableOpacity | Done                                     | `confirmEndDateIos}`                           | `{Platform.OS === 'ios' && (` | —             | "owner-lease-create-end-date-done"         | (keep)          |
| 11  | 443  | TextInput        | 15000                                    | `setMonthlyRent}`                              | always                        | —             | "owner-lease-create-rent"                  | (keep)          |
| 12  | 456  | TextInput        | 15000                                    | `setDepositAmount}`                            | always                        | —             | "owner-lease-create-deposit"               | (keep)          |
| 13  | 469  | TextInput        | 1                                        | `setPaymentDueDay}`                            | always                        | —             | "owner-lease-create-due-day"               | (keep)          |
| 14  | 482  | TextInput        | 500                                      | `setLateFeeAmount}`                            | always                        | —             | "owner-lease-create-late-fee"              | (keep)          |
| 15  | 495  | TextInput        | 3                                        | `setLateFeeGraceDays}`                         | always                        | —             | "owner-lease-create-grace-days"            | (keep)          |
| 16  | 515  | TouchableOpacity | ? 'radio-button-on' : 'radio-button-off' | `() => setRentEscalationType('percentage')}`   | always                        | —             | "owner-lease-create-escalation-percentage" | (keep)          |
| 17  | 531  | TouchableOpacity | ? 'radio-button-on' : 'radio-button-off' | `() => setRentEscalationType('fixed_amount')}` | always                        | —             | "owner-lease-create-escalation-fixed"      | (keep)          |
| 18  | 554  | TextInput        | —                                        | `setRentEscalationValue}`                      | always                        | —             | "owner-lease-create-escalation-value"      | (keep)          |
| 19  | 567  | TextInput        | 12                                       | `setRentEscalationFrequency}`                  | always                        | —             | "owner-lease-create-escalation-frequency"  | (keep)          |
| 20  | 582  | TouchableOpacity | Review Lease Agreement                   | `handleCreateLease}`                           | always                        | —             | "owner-lease-create-review"                | (keep)          |

Alerts to assert:

- L193 **Error** buttons: []
- L202 **Validation Error** buttons: []
- L207 **Validation Error** buttons: []
- L212 **Validation Error** buttons: []
- L217 **Validation Error** buttons: []

### OwnerLeaseReviewScreen — 6 elements, 3 alerts

`src/features/owner/screens/OwnerLeaseReviewScreen.tsx`

| #   | Line | Element          | Label / purpose                                                                   | Action                              | Shown when | Disabled when | testID now                         | Proposed testID |
| --- | ---- | ---------------- | --------------------------------------------------------------------------------- | ----------------------------------- | ---------- | ------------- | ---------------------------------- | --------------- |
| 1   | 228  | TouchableOpacity | Review Lease                                                                      | `() => router.back()}`              | always     | —             | "owner-lease-review-back"          | (keep)          |
| 2   | 259  | TouchableOpacity | ? 'Edit Custom Clauses' : 'Add Custom Clauses'                                    | `() => setShowClausesModal(true)}`  | always     | —             | "owner-lease-review-clauses-open"  | (keep)          |
| 3   | 270  | TouchableOpacity | Send lease to tenant                                                              | `handleSendToTenant}`               | always     | `submitting`  | "owner-lease-review-send"          | (keep)          |
| 4   | 304  | TouchableOpacity | —                                                                                 | `() => setShowClausesModal(false)}` | always     | —             | "owner-lease-review-clauses-close" | (keep)          |
| 5   | 315  | TextInput        | e.g. Tenant is responsible for pool maintenance. No pets without written consent… | `setCustomClauses}`                 | always     | —             | "owner-lease-review-clauses-input" | (keep)          |
| 6   | 326  | TouchableOpacity | —                                                                                 | `() => {`                           | always     | —             | "owner-lease-review-clauses-save"  | (keep)          |

Alerts to assert:

- L101 **Error** buttons: []
- L201 **Lease Sent** buttons: ['OK']
- L206 **Error** buttons: []

### OwnerLeaseDetailScreen — 12 elements, 11 alerts

`src/features/owner/screens/OwnerLeaseDetailScreen.tsx`

| #   | Line | Element          | Label / purpose              | Action                                              | Shown when                        | Disabled when   | testID now                        | Proposed testID                           |
| --- | ---- | ---------------- | ---------------------------- | --------------------------------------------------- | --------------------------------- | --------------- | --------------------------------- | ----------------------------------------- |
| 1   | 427  | TouchableOpacity | Retry                        | `loadLease}`                                        | always                            | —               | "owner-lease-retry"               | (keep)                                    |
| 2   | 449  | TouchableOpacity | Lease Details                | `() => router.back()}`                              | always                            | —               | "owner-lease-back"                | (keep)                                    |
| 3   | 616  | TouchableOpacity | Lease Agreement              | `handleViewDocument}`                               | `{lease.lease_document_url ? (`   | —               | "owner-lease-view-document"       | (keep)                                    |
| 4   | 632  | TouchableOpacity | Download PDF                 | `handleDownloadDocument}`                           | always                            | `actionLoading` | "owner-lease-download-pdf"        | (keep)                                    |
| 5   | 666  | TouchableOpacity | —                            | `handleRegeneratePDF}`                              | `{lease.status === 'active' && (` | `actionLoading` | "owner-lease-regenerate-pdf"      | (keep)                                    |
| 6   | 714  | TouchableOpacity | Send to Tenant for Signature | `handleSendToTenant}`                               | `{lease.status === 'draft' && (`  | `actionLoading` | "owner-lease-send-to-tenant"      | (keep)                                    |
| 7   | 740  | TouchableOpacity | Sign to Activate Lease       | `handleSignLease}`                                  | always                            | `actionLoading` | "owner-lease-sign"                | (keep)                                    |
| 8   | 771  | TouchableOpacity | Schedule Inspection          | `() =>`                                             | `{lease.status === 'active' && (` | —               | "owner-lease-schedule-inspection" | (keep)                                    |
| 9   | 785  | TouchableOpacity | View All Inspections         | `() => router.push('/(owner)/inspections' as any)}` | always                            | —               | "owner-lease-view-inspections"    | (keep)                                    |
| 10  | 801  | TouchableOpacity | Contact Tenant               | `handleContactTenant}`                              | always                            | —               | "owner-lease-contact-tenant"      | (keep)                                    |
| 11  | 813  | SignatureModal   | Sign Lease Agreement         | `() => setShowSignatureModal(false)}`               | always                            | —               | -                                 | `ownerleasedetail-sign-lease-agreement`   |
| 12  | 813  | SignatureModal   | Sign Lease Agreement         | `handleSignatureSave}`                              | always                            | —               | -                                 | `ownerleasedetail-sign-lease-agreement-2` |

Alerts to assert:

- L115 **Error** buttons: ['Cancel']
- L118 **Notice** buttons: ['Cancel', 'Generate']
- L125 **Regenerate PDF** buttons: ['Cancel', 'Generate']
- L133 **Success** buttons: []
- L138 **Error** buttons: []
- L149 **Notice** buttons: []
- L159 **Error** buttons: []
- L195 **Error** buttons: []
- L249 **Success** buttons: []
- L254 **Error** buttons: []
- L359 **Success** buttons: ['OK']

### TenantLeaseScreen — 10 elements, 8 alerts

`src/features/tenant/screens/TenantLeaseScreen.tsx`

| #   | Line | Element          | Label / purpose           | Action                                   | Shown when                                                               | Disabled when   | testID now                       | Proposed testID                      |
| --- | ---- | ---------------- | ------------------------- | ---------------------------------------- | ------------------------------------------------------------------------ | --------------- | -------------------------------- | ------------------------------------ |
| 1   | 374  | TouchableOpacity | Search Properties         | `() => router.push('/(tenant)/search')}` | always                                                                   | —               | "tenant-lease-search-properties" | (keep)                               |
| 2   | 392  | TouchableOpacity | Retry                     | `loadActiveLease}`                       | always                                                                   | —               | "tenant-lease-retry"             | (keep)                               |
| 3   | 554  | TouchableOpacity | Lease Agreement           | `handleViewDocument}`                    | `{lease.lease_document_url ? (`                                          | —               | "tenant-lease-view-document"     | (keep)                               |
| 4   | 570  | TouchableOpacity | Download PDF              | `handleDownloadDocument}`                | always                                                                   | `actionLoading` | "tenant-lease-download-pdf"      | (keep)                               |
| 5   | 607  | TouchableOpacity | Generate PDF              | `handleGeneratePDF}`                     | `{lease.status === 'active' && (`                                        | `actionLoading` | "tenant-lease-generate-pdf"      | (keep)                               |
| 6   | 655  | TouchableOpacity | Sign Lease Agreement      | `handleSignLease}`                       | always                                                                   | `actionLoading` | "tenant-lease-sign"              | (keep)                               |
| 7   | 687  | TouchableOpacity | Request Early Termination | `() =>`                                  | `{(lease.status === 'active' // lease.status === 'month_to_month') && (` | —               | "tenant-lease-early-termination" | (keep)                               |
| 8   | 705  | TouchableOpacity | Contact Owner             | `handleContactOwner}`                    | always                                                                   | —               | "tenant-lease-contact-owner"     | (keep)                               |
| 9   | 717  | SignatureModal   | Sign Lease Agreement      | `() => setShowSignatureModal(false)}`    | always                                                                   | —               | -                                | `tenantlease-sign-lease-agreement-2` |
| 10  | 717  | SignatureModal   | Sign Lease Agreement      | `handleSignatureSave}`                   | always                                                                   | —               | -                                | `tenantlease-sign-lease-agreement-3` |

Alerts to assert:

- L131 **Error** buttons: []
- L136 **Notice** buttons: ['OK']
- L145 **Success** buttons: ['OK']
- L150 **Error** buttons: []
- L158 **Notice** buttons: []
- L168 **Error** buttons: []
- L188 **Error** buttons: []
- L303 **Success** buttons: ['OK']

### TenantLeaseJourneyScreen — 5 elements, 0 alerts

`src/features/tenant/screens/TenantLeaseJourneyScreen.tsx`

| #   | Line | Element          | Label / purpose   | Action                                   | Shown when | Disabled when | testID now                         | Proposed testID                    |
| --- | ---- | ---------------- | ----------------- | ---------------------------------------- | ---------- | ------------- | ---------------------------------- | ---------------------------------- |
| 1   | 201  | TouchableOpacity | Search Properties | `() => router.push('/(tenant)/search')}` | always     | —             | "tenant-journey-search-properties" | (keep)                             |
| 2   | 219  | TouchableOpacity | Retry             | `loadTimeline}`                          | always     | —             | "tenant-journey-retry"             | (keep)                             |
| 3   | 236  | TouchableOpacity | Lease Journey     | `() => router.back()}`                   | always     | —             | "tenant-journey-back"              | (keep)                             |
| 4   | 247  | TouchableOpacity | —                 | `() => router.push('/(tenant)/lease')}`  | always     | —             | "tenant-journey-open-lease"        | (keep)                             |
| 5   | 260  | RefreshControl   | No events yet     | `handleRefresh} tintColor="#16A34A" />`  | always     | —             | -                                  | `tenantleasejourney-no-events-yet` |

### SignatureModal — 4 elements, 2 alerts

`src/features/leases/components/SignatureModal.tsx`

| #   | Line | Element          | Label / purpose   | Action           | Shown when | Disabled when | testID now              | Proposed testID |
| --- | ---- | ---------------- | ----------------- | ---------------- | ---------- | ------------- | ----------------------- | --------------- | ------------------------- | ------ |
| 1   | 115  | TouchableOpacity | —                 | `onClose}`       | always     | —             | "signature-modal-close" | (keep)          |
| 2   | 133  | SignatureCapture | Sign here         | `handleSave}`    | always     | —             | "signature-modal-clear" | (keep)          |
| 3   | 145  | TouchableOpacity | Clear             | `handleClear}`   | always     | `saving`      | "signature-modal-clear" | (keep)          |
| 4   | 155  | TouchableOpacity | Confirm Signature | `handleConfirm}` | always     | `saving       |                         | !hasSignature`  | "signature-modal-confirm" | (keep) |

Alerts to assert:

- L44 **Empty Signature** buttons: []
- L89 **Empty Signature** buttons: []

## 6. Move-in inspection and reports

### OwnerInspectionsListScreen — 6 elements, 0 alerts

`src/features/inspections/screens/OwnerInspectionsListScreen.tsx`

| #   | Line | Element          | Label / purpose     | Action                                                               | Shown when                              | Disabled when | testID now                            | Proposed testID |
| --- | ---- | ---------------- | ------------------- | -------------------------------------------------------------------- | --------------------------------------- | ------------- | ------------------------------------- | --------------- |
| 1   | 93   | TouchableOpacity | Inspections         | `() => router.back()}`                                               | always                                  | —             | "owner-inspections-back"              | (keep)          |
| 2   | 101  | TouchableOpacity | —                   | `() => router.push('/(owner)/inspections/new' as any)}`              | always                                  | —             | "owner-inspections-add"               | (keep)          |
| 3   | 118  | TouchableOpacity | —                   | `() => setFilter(f.value)}`                                          | always                                  | —             | {`owner-inspections-filter-${f.value} | (keep)          |
| 4   | 142  | TouchableOpacity | Schedule Inspection | `() => router.push('/(owner)/inspections/new' as any)}`              | always                                  | —             | "owner-inspections-empty-schedule"    | (keep)          |
| 5   | 154  | TouchableOpacity | —                   | `() => router.push(`/(owner)/inspections/${inspection.id}` as any)}` | always                                  | —             | "owner-inspection-card"               | (keep)          |
| 6   | 232  | TouchableOpacity | —                   | `() => router.push('/(owner)/inspections/new' as any)}`              | `{!loading && filtered.length > 0 && (` | —             | "owner-inspections-fab"               | (keep)          |

### OwnerScheduleInspectionScreen — 8 elements, 3 alerts

`src/features/inspections/screens/OwnerScheduleInspectionScreen.tsx`

| #   | Line | Element          | Label / purpose                                  | Action                                | Shown when                                      | Disabled when     | testID now                                  | Proposed testID |
| --- | ---- | ---------------- | ------------------------------------------------ | ------------------------------------- | ----------------------------------------------- | ----------------- | ------------------------------------------- | --------------- | ---------------------------------- | ------ |
| 1   | 201  | TouchableOpacity | Schedule Inspection                              | `() => router.back()}`                | always                                          | —                 | "owner-schedule-inspection-back"            | (keep)          |
| 2   | 217  | TouchableOpacity | —                                                | `() => setSelectedType(t.value)}`     | always                                          | —                 | {`owner-schedule-inspection-type-${t.value} | (keep)          |
| 3   | 247  | TouchableOpacity | —                                                | `() => setSelectedLeaseId(lease.id)}` | always                                          | —                 | "owner-schedule-inspection-lease"           | (keep)          |
| 4   | 274  | TouchableOpacity | —                                                | `() => setShowDatePicker(true)}`      | always                                          | —                 | "owner-schedule-inspection-date"            | (keep)          |
| 5   | 285  | DateTimePicker   | ? 'spinner' : 'default'                          | `handleDateChange}`                   | `{showDatePicker && (`                          | —                 | "owner-schedule-inspection-date-done"       | (keep)          |
| 6   | 294  | TouchableOpacity | Done                                             | `() => setShowDatePicker(false)}`     | `{Platform.OS === 'ios' && showDatePicker && (` | —                 | "owner-schedule-inspection-date-done"       | (keep)          |
| 7   | 305  | TextInput        | Any special instructions or items to focus on... | `setNotes}`                           | always                                          | —                 | "owner-schedule-inspection-notes"           | (keep)          |
| 8   | 326  | TouchableOpacity | Schedule Inspection                              | `handleSubmit}`                       | always                                          | `!selectedLeaseId |                                             | submitting`     | "owner-schedule-inspection-submit" | (keep) |

Alerts to assert:

- L113 **Error** buttons: []
- L126 **Required** buttons: []
- L181 **Error** buttons: []

### InspectionScreen — 31 elements, 10 alerts

`src/features/inspections/screens/InspectionScreen.tsx`

| #   | Line | Element          | Label / purpose                                                  | Action                                                                 | Shown when                                            | Disabled when         | testID now                                | Proposed testID                       |
| --- | ---- | ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- | --------------------- | ----------------------------------------- | ------------------------------------- | ------------------------------- | ------ |
| 1   | 441  | TouchableOpacity | Retry                                                            | `loadInspection}`                                                      | always                                                | —                     | "inspection-retry"                        | (keep)                                |
| 2   | 470  | TouchableOpacity | ? 'Move-In' : 'Move-Out'                                         | `() => router.back()}`                                                 | always                                                | —                     | "inspection-back"                         | (keep)                                |
| 3   | 484  | TouchableOpacity | PDF                                                              | `handleExportReport}`                                                  | `{inspection?.status === 'completed' ? (`             | `exporting`           | "inspection-export-header"                | (keep)                                |
| 4   | 502  | TouchableOpacity | —                                                                | `saveProgress} disabled={saving}>`                                     | `) : readOnly ? (`                                    | `saving`              | "inspection-save"                         | (keep)                                |
| 5   | 534  | TouchableOpacity | —                                                                | `() => setCurrentRoomIndex(idx)}`                                      | always                                                | —                     | {`inspection-room-tab-${idx}              | (keep)                                |
| 6   | 564  | TouchableOpacity | —                                                                | `() => updateRoomCondition(cond.value)}`                               | always                                                | `readOnly`            | {`inspection-room-condition-${cond.value} | (keep)                                |
| 7   | 620  | TouchableOpacity | —                                                                | `() => takePhoto(index)}`                                              | `{!readOnly && (`                                     | —                     | {`inspection-item-${index}                | (keep)                                |
| 8   | 627  | TouchableOpacity | —                                                                | `() => pickImage(index)}`                                              | always                                                | —                     | {`inspection-item-${index}                | (keep)                                |
| 9   | 641  | TouchableOpacity | —                                                                | `() => updateItemCondition(index, cond.value)}`                        | always                                                | `readOnly`            | {`inspection-item-${index}                | (keep)                                |
| 10  | 667  | TextInput        | ? 'No notes' : 'Add notes...'                                    | `(text) => updateItemNotes(index, text)}`                              | always                                                | —                     | {`inspection-item-${index}                | (keep)                                |
| 11  | 697  | TouchableOpacity | Take Photo                                                       | `() => takePhoto()}`                                                   | always                                                | —                     | "inspection-room-take-photo"              | (keep)                                |
| 12  | 707  | TouchableOpacity | Gallery                                                          | `() => pickImage()}`                                                   | always                                                | —                     | "inspection-room-gallery"                 | (keep)                                |
| 13  | 741  | TextInput        | ? 'No notes' : 'Additional notes for this room...'               | `updateRoomNotes}`                                                     | always                                                | —                     | "inspection-room-notes"                   | (keep)                                |
| 14  | 768  | TouchableOpacity | View maintenance request                                         | `() =>`                                                                | `{comment.maintenanceRequestId ? (`                   | —                     | "inspection-comment-view-request"         | (keep)                                |
| 15  | 781  | TouchableOpacity | Raise as maintenance issue                                       | `() => raiseIssue(comment)}`                                           | `) : readOnly ? (`                                    | —                     | "inspection-comment-raise-issue"          | (keep)                                |
| 16  | 794  | TextInput        | Something missing or not right in this room? Describe it here... | `setCommentDraft}`                                                     | `{readOnly && inspection.status !== 'cancelled' && (` | —                     | "inspection-tenant-comment-input"         | (keep)                                |
| 17  | 803  | TouchableOpacity | —                                                                | `() => addComment(currentRoom.name)}`                                  | always                                                | `!commentDraft.trim() |                                           | addingComment`                        | "inspection-tenant-comment-add" | (keep) |
| 18  | 833  | TouchableOpacity | —                                                                | `() =>`                                                                | always                                                | `readOnly`            | "inspection-keys-physical-minus"          | (keep)                                |
| 19  | 844  | TouchableOpacity | Access Cards                                                     | `() => setKeys({ ...keys, physicalKeys: keys.physicalKeys + 1 })}`     | always                                                | `readOnly`            | "inspection-keys-physical-plus"           | (keep)                                |
| 20  | 857  | TouchableOpacity | —                                                                | `() =>`                                                                | always                                                | `readOnly`            | "inspection-keys-cards-minus"             | (keep)                                |
| 21  | 868  | TouchableOpacity | Remote Controls                                                  | `() => setKeys({ ...keys, accessCards: keys.accessCards + 1 })}`       | always                                                | `readOnly`            | "inspection-keys-cards-plus"              | (keep)                                |
| 22  | 881  | TouchableOpacity | —                                                                | `() =>`                                                                | always                                                | `readOnly`            | "inspection-keys-remotes-minus"           | (keep)                                |
| 23  | 892  | TouchableOpacity | —                                                                | `() => setKeys({ ...keys, remoteControls: keys.remoteControls + 1 })}` | always                                                | `readOnly`            | "inspection-keys-remotes-plus"            | (keep)                                |
| 24  | 909  | TextInput        | Overall inspection notes...                                      | `setGeneralNotes}`                                                     | `{isLastRoom && (`                                    | —                     | "inspection-general-notes"                | (keep)                                |
| 25  | 958  | TouchableOpacity | Previous                                                         | `() => setCurrentRoomIndex(safeRoomIndex - 1)}`                        | always                                                | `isFirstRoom`         | "inspection-previous"                     | (keep)                                |
| 26  | 986  | TouchableOpacity | Sign                                                             | `handleSign}`                                                          | always                                                | `saving`              | "inspection-sign"                         | (keep)                                |
| 27  | 1001 | TouchableOpacity | —                                                                | `completeInspection}`                                                  | `) : canComplete ? (`                                 | `saving`              | "inspection-complete"                     | (keep)                                |
| 28  | 1021 | TouchableOpacity | —                                                                | `handleExportReport}`                                                  | `) : inspection?.status === 'completed' ? (`          | `exporting`           | "inspection-export"                       | (keep)                                |
| 29  | 1052 | TouchableOpacity | Next                                                             | `() => setCurrentRoomIndex(safeRoomIndex + 1)}`                        | always                                                | —                     | "inspection-next"                         | (keep)                                |
| 30  | 1064 | SignatureModal   | Sign Inspection Report                                           | `() => setShowSignatureModal(false)}`                                  | always                                                | —                     | -                                         | `inspection-sign-inspection-report`   |
| 31  | 1064 | SignatureModal   | Sign Inspection Report                                           | `handleSignatureSave}`                                                 | always                                                | —                     | -                                         | `inspection-sign-inspection-report-2` |

Alerts to assert:

- L135 **Error** buttons: []
- L226 **Permission Denied** buttons: []
- L268 **Saved** buttons: []
- L272 **Error** buttons: []
- L305 **Success** buttons: ['OK']
- L311 **Error** buttons: []
- L339 **Success** buttons: ['OK']
- L345 **Error** buttons: []
- L362 **Report Saved** buttons: ['View Documents', 'Done']
- L367 **Error** buttons: []

### OwnerInspectionDetailScreen — 6 elements, 3 alerts

`src/features/inspections/screens/OwnerInspectionDetailScreen.tsx`

| #   | Line | Element          | Label / purpose                 | Action                                                      | Shown when                                | Disabled when | testID now                              | Proposed testID |
| --- | ---- | ---------------- | ------------------------------- | ----------------------------------------------------------- | ----------------------------------------- | ------------- | --------------------------------------- | --------------- |
| 1   | 142  | TouchableOpacity | Retry                           | `load}>`                                                    | always                                    | —             | "owner-inspection-retry"                | (keep)          |
| 2   | 159  | TouchableOpacity | —                               | `() => router.back()}`                                      | always                                    | —             | "owner-inspection-back"                 | (keep)          |
| 3   | 175  | TouchableOpacity | —                               | `handleExport}`                                             | `{inspection.status === 'completed' && (` | `exporting`   | "owner-inspection-export-header"        | (keep)          |
| 4   | 284  | TouchableOpacity | ? 'chevron-up' : 'chevron-down' | `() => setExpandedRoom(expandedRoom === idx ? null : idx)}` | always                                    | —             | {`owner-inspection-room-${idx}          | (keep)          |
| 5   | 359  | TouchableOpacity | View maintenance request        | `() =>`                                                     | `{comment.maintenanceRequestId && (`      | —             | "owner-inspection-comment-view-request" | (keep)          |
| 6   | 418  | TouchableOpacity | Export PDF Report               | `handleExport}`                                             | `{inspection.status === 'completed' && (` | `exporting`   | "owner-inspection-export"               | (keep)          |

Alerts to assert:

- L100 **Error** buttons: []
- L115 **Report Saved** buttons: ['View Documents', 'OK']
- L120 **Error** buttons: []

### TenantReportsScreen — 5 elements, 0 alerts

`src/features/tenant/screens/TenantReportsScreen.tsx`

| #   | Line | Element          | Label / purpose | Action                                   | Shown when             | Disabled when | testID now                      | Proposed testID |
| --- | ---- | ---------------- | --------------- | ---------------------------------------- | ---------------------- | ------------- | ------------------------------- | --------------- |
| 1   | 166  | TouchableOpacity | Reports         | `() => router.back()}`                   | always                 | —             | "tenant-reports-back"           | (keep)          |
| 2   | 202  | TouchableOpacity | —               | `() => navigateToVerification(closure)}` | always                 | —             | "tenant-report-closure-row"     | (keep)          |
| 3   | 242  | TouchableOpacity | —               | `() =>`                                  | always                 | —             | "tenant-report-work-order-row"  | (keep)          |
| 4   | 306  | TouchableOpacity | —               | `navigateToInspection}`                  | always                 | —             | "tenant-report-inspection-row"  | (keep)          |
| 5   | 351  | TouchableOpacity | —               | `navigateToInspection}`                  | `{needsSignature && (` | —             | "tenant-report-inspection-sign" | (keep)          |

## 7. Fixing inspection issues (maintenance)

### TenantMaintenanceReportScreen — 17 elements, 9 alerts

`src/features/tenant/screens/TenantMaintenanceReportScreen.tsx`

| #   | Line | Element          | Label / purpose                                                                                            | Action                           | Shown when             | Disabled when | testID now                                                                 | Proposed testID |
| --- | ---- | ---------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------- | ---------------------- | ------------- | -------------------------------------------------------------------------- | --------------- |
| 1   | 258  | TouchableOpacity | Report Issue                                                                                               | `() => router.back()}`           | always                 | —             | "maintenance-report-back"                                                  | (keep)          |
| 2   | 280  | TouchableOpacity | Report Issue                                                                                               | `() => router.back()}`           | always                 | —             | "maintenance-report-back"                                                  | (keep)          |
| 3   | 296  | TouchableOpacity | Go Back                                                                                                    | `() => router.back()}`           | always                 | —             | "maintenance-report-go-back"                                               | (keep)          |
| 4   | 314  | TouchableOpacity | Report Issue                                                                                               | `() => router.back()}`           | always                 | —             | "maintenance-report-back"                                                  | (keep)          |
| 5   | 351  | TouchableOpacity | ? 'radio-button-on' : 'radio-button-off'                                                                   | `() => {`                        | always                 | —             | "maintenance-report-lease"                                                 | (keep)          |
| 6   | 445  | TouchableOpacity | —                                                                                                          | `() => {`                        | always                 | —             | "maintenance-report-service-item"                                          | (keep)          |
| 7   | 481  | TouchableOpacity | ? 'radio-button-on' : 'radio-button-off'                                                                   | `() => {`                        | always                 | —             | "maintenance-report-service-item-other"                                    | (keep)          |
| 8   | 512  | TextInput        | e.g., Leaking faucet in kitchen                                                                            | `setTitle}`                      | always                 | —             | "maintenance-title-input"                                                  | (keep)          |
| 9   | 529  | TextInput        | Describe the issue in detail... Include when you first noticed it, what's happening, and how urgent it is. | `setDescription}`                | always                 | —             | "maintenance-description-input"                                            | (keep)          |
| 10  | 562  | TouchableOpacity | —                                                                                                          | `() => {`                        | always                 | —             | {`maintenance-priority-${item.value}                                       | (keep)          |
| 11  | 600  | TouchableOpacity | —                                                                                                          | `() => {`                        | always                 | —             | {`maintenance-category-${category.name.toLowerCase().replace(/\s+/g, '-')} | (keep)          |
| 12  | 627  | TouchableOpacity | —                                                                                                          | `() => {`                        | always                 | —             | "tenant-choose-vendor"                                                     | (keep)          |
| 13  | 659  | TouchableOpacity | Clear selected vendor                                                                                      | `() => setSelectedVendor(null)}` | `{selectedVendor && (` | —             | "maintenance-report-clear-vendor"                                          | (keep)          |
| 14  | 683  | TouchableOpacity | —                                                                                                          | `() => {`                        | always                 | —             | "maintenance-report-remove-media"                                          | (keep)          |
| 15  | 700  | TouchableOpacity | Camera                                                                                                     | `takePhoto}`                     | `{canAddMore && (`     | —             | "maintenance-add-camera"                                                   | (keep)          |
| 16  | 708  | TouchableOpacity | Gallery                                                                                                    | `pickMedia}>`                    | always                 | —             | "maintenance-submit"                                                       | (keep)          |
| 17  | 720  | TouchableOpacity | Submit Request                                                                                             | `handleSubmit}`                  | always                 | `submitting`  | "maintenance-submit"                                                       | (keep)          |

Alerts to assert:

- L129 **Error** buttons: []
- L161 **Required** buttons: []
- L165 **Too Short** buttons: []
- L169 **Required** buttons: []
- L173 **Too Short** buttons: []
- L177 **Required** buttons: []
- L183 **Error** buttons: []
- L187 **Error** buttons: []
- L246 **Error** buttons: []

### TenantMaintenanceListScreen — 7 elements, 3 alerts

`src/features/tenant/screens/TenantMaintenanceListScreen.tsx`

| #   | Line | Element          | Label / purpose | Action                                                | Shown when                     | Disabled when | testID now                       | Proposed testID                             |
| --- | ---- | ---------------- | --------------- | ----------------------------------------------------- | ------------------------------ | ------------- | -------------------------------- | ------------------------------------------- |
| 1   | 183  | AnimatedButton   | Retry           | `onRefresh}>`                                         | always                         | —             | -                                | `tenantmaintenancelist-retry`               |
| 2   | 205  | AnimatedButton   | —               | `handleReportIssue} testID="maintenance-report-fab">` | always                         | —             | "maintenance-report-fab"         | (keep)                                      |
| 3   | 224  | RefreshControl   | —               | `onRefresh} tintColor="#002395" />`                   | always                         | —             | -                                | `tenantmaintenancelist-onrefresh-tintcolor` |
| 4   | 248  | AnimatedButton   | Report an Issue | `handleReportIssue} testID="maintenance-report-cta">` | `{activeFilter === 'all' && (` | —             | "maintenance-report-cta"         | (keep)                                      |
| 5   | 262  | AnimatedButton   | —               | `() => handleCardPress(request.id)}`                  | always                         | —             | {`maintenance-card-${request.id} | (keep)                                      |
| 6   | 262  | AnimatedButton   | —               | `() => handleCardLongPress(request)}`                 | always                         | —             | {`maintenance-card-${request.id} | (keep)                                      |
| 7   | 327  | TouchableOpacity | Chat with Owner | `() => handleMessageLandlord(request)}`               | always                         | —             | "tenant-maintenance-chat-owner"  | (keep)                                      |

Alerts to assert:

- L86 **Error** buttons: []
- L130 **Unavailable** buttons: []
- L144 **Error** buttons: []

### TenantMaintenanceDetailScreen — 10 elements, 4 alerts

`src/features/tenant/screens/TenantMaintenanceDetailScreen.tsx`

| #   | Line | Element          | Label / purpose        | Action                   | Shown when                                                               | Disabled when               | testID now                                             | Proposed testID |
| --- | ---- | ---------------- | ---------------------- | ------------------------ | ------------------------------------------------------------------------ | --------------------------- | ------------------------------------------------------ | --------------- |
| 1   | 168  | TouchableOpacity | Maintenance Request    | `() => router.back()}`   | always                                                                   | —                           | "tenant-maintenance-detail-back"                       | (keep)          |
| 2   | 190  | TouchableOpacity | Maintenance Request    | `() => router.back()}`   | always                                                                   | —                           | "tenant-maintenance-detail-back"                       | (keep)          |
| 3   | 203  | TouchableOpacity | Go Back                | `() => router.back()}`   | always                                                                   | —                           | "tenant-maintenance-detail-go-back"                    | (keep)          |
| 4   | 223  | TouchableOpacity | Request Details        | `() => router.back()}`   | always                                                                   | —                           | "tenant-maintenance-detail-back"                       | (keep)          |
| 5   | 293  | TouchableOpacity | Find a vendor          | `() => {`                | `{['open', 'assigned', 'in_progress'].includes(String(request.status)) ` | —                           | "tenant-find-vendor"                                   | (keep)          |
| 6   | 335  | TouchableOpacity | —                      | `async () => {`          | `{q.status === 'submitted' && user?.id ? (`                              | `acceptingQuoteId === q.id` | "tenant-accept-quote"                                  | (keep)          |
| 7   | 370  | TouchableOpacity | —                      | `() => {`                | `{closureReport?.tenant_verification_status === 'pending_tenant' && (`   | —                           | {TENANT_MAINTENANCE_DETAIL_TEST_IDS.verifyWorkCta}     | (keep)          |
| 8   | 405  | TouchableOpacity | Confirm Completed Work | `() => {`                | `closureReport?.tenant_verification_status !== 'pending_tenant' && (`    | —                           | {TENANT_MAINTENANCE_DETAIL_TEST_IDS.closureConfirmCta} | (keep)          |
| 9   | 481  | TouchableOpacity | Review Invoice         | `() => {`                | `{tenantInvoices.length > 0 && (`                                        | —                           | "tenant-invoice-review"                                | (keep)          |
| 10  | 504  | TouchableOpacity | —                      | `handleMessageLandlord}` | always                                                                   | `openingMessages`           | "tenant-maintenance-detail-message-owner"              | (keep)          |

Alerts to assert:

- L125 **Error** buttons: []
- L133 **Unavailable** buttons: []
- L148 **Error** buttons: []
- L350 **Could not accept quote** buttons: []

### TenantClosureConfirmScreen — 9 elements, 3 alerts

`src/features/tenant/screens/TenantClosureConfirmScreen.tsx`

| #   | Line | Element          | Label / purpose                               | Action                                              | Shown when         | Disabled when  | testID now                         | Proposed testID |
| --- | ---- | ---------------- | --------------------------------------------- | --------------------------------------------------- | ------------------ | -------------- | ---------------------------------- | --------------- | --------------------------------- | ------ |
| 1   | 120  | TouchableOpacity | Confirm Closure                               | `() => router.back()} style={styles.headerButton}>` | always             | —              | {CLOSURE_CONFIRM_TEST_IDS.title}   | (keep)          |
| 2   | 140  | TouchableOpacity | Confirm Closure                               | `() => router.back()}`                              | always             | —              | "closure-confirm-back"             | (keep)          |
| 3   | 155  | TouchableOpacity | Go Back                                       | `() => router.back()}`                              | always             | —              | "closure-confirm-go-back"          | (keep)          |
| 4   | 171  | TouchableOpacity | Confirming completed work                     | `() => router.back()} style={styles.headerButton}>` | always             | —              | {CLOSURE_CONFIRM_TEST_IDS.title}   | (keep)          |
| 5   | 247  | TouchableOpacity | —                                             | `() => removeFile(file.uri)}`                       | always             | —              | "closure-confirm-remove-photo"     | (keep)          |
| 6   | 261  | TouchableOpacity | Camera                                        | `takePhoto}`                                        | `{canAddMore && (` | —              | {CLOSURE_CONFIRM_TEST_IDS.camera}  | (keep)          |
| 7   | 269  | TouchableOpacity | Gallery                                       | `pickMedia}`                                        | always             | —              | {CLOSURE_CONFIRM_TEST_IDS.gallery} | (keep)          |
| 8   | 284  | TextInput        | e.g. Work looks great, everything is fixed... | `setNotes}`                                         | always             | —              | {CLOSURE_CONFIRM_TEST_IDS.notes}   | (keep)          |
| 9   | 303  | TouchableOpacity | —                                             | `handleSubmit}`                                     | always             | `!hasMinPhotos |                                    | submitting`     | {CLOSURE_CONFIRM_TEST_IDS.submit} | (keep) |

Alerts to assert:

- L72 **Error** buttons: []
- L88 **Error** buttons: []
- L108 **Error** buttons: []

### TenantVerificationScreen — 12 elements, 8 alerts

`src/features/tenant/screens/TenantVerificationScreen.tsx`

| #   | Line | Element          | Label / purpose                                                          | Action                                       | Shown when | Disabled when  | testID now                           | Proposed testID |
| --- | ---- | ---------------- | ------------------------------------------------------------------------ | -------------------------------------------- | ---------- | -------------- | ------------------------------------ | --------------- |
| 1   | 289  | TouchableOpacity | Work is Satisfactory                                                     | `() => setMode('approve')}`                  | always     | —              | "tenant-verify-satisfactory"         | (keep)          |
| 2   | 298  | TouchableOpacity | Work Needs Fixes                                                         | `() => setMode('reject')}`                   | always     | —              | "tenant-verify-needs-fixes"          | (keep)          |
| 3   | 316  | TouchableOpacity | Approve Work                                                             | `() => setMode('select')}`                   | always     | —              | "tenant-verify-approve-back"         | (keep)          |
| 4   | 337  | TextInput        | E.g., Work completed quickly and professionally...                       | `setNotes}`                                  | always     | —              | "tenant-verify-approve-notes"        | (keep)          |
| 5   | 363  | TouchableOpacity | —                                                                        | `() => handleRemovePhoto('approve', index)}` | always     | —              | "tenant-verify-approve-remove-photo" | (keep)          |
| 6   | 375  | TouchableOpacity | ? 'Add More Photos' : 'Upload After Photos'                              | `() => handlePickImage('approve')}`          | always     | —              | "tenant-verify-approve-add-photo"    | (keep)          |
| 7   | 388  | TouchableOpacity | Confirm - Work is Complete                                               | `handleApprove}`                             | always     | `isSubmitting` | "tenant-verify-approve-submit"       | (keep)          |
| 8   | 413  | TouchableOpacity | Report Issues                                                            | `() => setMode('select')}`                   | always     | —              | "tenant-verify-reject-back"          | (keep)          |
| 9   | 443  | TextInput        | E.g., Leak is still present under the sink, water damage not repaired... | `setRejectionReason}`                        | always     | —              | "tenant-verify-reject-reason"        | (keep)          |
| 10  | 469  | TouchableOpacity | —                                                                        | `() => handleRemovePhoto('reject', index)}`  | always     | —              | "tenant-verify-reject-remove-photo"  | (keep)          |
| 11  | 481  | TouchableOpacity | ? 'Add More Photos' : 'Take / Upload Photo'                              | `() => handlePickImage('reject')}`           | always     | —              | "tenant-verify-reject-add-photo"     | (keep)          |
| 12  | 494  | TouchableOpacity | Submit Issues for Vendor                                                 | `handleReject}`                              | always     | `isSubmitting` | "tenant-verify-reject-submit"        | (keep)          |

Alerts to assert:

- L83 **Permission Required** buttons: []
- L114 **Error** buttons: []
- L161 **Error** buttons: []
- L169 **Error** buttons: []
- L175 **Required** buttons: []
- L180 **Required** buttons: []
- L200 **Upload Error** buttons: []
- L235 **Error** buttons: []

### OwnerMaintenanceListScreen — 7 elements, 1 alerts

`src/features/owner/screens/OwnerMaintenanceListScreen.tsx`

| #   | Line | Element          | Label / purpose | Action                                | Shown when | Disabled when | testID now               | Proposed testID                            |
| --- | ---- | ---------------- | --------------- | ------------------------------------- | ---------- | ------------- | ------------------------ | ------------------------------------------ |
| 1   | 141  | AnimatedButton   | Retry           | `onRefresh}>`                         | always     | —             | -                        | `ownermaintenancelist-retry`               |
| 2   | 166  | TouchableOpacity | Find a vendor   | `() => {`                             | always     | —             | "owner-find-vendor"      | (keep)                                     |
| 3   | 178  | AnimatedButton   | —               | `() => {`                             | always     | —             | -                        | `ownermaintenancelist-onpress`             |
| 4   | 212  | RefreshControl   | —               | `onRefresh} tintColor="#002395" />`   | always     | —             | -                        | `ownermaintenancelist-onrefresh-tintcolor` |
| 5   | 232  | AnimatedButton   | —               | `() => {`                             | always     | —             | "awaiting-dispatch-card" | (keep)                                     |
| 6   | 269  | AnimatedButton   | —               | `() => {`                             | always     | —             | "maintenance-card"       | (keep)                                     |
| 7   | 269  | AnimatedButton   | —               | `() => handleCardLongPress(request)}` | always     | —             | "maintenance-card"       | (keep)                                     |

Alerts to assert:

- L100 **Error** buttons: []

### OwnerMaintenanceDetailScreen — 17 elements, 21 alerts

`src/features/owner/screens/OwnerMaintenanceDetailScreen.tsx`

| #   | Line | Element           | Label / purpose                 | Action                                                               | Shown when                                                   | Disabled when   | testID now                                   | Proposed testID                            |
| --- | ---- | ----------------- | ------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------ | --------------- | -------------------------------------------- | ------------------------------------------ |
| 1   | 540  | TouchableOpacity  | Go Back                         | `() => router.back()}`                                               | always                                                       | —               | "owner-maintenance-detail-go-back"           | (keep)                                     |
| 2   | 574  | TouchableOpacity  | —                               | `() => {`                                                            | always                                                       | —               | "owner-maintenance-detail-back"              | (keep)                                     |
| 3   | 590  | TouchableOpacity  | —                               | `() => {`                                                            | always                                                       | —               | "owner-maintenance-detail-actions"           | (keep)                                     |
| 4   | 656  | TouchableOpacity  | —                               | `() => {`                                                            | always                                                       | —               | "owner-maintenance-detail-chat-tenant"       | (keep)                                     |
| 5   | 704  | TouchableOpacity  | View vendor progress updates    | `() => router.push(`/(owner)/maintenance/${id}/progress-timeline`)}` | `{request.status === 'in_progress' && (`                     | —               | "owner-maintenance-detail-progress"          | (keep)                                     |
| 6   | 728  | RequestPOSection  | —                               | `() =>`                                                              | always                                                       | —               | "owner-maintenance-detail-review-closure"    | (keep)                                     |
| 7   | 740  | TouchableOpacity  | Review closure report in detail | `() => router.push(`/(owner)/maintenance/${id}/review-closure`)}`    | `{closureReport && closureReport.status === 'pending' && (`  | —               | "owner-maintenance-detail-review-closure"    | (keep)                                     |
| 8   | 845  | TouchableOpacity  | View invoice details            | `() => {`                                                            | always                                                       | —               | "owner-view-invoice"                         | (keep)                                     |
| 9   | 881  | TouchableOpacity  | View work order report          | `() => Linking.openURL(request.work_order_report_url)}`              | always                                                       | —               | "owner-maintenance-detail-work-order"        | (keep)                                     |
| 10  | 920  | TouchableOpacity  | Acknowledge Request             | `handleAcknowledge}`                                                 | always                                                       | `actionLoading` | "owner-maintenance-detail-acknowledge"       | (keep)                                     |
| 11  | 938  | TouchableOpacity  | Push to Vendors                 | `handlePushToVendors}`                                               | `{canPushToVendors && (`                                     | `actionLoading` | "owner-maintenance-detail-push-vendors"      | (keep)                                     |
| 12  | 953  | TouchableOpacity  | Send to Dedicated Vendors       | `handleSendToDedicatedVendors}`                                      | `⚠️ No quotes received yet. Send to your dedicated vendors?` | `actionLoading` | "owner-maintenance-detail-dedicated-vendors" | (keep)                                     |
| 13  | 976  | TouchableOpacity  | Assign Vendor                   | `handlePushToVendors}`                                               | always                                                       | `actionLoading` | "owner-maintenance-detail-assign-vendor"     | (keep)                                     |
| 14  | 985  | TouchableOpacity  | Release to Tenant               | `handleReleaseToTenant}`                                             | always                                                       | `actionLoading` | "owner-maintenance-detail-release-tenant"    | (keep)                                     |
| 15  | 1004 | TouchableOpacity  | Reclaim Request                 | `() => setReclaimModalVisible(true)}`                                | always                                                       | `actionLoading` | "owner-maintenance-detail-reclaim"           | (keep)                                     |
| 16  | 1019 | ReasonPromptModal | Request Revision                | `handleRequestRevision}`                                             | always                                                       | —               | -                                            | `ownermaintenancedetail-request-revision`  |
| 17  | 1031 | ReasonPromptModal | Reclaim Request                 | `handleReclaimRequest}`                                              | always                                                       | —               | -                                            | `ownermaintenancedetail-reclaim-request-2` |

Alerts to assert:

- L174 **Error** buttons: []
- L188 **Success** buttons: []
- L192 **Error** buttons: ['Cancel', 'Select Specific Vendors']
- L199 **Push to Vendors** buttons: ['Cancel', 'Select Specific Vendors', 'Open Market', 'Dedicated Vendors']
- L231 **Error** buttons: ['Cancel']
- L260 **Error** buttons: []
- L271 **Close Request** buttons: ['Cancel', 'Close']
- L290 **Error** buttons: []
- L364 **Error** buttons: []
- L395 **Success** buttons: []
- L399 **Error** buttons: []
- L422 **Success** buttons: []
- L427 **Error** buttons: []
- L454 **Released** buttons: []
- L458 **Error** buttons: []
- L475 **Reclaimed** buttons: []
- L479 **Error** buttons: ['Cancel']
- L509 **Deleted** buttons: []
- L513 **Error** buttons: []
- L593 **Actions** buttons: ['Close Request', 'Delete Request', 'Cancel']
- L663 **No Tenant** buttons: []

### VendorSelectionScreen — 10 elements, 11 alerts

`src/features/owner/screens/VendorSelectionScreen.tsx`

| #   | Line | Element             | Label / purpose                      | Action                          | Shown when                     | Disabled when | testID now                       | Proposed testID           |
| --- | ---- | ------------------- | ------------------------------------ | ------------------------------- | ------------------------------ | ------------- | -------------------------------- | ------------------------- | ------------------------- | ------ |
| 1   | 298  | VendorDirectoryCard | —                                    | `() => {`                       | always                         | —             | -                                | `vendorselection-onpress` |
| 2   | 355  | TouchableOpacity    | Go back                              | `() => router.back()}`          | always                         | —             | "vendor-selection-back"          | (keep)                    |
| 3   | 374  | TouchableOpacity    | Browse vendors tab                   | `() => setActiveTab('browse')}` | always                         | —             | "vendor-selection-tab-browse"    | (keep)                    |
| 4   | 390  | TouchableOpacity    | Invite by email tab                  | `() => setActiveTab('invite')}` | always                         | —             | "vendor-selection-tab-invite"    | (keep)                    |
| 5   | 413  | TextInput           | Search by name, trade or city...     | `setSearchQuery}`               | always                         | —             | "vendor-selection-search"        | (keep)                    |
| 6   | 424  | TouchableOpacity    | —                                    | `() => setSearchQuery('')}`     | `{searchQuery.length > 0 && (` | —             | "vendor-selection-search-clear"  | (keep)                    |
| 7   | 474  | TextInput           | vendor@example.com                   | `(text) => {`                   | always                         | —             | "vendor-selection-invite-email"  | (keep)                    |
| 8   | 488  | TouchableOpacity    | Search vendor by email               | `handleSearchVendorByEmail}`    | always                         | `inviting`    | "vendor-selection-invite-search" | (keep)                    |
| 9   | 547  | TouchableOpacity    | Push request to open market          | `handlePushToOpenMarket}`       | always                         | `submitting`  | "vendor-selection-open-market"   | (keep)                    |
| 10  | 572  | TouchableOpacity    | Send invitations to selected vendors | `handleSubmit}`                 | always                         | `submitting   |                                  | selectedIds.size === 0`   | "vendor-selection-submit" | (keep) |

Alerts to assert:

- L127 **Error** buttons: []
- L155 **Enter Email** buttons: []
- L160 **Invalid Email** buttons: []
- L193 **Already a vendor** buttons: []
- L197 **Invitation Sent** buttons: []
- L201 **Error** buttons: []
- L210 **Error** buttons: []
- L218 **No Vendors Selected** buttons: ['Cancel', 'Send to Vendors']
- L254 **Error** buttons: []
- L278 **Success** buttons: ['OK']
- L283 **Error** buttons: []

### OwnerQuoteDetailScreen — 7 elements, 7 alerts

`src/features/owner/screens/OwnerQuoteDetailScreen.tsx`

| #   | Line | Element           | Label / purpose   | Action                                    | Shown when            | Disabled when   | testID now                     | Proposed testID                     |
| --- | ---- | ----------------- | ----------------- | ----------------------------------------- | --------------------- | --------------- | ------------------------------ | ----------------------------------- |
| 1   | 212  | TouchableOpacity  | Go Back           | `() => router.back()}`                    | always                | —               | "owner-quote-go-back"          | (keep)                              |
| 2   | 232  | TouchableOpacity  | Quote Details     | `() => router.back()}`                    | always                | —               | "owner-quote-back"             | (keep)                              |
| 3   | 279  | TouchableOpacity  | ? 'Hide' : 'Show' | `() => setShowRevisions(!showRevisions)}` | `{hasRevisions && (`  | —               | "owner-quote-revisions-toggle" | (keep)                              |
| 4   | 483  | TouchableOpacity  | Reject            | `handleRejectQuote}`                      | `{canTakeAction && (` | `actionLoading` | "owner-quote-reject"           | (keep)                              |
| 5   | 499  | TouchableOpacity  | Request Changes   | `() => setShowRevisionModal(true)}`       | always                | `actionLoading` | "owner-quote-request-changes"  | (keep)                              |
| 6   | 509  | TouchableOpacity  | Accept            | `handleAcceptQuote}`                      | always                | `actionLoading` | "owner-quote-accept"           | (keep)                              |
| 7   | 529  | ReasonPromptModal | Request Revision  | `handleRequestRevision}`                  | always                | —               | -                              | `ownerquotedetail-request-revision` |

Alerts to assert:

- L82 **Error** buttons: ['Cancel']
- L110 **Success** buttons: ['OK']
- L121 **Error** buttons: []
- L152 **Success** buttons: ['OK']
- L162 **Error** buttons: []
- L184 **Success** buttons: []
- L189 **Error** buttons: []

### OwnerSendPOScreen — 8 elements, 6 alerts

`src/features/owner/screens/OwnerSendPOScreen.tsx`

| #   | Line | Element          | Label / purpose                           | Action                           | Shown when             | Disabled when  | testID now                   | Proposed testID                |
| --- | ---- | ---------------- | ----------------------------------------- | -------------------------------- | ---------------------- | -------------- | ---------------------------- | ------------------------------ |
| 1   | 140  | TouchableOpacity | Go back                                   | `() => router.back()}`           | always                 | —              | "owner-send-po-back"         | (keep)                         |
| 2   | 193  | TouchableOpacity | ? 'spinner' : 'default'                   | `() => setShowDatePicker(true)}` | always                 | —              | "owner-send-po-date"         | (keep)                         |
| 3   | 203  | DateTimePicker   | ? 'spinner' : 'default'                   | `handleDateChange}`              | `{showDatePicker && (` | —              | "owner-send-po-time"         | (keep)                         |
| 4   | 215  | TouchableOpacity | ? 'spinner' : 'default'                   | `() => setShowTimePicker(true)}` | always                 | —              | "owner-send-po-time"         | (keep)                         |
| 5   | 225  | DateTimePicker   | ? 'spinner' : 'default'                   | `handleTimeChange}`              | `{showTimePicker && (` | —              | -                            | `ownersendpo-handletimechange` |
| 6   | 241  | TextInput        | Enter work instructions for the vendor... | `setWorkInstructions}`           | always                 | —              | "owner-send-po-instructions" | (keep)                         |
| 7   | 255  | TouchableOpacity | ? 'Sending...' : 'Send Purchase Order'    | `handleSendPO}`                  | always                 | `isSubmitting` | "owner-send-po-send"         | (keep)                         |
| 8   | 267  | TouchableOpacity | Cancel                                    | `() => router.back()}`           | always                 | —              | "owner-send-po-cancel"       | (keep)                         |

Alerts to assert:

- L56 **Error** buttons: []
- L94 **Error** buttons: []
- L100 **Required** buttons: []
- L105 **Invalid Date** buttons: []
- L118 **Success** buttons: ['OK']
- L130 **Error** buttons: []

### OwnerClosureApprovalScreen — 8 elements, 7 alerts

`src/features/owner/screens/OwnerClosureApprovalScreen.tsx`

| #   | Line | Element          | Label / purpose                            | Action                                                                 | Shown when                                                               | Disabled when          | testID now               | Proposed testID |
| --- | ---- | ---------------- | ------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------- | ------------------------ | --------------- |
| 1   | 209  | TouchableOpacity | Go back                                    | `() => router.back()}`                                                 | always                                                                   | —                      | "closure-review-title"   | (keep)          |
| 2   | 230  | TouchableOpacity | Job in mediation                           | `() => router.push(`/(owner)/maintenance/mediation?requestId=${id}`)}` | `{closureReport?.mediation_required ? (`                                 | —                      | "owner-open-mediation"   | (keep)          |
| 3   | 370  | TouchableOpacity | Request changes from vendor                | `handleReject}`                                                        | `{closureReport?.status === 'pending' ? (`                               | `actionLoading`        | "closure-reject-button"  | (keep)          |
| 4   | 382  | TouchableOpacity | Approve and complete job                   | `handleApprove}`                                                       | always                                                                   | `actionLoading`        | "closure-approve-button" | (keep)          |
| 5   | 403  | TouchableOpacity | Forward closure to tenant for verification | `handleForwardToTenant}`                                               | `) : isClosureApproved && hasTenant && !isTenantVerificationPending && ` | `forwardingToTenant`   | "closure-forward-button" | (keep)          |
| 6   | 456  | TextInput        | Describe what needs to change...           | `setRejectReason}`                                                     | always                                                                   | —                      | "closure-reject-reason"  | (keep)          |
| 7   | 470  | TouchableOpacity | Cancel                                     | `() => setShowRejectModal(false)}`                                     | always                                                                   | `!rejectReason.trim()` | "closure-reject-cancel"  | (keep)          |
| 8   | 477  | TouchableOpacity | Send Request                               | `submitRejection}`                                                     | always                                                                   | `!rejectReason.trim()` | "closure-reject-send"    | (keep)          |

Alerts to assert:

- L83 **Error** buttons: ['Cancel']
- L106 **Approved** buttons: ['OK']
- L110 **Error** buttons: []
- L150 **Error** buttons: []
- L163 **Reason Required** buttons: []
- L176 **Changes Requested** buttons: ['OK']
- L181 **Error** buttons: []
