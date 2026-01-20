import type { Database } from '../../../types/database.types';

// Base types from database
export type Document = Database['public']['Tables']['documents']['Row'];
export type DocumentInsert = Database['public']['Tables']['documents']['Insert'];
export type DocumentUpdate = Database['public']['Tables']['documents']['Update'];

// Document type enum
export type DocumentType =
  | 'id_document'
  | 'proof_of_income'
  | 'bank_statement'
  | 'employment_letter'
  | 'reference_letter'
  | 'lease_agreement'
  | 'inspection_report'
  | 'payment_receipt'
  | 'utility_bill'
  | 'tax_certificate'
  | 'police_clearance'
  | 'other';

// Access level enum
export type AccessLevel = 'owner_only' | 'tenant_only' | 'both' | 'admin_only';

// Extended document with relations
export interface DocumentWithRelations extends Document {
  property?: {
    id: string;
    title: string;
  };
  lease?: {
    id: string;
    start_date: string;
    end_date: string;
  };
  owner?: {
    id: string;
    full_name: string;
  };
  tenant?: {
    id: string;
    full_name: string;
  };
  uploader?: {
    id: string;
    full_name: string;
  };
}

// Upload document input
export interface UploadDocumentInput {
  type: DocumentType;
  title: string;
  description?: string;
  access_level: AccessLevel;
  property_id?: string;
  lease_id?: string;
  tenant_id?: string;
  owner_id?: string;
  retention_period_years?: number;
  tags?: string[];
}

// Document filter
export interface DocumentFilter {
  type?: DocumentType | 'all';
  property_id?: string;
  lease_id?: string;
  uploaded_after?: string;
  uploaded_before?: string;
  tags?: string[];
}

// Document category for display
export interface DocumentCategory {
  type: DocumentType;
  label: string;
  icon: string;
  description: string;
  maxSize: number; // MB
  acceptedTypes: string[];
  retentionYears: number;
}

// Document categories configuration
export const DOCUMENT_CATEGORIES: Record<DocumentType, DocumentCategory> = {
  id_document: {
    type: 'id_document',
    label: 'ID Document',
    icon: 'card',
    description: 'South African ID or Passport',
    maxSize: 10,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 7,
  },
  proof_of_income: {
    type: 'proof_of_income',
    label: 'Proof of Income',
    icon: 'cash',
    description: 'Payslip, bank statements, or tax returns',
    maxSize: 10,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 5,
  },
  bank_statement: {
    type: 'bank_statement',
    label: 'Bank Statement',
    icon: 'document-text',
    description: 'Recent bank statements (3 months)',
    maxSize: 10,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 5,
  },
  employment_letter: {
    type: 'employment_letter',
    label: 'Employment Letter',
    icon: 'briefcase',
    description: 'Letter from employer confirming employment',
    maxSize: 5,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 5,
  },
  reference_letter: {
    type: 'reference_letter',
    label: 'Reference Letter',
    icon: 'people',
    description: 'Reference from previous landlord or employer',
    maxSize: 5,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 5,
  },
  lease_agreement: {
    type: 'lease_agreement',
    label: 'Lease Agreement',
    icon: 'document-attach',
    description: 'Signed lease agreement document',
    maxSize: 20,
    acceptedTypes: ['application/pdf'],
    retentionYears: 10,
  },
  inspection_report: {
    type: 'inspection_report',
    label: 'Inspection Report',
    icon: 'clipboard',
    description: 'Move-in/Move-out inspection report',
    maxSize: 20,
    acceptedTypes: ['application/pdf'],
    retentionYears: 10,
  },
  payment_receipt: {
    type: 'payment_receipt',
    label: 'Payment Receipt',
    icon: 'receipt',
    description: 'Rent payment receipt or proof of payment',
    maxSize: 5,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 7,
  },
  utility_bill: {
    type: 'utility_bill',
    label: 'Utility Bill',
    icon: 'flash',
    description: 'Electricity, water, or municipal bill',
    maxSize: 5,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 3,
  },
  tax_certificate: {
    type: 'tax_certificate',
    label: 'Tax Certificate',
    icon: 'document',
    description: 'IRP5 or tax clearance certificate',
    maxSize: 5,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 7,
  },
  police_clearance: {
    type: 'police_clearance',
    label: 'Police Clearance',
    icon: 'shield-checkmark',
    description: 'Police clearance certificate',
    maxSize: 5,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 5,
  },
  other: {
    type: 'other',
    label: 'Other Document',
    icon: 'folder',
    description: 'Other relevant document',
    maxSize: 10,
    acceptedTypes: ['image/*', 'application/pdf'],
    retentionYears: 5,
  },
};

// File info from picker
export interface FileInfo {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

// Upload progress
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}
