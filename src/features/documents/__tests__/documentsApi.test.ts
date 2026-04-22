import { DOCUMENT_CATEGORIES, DocumentType } from '../types';
import { documentsApi } from '../api/documentsApi';
import * as FileSystem from 'expo-file-system/legacy';

// ─── Mocks (jest.mock is hoisted above imports at runtime) ────────────────────

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('base64encodeddata'),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('base64-arraybuffer', () => ({
  decode: jest.fn().mockReturnValue(new ArrayBuffer(8)),
}));

const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockOrder = jest.fn();
const mockRemove = jest.fn();
const mockGetPublicUrl = jest.fn();
const mockUpload = jest.fn();
const mockCreateSignedUrl = jest.fn();

const storageChain = {
  upload: mockUpload,
  getPublicUrl: mockGetPublicUrl,
  remove: mockRemove,
  createSignedUrl: mockCreateSignedUrl,
};

const fromStorage = jest.fn(() => storageChain);

const dbChain = {
  insert: mockInsert,
  select: jest.fn(() => ({ eq: mockEq, order: mockOrder, single: mockSingle, in: mockIn })),
  delete: jest.fn(() => ({ eq: jest.fn() })),
  update: jest.fn(() => ({ eq: jest.fn() })),
  eq: mockEq,
};

const fromDb = jest.fn(() => dbChain);

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    storage: { from: fromStorage },
    from: fromDb,
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeFile = (overrides = {}) => ({
  uri: 'file:///tmp/test.pdf',
  name: 'test.pdf',
  mimeType: 'application/pdf',
  size: 1024 * 1024, // 1 MB
  ...overrides,
});

const makeInput = (overrides = {}) => ({
  type: 'id_document' as DocumentType,
  title: 'Test ID',
  access_level: 'tenant_only' as const,
  ...overrides,
});

const makeDocument = (overrides = {}) => ({
  id: 'doc-1',
  type: 'id_document',
  title: 'Test ID',
  file_url: 'https://supabase.co/storage/v1/object/public/documents/id_document/user-1/123.pdf',
  file_size: 1024,
  mime_type: 'application/pdf',
  created_at: new Date().toISOString(),
  ...overrides,
});

// ─── DOCUMENT_CATEGORIES tests ────────────────────────────────────────────────

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
    expect(DOCUMENT_CATEGORIES.lease_agreement.acceptedTypes).toContain('application/pdf');
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

// ─── uploadDocument ───────────────────────────────────────────────────────────

describe('documentsApi.uploadDocument', () => {
  const uploaderId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } });
    mockSingle.mockResolvedValue({ data: makeDocument(), error: null });
  });

  it('happy path: reads file, uploads, inserts record, returns document', async () => {
    const doc = await documentsApi.uploadDocument(makeFile(), makeInput(), uploaderId);

    expect(FileSystem.readAsStringAsync).toHaveBeenCalledWith('file:///tmp/test.pdf', { encoding: 'base64' });
    expect(mockUpload).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();
    expect(doc.id).toBe('doc-1');
  });

  it('rejects files exceeding maxSize', async () => {
    const bigFile = makeFile({ size: 200 * 1024 * 1024 }); // 200 MB
    await expect(documentsApi.uploadDocument(bigFile, makeInput(), uploaderId))
      .rejects.toThrow('File size exceeds maximum');
  });

  it('rejects disallowed MIME types', async () => {
    const badFile = makeFile({ mimeType: 'application/javascript' });
    await expect(documentsApi.uploadDocument(badFile, makeInput(), uploaderId))
      .rejects.toThrow('is not allowed');
  });

  it('deletes orphan file when DB insert fails', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    await expect(documentsApi.uploadDocument(makeFile(), makeInput(), uploaderId))
      .rejects.toThrow('Failed to create document record');

    expect(mockRemove).toHaveBeenCalled();
  });

  it('throws when storage upload fails', async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: 'Storage quota exceeded' } });

    await expect(documentsApi.uploadDocument(makeFile(), makeInput(), uploaderId))
      .rejects.toThrow('Failed to upload file');
  });
});

// ─── deleteDocument ───────────────────────────────────────────────────────────

describe('documentsApi.deleteDocument', () => {
  const docId = 'doc-1';
  const fileUrl = 'https://supabase.co/storage/v1/object/public/documents/id_document/user-1/file.pdf';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the document, removes from storage, deletes the record', async () => {
    const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
    dbChain.select.mockReturnValueOnce({
      eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { file_url: fileUrl }, error: null }) }),
    } as any);
    dbChain.delete.mockReturnValueOnce({ eq: mockDeleteEq } as any);
    mockRemove.mockResolvedValueOnce({ error: null });

    await documentsApi.deleteDocument(docId);

    expect(mockRemove).toHaveBeenCalled();
    expect(mockDeleteEq).toHaveBeenCalledWith('id', docId);
  });

  it('throws when document record is not found', async () => {
    dbChain.select.mockReturnValueOnce({
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }),
    } as any);

    await expect(documentsApi.deleteDocument(docId)).rejects.toThrow('Failed to find document');
  });
});

// ─── getTenantVerificationDocs ────────────────────────────────────────────────

describe('documentsApi.getTenantVerificationDocs', () => {
  const tenantId = 'tenant-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns documents for the tenant', async () => {
    const docs = [makeDocument({ type: 'id_document' }), makeDocument({ type: 'utility_bill' })];
    const mockInChain = { order: jest.fn().mockResolvedValue({ data: docs, error: null }) };
    const mockEqChain2 = { in: jest.fn().mockReturnValue(mockInChain) };
    const mockEqChain1 = { eq: jest.fn().mockReturnValue(mockEqChain2) };
    dbChain.select.mockReturnValueOnce({ eq: jest.fn().mockReturnValue(mockEqChain1) } as any);

    const result = await documentsApi.getTenantVerificationDocs(tenantId);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no docs found', async () => {
    const mockInChain = { order: jest.fn().mockResolvedValue({ data: null, error: null }) };
    const mockEqChain2 = { in: jest.fn().mockReturnValue(mockInChain) };
    const mockEqChain1 = { eq: jest.fn().mockReturnValue(mockEqChain2) };
    dbChain.select.mockReturnValueOnce({ eq: jest.fn().mockReturnValue(mockEqChain1) } as any);

    const result = await documentsApi.getTenantVerificationDocs(tenantId);
    expect(result).toEqual([]);
  });

  it('throws on query error', async () => {
    const mockInChain = { order: jest.fn().mockResolvedValue({ data: null, error: { message: 'Query failed' } }) };
    const mockEqChain2 = { in: jest.fn().mockReturnValue(mockInChain) };
    const mockEqChain1 = { eq: jest.fn().mockReturnValue(mockEqChain2) };
    dbChain.select.mockReturnValueOnce({ eq: jest.fn().mockReturnValue(mockEqChain1) } as any);

    await expect(documentsApi.getTenantVerificationDocs(tenantId)).rejects.toThrow('Failed to fetch verification docs');
  });
});
