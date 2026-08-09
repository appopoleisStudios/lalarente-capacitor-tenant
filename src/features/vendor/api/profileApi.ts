import { supabase } from '@/src/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export interface ServiceCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
}

export interface VendorService {
  id: string;
  vendor_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  base_price: number;
  pricing_unit: string | null;
  min_callout_fee: number | null;
  is_active: boolean | null;
  category?: ServiceCategory | null;
}

export interface VendorServiceArea {
  id: string;
  vendor_id: string;
  city: string | null;
  province: string | null;
  postal_codes: string[] | null;
}

export interface VendorDocument {
  id: string;
  vendor_id: string;
  doc_type: string;
  file_url: string;
  status: string;
  notes: string | null;
  uploaded_at: string | null;
  reviewed_at: string | null;
}

export interface VendorProfile {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  rating: number | null;
  total_reviews: number | null;
  services: VendorService[];
  service_areas: VendorServiceArea[];
  documents: VendorDocument[];
}

export const vendorProfileApi = {
  /**
   * Get vendor's complete profile
   */
  async getProfile(vendorId: string): Promise<VendorProfile | null> {
    try {
      // Get basic profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url')
        .eq('id', vendorId)
        .single();

      if (profileError) throw profileError;
      if (!profile) return null;

      // Get services with categories
      const { data: services, error: servicesError } = await supabase
        .from('vendor_services')
        .select(
          `
          *,
          category:service_categories(*)
        `
        )
        .eq('vendor_id', vendorId)
        .eq('is_active', true);

      if (servicesError) throw servicesError;

      // Get service areas
      const { data: serviceAreas, error: areasError } = await supabase
        .from('vendor_service_areas')
        .select('*')
        .eq('vendor_id', vendorId);

      if (areasError) throw areasError;

      // Get documents
      const { data: documents, error: docsError } = await supabase
        .from('vendor_documents')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;

      // TODO: Get rating and reviews from completed jobs
      // For now, return mock data
      const rating = 4.5;
      const totalReviews = 12;

      return {
        id: profile.id,
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        avatar_url: profile.avatar_url,
        rating,
        total_reviews: totalReviews,
        services: services || [],
        service_areas: serviceAreas || [],
        documents: documents || [],
      };
    } catch (error) {
      console.error('Error fetching vendor profile:', error);
      throw error;
    }
  },

  /**
   * Update the vendor's basic profile fields (name / phone / avatar).
   */
  async updateProfile(
    vendorId: string,
    updates: {
      full_name?: string;
      phone?: string | null;
      avatar_url?: string | null;
    }
  ): Promise<void> {
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', vendorId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating vendor profile:', error);
      throw error;
    }
  },

  /**
   * Get all available service categories
   */
  async getServiceCategories(): Promise<ServiceCategory[]> {
    try {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data as ServiceCategory[]) || [];
    } catch (error) {
      console.error('Error fetching service categories:', error);
      throw error;
    }
  },

  /**
   * Add a service category to vendor's profile
   */
  async addService(
    vendorId: string,
    categoryId: string,
    title: string,
    basePrice: number,
    pricingUnit?: string
  ): Promise<VendorService> {
    try {
      const { data, error } = await supabase
        .from('vendor_services')
        .insert({
          vendor_id: vendorId,
          category_id: categoryId,
          title,
          base_price: basePrice,
          pricing_unit: pricingUnit,
          is_active: true,
        } as any)
        .select(
          `
          *,
          category:service_categories(*)
        `
        )
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create service');
      return data as VendorService;
    } catch (error) {
      console.error('Error adding service:', error);
      throw error;
    }
  },

  /**
   * Remove a service from vendor's profile
   */
  async removeService(serviceId: string): Promise<void> {
    try {
      const { error } = await supabase.from('vendor_services').delete().eq('id', serviceId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing service:', error);
      throw error;
    }
  },

  /**
   * Add a service area
   */
  async addServiceArea(
    vendorId: string,
    city: string,
    province: string
  ): Promise<VendorServiceArea> {
    try {
      const { data, error } = await supabase
        .from('vendor_service_areas')
        .insert({
          vendor_id: vendorId,
          city,
          province,
        } as any)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('Failed to create service area');
      return data as VendorServiceArea;
    } catch (error) {
      console.error('Error adding service area:', error);
      throw error;
    }
  },

  /**
   * Remove a service area
   */
  async removeServiceArea(areaId: string): Promise<void> {
    try {
      const { error } = await supabase.from('vendor_service_areas').delete().eq('id', areaId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing service area:', error);
      throw error;
    }
  },

  /**
   * Upload a document: reads the picked file, uploads it to the private
   * `documents` bucket under vendor-documents/{vendorId}/, and records the row.
   * Mirrors documentsApi.uploadDocument (base64 -> arraybuffer -> storage).
   */
  async uploadDocument(
    vendorId: string,
    docType: string,
    file: { uri: string; name: string; mimeType?: string; size?: number }
  ): Promise<VendorDocument> {
    try {
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });
      const arrayBuffer = decode(base64);

      const timestamp = Date.now();
      const extension = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const fileName = `vendor-documents/${vendorId}/${timestamp}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, arrayBuffer, {
          contentType: file.mimeType || 'application/pdf',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw new Error(`Failed to upload file: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName);
      const fileUrl = urlData?.publicUrl || fileName;

      const { data, error } = await supabase
        .from('vendor_documents')
        .insert({
          vendor_id: vendorId,
          doc_type: docType,
          file_url: fileUrl,
          status: 'pending',
        } as any)
        .select()
        .single();

      if (error) {
        // Roll back the stored file so no orphan objects linger.
        await supabase.storage
          .from('documents')
          .remove([fileName])
          .catch(() => {});
        throw error;
      }
      if (!data) throw new Error('Failed to upload document');
      return data as VendorDocument;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  },

  /**
   * Delete a document: removes the stored object (if the file_url points into
   * the documents bucket) and then the row. Mirrors documentsApi.deleteDocument.
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const { data: doc, error: fetchError } = await supabase
        .from('vendor_documents')
        .select('file_url')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      if (doc?.file_url && doc.file_url.includes('/documents/')) {
        const urlParts = doc.file_url.split('/');
        const bucketIndex = urlParts.findIndex((p: string) => p === 'documents');
        if (bucketIndex > -1) {
          const filePath = urlParts.slice(bucketIndex + 1).join('/');
          await supabase.storage
            .from('documents')
            .remove([filePath])
            .catch(() => {});
        }
      }

      const { error } = await supabase.from('vendor_documents').delete().eq('id', documentId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting document:', error);
      throw error;
    }
  },
};
