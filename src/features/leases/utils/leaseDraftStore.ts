// Module-level store: holds the in-flight lease draft while the owner
// navigates create → review → (back to create).
// Cleared by the review screen after a successful insert.

export interface LeaseDraft {
  applicationId: string;
  startDate: string;
  endDate: string;
  leaseType: 'fixed' | 'month_to_month';
  monthlyRent: string;
  depositAmount: string;
  paymentDueDay: string;
  lateFeeAmount: string;
  lateFeeGraceDays: string;
  rentEscalationType: 'percentage' | 'fixed_amount';
  rentEscalationValue: string;
  rentEscalationFrequency: string;
  // Populated after the owner types in the review screen.
  customClauses: string;
  // Pre-generated UUID so the HTML preview shows a real ID.
  draftLeaseId: string;
}

let _draft: LeaseDraft | null = null;

export const leaseDraftStore = {
  set(draft: LeaseDraft) {
    _draft = draft;
  },
  get(): LeaseDraft | null {
    return _draft;
  },
  clear() {
    _draft = null;
  },
};
