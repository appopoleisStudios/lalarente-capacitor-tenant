import { supabase } from '../../../lib/supabase';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import type {
  Document,
  DocumentWithRelations,
  UploadDocumentInput,
  DocumentFilter,
  FileInfo,
} from '../types';

// Storage bucket for documents
const DOCUMENTS_BUCKET = 'documents';

export const documentsApi = {
  /**
   * Upload a document
   */
  async uploadDocument(
    file: FileInfo,
    input: UploadDocumentInput,
    uploaderId: string
  ): Promise<Document> {
    try {
      // Validate file size
      const category = (await import('../types')).DOCUMENT_CATEGORIES[input.type];
      const maxSizeBytes = category.maxSize * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        throw new Error(`File size exceeds maximum of ${category.maxSize}MB`);
      }

      // Read file as base64
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });

      // Generate unique filename
      const timestamp = Date.now();
      const extension = file.name.split('.').pop() || 'pdf';
      const fileName = `${input.type}/${uploaderId}/${timestamp}.${extension}`;

      // Convert to ArrayBuffer and upload
      const arrayBuffer = decode(base64);

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(fileName, arrayBuffer, {
          contentType: file.mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(DOCUMENTS_BUCKET)
        .getPublicUrl(fileName);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get file URL');
      }

      // Calculate delete_after date based on retention period
      const retentionYears = input.retention_period_years || category.retentionYears;
      const deleteAfter = new Date();
      deleteAfter.setFullYear(deleteAfter.getFullYear() + retentionYears);

      // Create document record
      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          type: input.type,
          title: input.title,
          description: input.description || null,
          filename: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
          mime_type: file.mimeType,
          access_level: input.access_level,
          property_id: input.property_id || null,
          lease_id: input.lease_id || null,
          tenant_id: input.tenant_id || null,
          owner_id: input.owner_id || null,
          uploaded_by: uploaderId,
          retention_period_years: retentionYears,
          delete_after: deleteAfter.toISOString(),
          tags: input.tags || null,
        })
        .select()
        .single();

      if (docError) {
        console.error('Error creating document record:', docError);
        // Try to delete uploaded file
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([fileName]);
        throw new Error(`Failed to create document record: ${docError.message}`);
      }

      return document;
    } catch (error) {
      console.error('Error in uploadDocument:', error);
      throw error;
    }
  },

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<DocumentWithRelations> {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        property:properties!property_id(id, title),
        lease:leases!lease_id(id, start_date, end_date),
        owner:profiles!owner_id(id, full_name),
        tenant:profiles!tenant_id(id, full_name),
        uploader:profiles!uploaded_by(id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching document:', error);
      throw new Error(`Failed to fetch document: ${error.message}`);
    }

    // Log access
    await this.logAccess(id);

    return data as DocumentWithRelations;
  },

  /**
   * Get documents for a user
   */
  async getUserDocuments(
    userId: string,
    role: 'owner' | 'tenant',
    filter?: DocumentFilter
  ): Promise<DocumentWithRelations[]> {
    let query = supabase
      .from('documents')
      .select(`
        *,
        property:properties!property_id(id, title),
        lease:leases!lease_id(id, start_date, end_date)
      `)
      .or(`uploaded_by.eq.${userId},${role}_id.eq.${userId}`);

    // Apply filters
    if (filter?.type && filter.type !== 'all') {
      query = query.eq('type', filter.type);
    }

    if (filter?.property_id) {
      query = query.eq('property_id', filter.property_id);
    }

    if (filter?.lease_id) {
      query = query.eq('lease_id', filter.lease_id);
    }

    if (filter?.uploaded_after) {
      query = query.gte('created_at', filter.uploaded_after);
    }

    if (filter?.uploaded_before) {
      query = query.lte('created_at', filter.uploaded_before);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw new Error(`Failed to fetch documents: ${error.message}`);
    }

    return data as DocumentWithRelations[];
  },

  /**
   * Get documents for a property
   */
  async getPropertyDocuments(propertyId: string): Promise<DocumentWithRelations[]> {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        uploader:profiles!uploaded_by(id, full_name)
      `)
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching property documents:', error);
      throw new Error(`Failed to fetch property documents: ${error.message}`);
    }

    return data as DocumentWithRelations[];
  },

  /**
   * Get documents for a lease
   */
  async getLeaseDocuments(leaseId: string): Promise<DocumentWithRelations[]> {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        uploader:profiles!uploaded_by(id, full_name)
      `)
      .eq('lease_id', leaseId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching lease documents:', error);
      throw new Error(`Failed to fetch lease documents: ${error.message}`);
    }

    return data as DocumentWithRelations[];
  },

  /**
   * Update document metadata
   */
  async updateDocument(
    id: string,
    updates: Partial<{
      title: string;
      description: string;
      access_level: string;
      tags: string[];
    }>
  ): Promise<Document> {
    const { data, error } = await supabase
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating document:', error);
      throw new Error(`Failed to update document: ${error.message}`);
    }

    return data;
  },

  /**
   * Delete a document
   */
  async deleteDocument(id: string): Promise<void> {
    // Get document to find file path
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('file_url')
      .eq('id', id)
      .single();

    if (fetchError) {
      throw new Error(`Failed to find document: ${fetchError.message}`);
    }

    // Extract file path from URL
    const urlParts = doc.file_url.split('/');
    const bucketIndex = urlParts.findIndex((p: string) => p === DOCUMENTS_BUCKET);
    const filePath = urlParts.slice(bucketIndex + 1).join('/');

    // Delete file from storage
    const { error: storageError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove([filePath]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      // Continue to delete record anyway
    }

    // Delete document record
    const { error: deleteError } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (deleteError) {
      throw new Error(`Failed to delete document: ${deleteError.message}`);
    }
  },

  /**
   * Log document access
   */
  async logAccess(documentId: string): Promise<void> {
    await supabase
      .from('documents')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('id', documentId);
  },

  /**
   * Get documents expiring soon (retention period ending)
   */
  async getExpiringDocuments(userId: string, daysAhead: number = 30): Promise<Document[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .or(`owner_id.eq.${userId},tenant_id.eq.${userId}`)
      .lte('delete_after', futureDate.toISOString())
      .order('delete_after', { ascending: true });

    if (error) {
      console.error('Error fetching expiring documents:', error);
      throw new Error(`Failed to fetch expiring documents: ${error.message}`);
    }

    return data;
  },

  /**
   * Extend retention period for a document
   */
  async extendRetention(id: string, additionalYears: number): Promise<Document> {
    const doc = await this.getDocument(id);
    const currentDeleteAfter = new Date(doc.delete_after || new Date());
    currentDeleteAfter.setFullYear(currentDeleteAfter.getFullYear() + additionalYears);

    const { data, error } = await supabase
      .from('documents')
      .update({
        delete_after: currentDeleteAfter.toISOString(),
        retention_period_years: (doc.retention_period_years || 5) + additionalYears,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to extend retention: ${error.message}`);
    }

    return data;
  },

  /**
   * Get document statistics for a user
   */
  async getDocumentStats(userId: string, role: 'owner' | 'tenant'): Promise<{
    totalDocuments: number;
    byType: Record<string, number>;
    totalSize: number;
    expiringCount: number;
  }> {
    const documents = await this.getUserDocuments(userId, role);
    const expiringDocs = await this.getExpiringDocuments(userId);

    const byType: Record<string, number> = {};
    let totalSize = 0;

    documents.forEach(doc => {
      byType[doc.type] = (byType[doc.type] || 0) + 1;
      totalSize += doc.file_size || 0;
    });

    return {
      totalDocuments: documents.length,
      byType,
      totalSize,
      expiringCount: expiringDocs.length,
    };
  },

  /**
   * Search documents by title or tags
   */
  async searchDocuments(
    userId: string,
    role: 'owner' | 'tenant',
    query: string
  ): Promise<DocumentWithRelations[]> {
    const { data, error } = await supabase
      .from('documents')
      .select(`
        *,
        property:properties!property_id(id, title)
      `)
      .or(`uploaded_by.eq.${userId},${role}_id.eq.${userId}`)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to search documents: ${error.message}`);
    }

    return data as DocumentWithRelations[];
  },

  /**
   * Download document (get signed URL for private files)
   */
  async getDownloadUrl(fileUrl: string): Promise<string> {
    // For public URLs, return as is
    if (fileUrl.includes('/public/')) {
      return fileUrl;
    }

    // For private files, generate a signed URL
    const urlParts = fileUrl.split('/');
    const bucketIndex = urlParts.findIndex((p: string) => p === DOCUMENTS_BUCKET);
    const filePath = urlParts.slice(bucketIndex + 1).join('/');

    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(filePath, 3600); // 1 hour expiry

    if (error) {
      throw new Error(`Failed to generate download URL: ${error.message}`);
    }

    return data.signedUrl;
  },
};
