import { DOCUMENT_CATEGORIES, DocumentType } from '../types';

describe('documentsApi', () => {
  describe('DOCUMENT_CATEGORIES', () => {
    it('should have all required document types', () => {
      const expectedTypes: DocumentType[] = [
        'id_document',
        'proof_of_income',
        'bank_statement',
        'employment_letter',
        'reference_letter',
        'lease_agreement',
        'inspection_report',
        'payment_receipt',
        'utility_bill',
        'tax_certificate',
        'police_clearance',
        'other',
      ];

      expectedTypes.forEach((type) => {
        expect(DOCUMENT_CATEGORIES[type]).toBeDefined();
        expect(DOCUMENT_CATEGORIES[type].type).toBe(type);
        expect(DOCUMENT_CATEGORIES[type].label).toBeTruthy();
        expect(DOCUMENT_CATEGORIES[type].maxSize).toBeGreaterThan(0);
        expect(DOCUMENT_CATEGORIES[type].retentionYears).toBeGreaterThan(0);
      });
    });

    it('should have correct retention periods for critical documents', () => {
      expect(DOCUMENT_CATEGORIES.lease_agreement.retentionYears).toBe(10);
      expect(DOCUMENT_CATEGORIES.inspection_report.retentionYears).toBe(10);
      expect(DOCUMENT_CATEGORIES.id_document.retentionYears).toBe(7);
      expect(DOCUMENT_CATEGORIES.tax_certificate.retentionYears).toBe(7);
    });

    it('should have reasonable max file sizes', () => {
      expect(DOCUMENT_CATEGORIES.lease_agreement.maxSize).toBe(20);
      expect(DOCUMENT_CATEGORIES.inspection_report.maxSize).toBe(20);
      expect(DOCUMENT_CATEGORIES.id_document.maxSize).toBe(10);
      expect(DOCUMENT_CATEGORIES.employment_letter.maxSize).toBe(5);
    });

    it('should accept correct file types', () => {
      // Lease agreements should only accept PDF
      expect(DOCUMENT_CATEGORIES.lease_agreement.acceptedTypes).toContain('application/pdf');

      // ID documents should accept images and PDFs
      expect(DOCUMENT_CATEGORIES.id_document.acceptedTypes).toContain('image/*');
      expect(DOCUMENT_CATEGORIES.id_document.acceptedTypes).toContain('application/pdf');
    });

    it('should have valid icons for all categories', () => {
      Object.values(DOCUMENT_CATEGORIES).forEach((category) => {
        expect(category.icon).toBeTruthy();
        expect(typeof category.icon).toBe('string');
      });
    });

    it('should have descriptions for all categories', () => {
      Object.values(DOCUMENT_CATEGORIES).forEach((category) => {
        expect(category.description).toBeTruthy();
        expect(category.description.length).toBeGreaterThan(10);
      });
    });
  });
});
