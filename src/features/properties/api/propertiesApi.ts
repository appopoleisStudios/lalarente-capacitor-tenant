import { supabase, STORAGE_BUCKETS } from '@/src/lib/supabase';
import type { Database } from '@/src/types/database.types';

// Type aliases for cleaner code
type Property = Database['public']['Tables']['properties']['Row'];
type PropertyInsert = Database['public']['Tables']['properties']['Insert'];
type PropertyUpdate = Database['public']['Tables']['properties']['Update'];
type PropertyStatus = Database['public']['Enums']['property_status'];

// Extended property with relations
export interface PropertyWithRelations extends Property {
  owner?: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
  };
  leases?: Array<{
    id: string;
    start_date: string;
    end_date: string;
    monthly_rent: number;
    status: string | null;
    tenant?: {
      id: string;
      full_name: string;
      email: string | null;
      phone: string | null;
    };
  }>;
}



// Input types for API operations
export interface CreatePropertyInput {
  owner_id: string;
  title: string;
  description: string | null;
  address: string;
  city: string;
  province: string;
  postal_code?: string | null;
  property_type: string;
  bedrooms: number;
  bathrooms: number;
  rent_amount: number;
  deposit_amount?: number | null;
  amenities?: string[] | null;
  parking_spaces?: number | null;
  size_sqm?: number | null;
  available_from?: string | null;
  minimum_lease_months?: number | null;
  pets_allowed?: boolean | null;
  smoking_allowed?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  images?: string[] | null;
  lease_terms?: any | null;
}

export interface UpdatePropertyInput {
  title?: string;
  description?: string | null;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string | null;
  property_type?: string;
  bedrooms?: number;
  bathrooms?: number;
  rent_amount?: number;
  deposit_amount?: number | null;
  amenities?: string[] | null;
  parking_spaces?: number | null;
  status?: PropertyStatus;
  images?: string[] | null;
  lease_terms?: any | null;
}

export interface PropertyFilters {
  status?: PropertyStatus | PropertyStatus[];
  property_type?: string | string[];
  city?: string;
  province?: string;
  min_rent?: number;
  max_rent?: number;
  min_bedrooms?: number;
  max_bedrooms?: number;
  min_bathrooms?: number;
  max_bathrooms?: number;
}

export interface SearchCriteria {
  // Location filters
  city?: string;
  province?: string;
  search_text?: string; // Free text search across title, description, address
  
  // Price filters
  min_rent?: number;
  max_rent?: number;
  
  // Property specs
  min_bedrooms?: number;
  max_bedrooms?: number;
  min_bathrooms?: number;
  max_bathrooms?: number;
  property_types?: string[];
  
  // Amenities
  amenities?: string[];
  parking_required?: boolean;
  
  // Sorting
  sort_by?: 'price_asc' | 'price_desc' | 'newest' | 'bedrooms_asc' | 'bedrooms_desc';
  
  // Pagination
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  properties: PropertyWithRelations[];
  total_count: number;
  has_more: boolean;
}

export const propertiesApi = {
  /**
   * Create a new property
   */
  async createProperty(input: CreatePropertyInput): Promise<Property> {
    const { data, error } = await supabase
      .from('properties')
      .insert({
        owner_id: input.owner_id,
        title: input.title,
        description: input.description || null,
        address: input.address,
        city: input.city,
        province: input.province,
        postal_code: input.postal_code || null,
        property_type: input.property_type,
        bedrooms: input.bedrooms,
        bathrooms: input.bathrooms,
        rent_amount: input.rent_amount,
        deposit_amount: input.deposit_amount || null,
        amenities: input.amenities || null,
        parking_spaces: input.parking_spaces || 0,
        images: input.images || null,
        lease_terms: input.lease_terms || null,
        status: 'available',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating property:', error);
      throw new Error(`Failed to create property: ${error.message}`);
    }

    return data;
  },

  /**
   * Update an existing property
   */
  async updateProperty(id: string, input: UpdatePropertyInput): Promise<Property> {
    const updateData: PropertyUpdate = {
      ...input,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating property:', error);
      throw new Error(`Failed to update property: ${error.message}`);
    }

    return data;
  },

  /**
   * Delete a property (soft delete by setting status to vacant)
   */
  async deleteProperty(id: string): Promise<void> {
    const { error } = await supabase
      .from('properties')
      .update({ status: 'vacant' })
      .eq('id', id);

    if (error) {
      console.error('Error deleting property:', error);
      throw new Error(`Failed to delete property: ${error.message}`);
    }
  },

  /**
   * Get a single property by ID with relations
   */
  async getProperty(id: string): Promise<PropertyWithRelations> {
    const { data, error } = await supabase
      .from('properties')
      .select(`
        *,
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching property:', error);
      throw new Error(`Failed to fetch property: ${error.message}`);
    }

    // Fetch leases separately if needed
    const { data: leases } = await supabase
      .from('leases')
      .select(`
        id,
        start_date,
        end_date,
        monthly_rent,
        status,
        tenant:profiles!tenant_id(id, full_name, email, phone)
      `)
      .eq('property_id', id);

    return {
      ...data,
      leases: leases || [],
    } as PropertyWithRelations;
  },

  /**
   * Get all properties for a specific owner
   */
  async getOwnerProperties(
    ownerId: string,
    filters?: PropertyFilters
  ): Promise<PropertyWithRelations[]> {
    let query = supabase
      .from('properties')
      .select(`
        *,
        owner:profiles!owner_id(id, full_name, email, phone)
      `)
      .eq('owner_id', ownerId);

    // Apply filters
    if (filters) {
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          query = query.in('status', filters.status);
        } else {
          query = query.eq('status', filters.status);
        }
      }

      if (filters.property_type) {
        if (Array.isArray(filters.property_type)) {
          query = query.in('property_type', filters.property_type);
        } else {
          query = query.eq('property_type', filters.property_type);
        }
      }

      if (filters.city) {
        query = query.eq('city', filters.city);
      }

      if (filters.province) {
        query = query.eq('province', filters.province);
      }

      if (filters.min_rent !== undefined) {
        query = query.gte('rent_amount', filters.min_rent);
      }

      if (filters.max_rent !== undefined) {
        query = query.lte('rent_amount', filters.max_rent);
      }

      if (filters.min_bedrooms !== undefined) {
        query = query.gte('bedrooms', filters.min_bedrooms);
      }

      if (filters.max_bedrooms !== undefined) {
        query = query.lte('bedrooms', filters.max_bedrooms);
      }

      if (filters.min_bathrooms !== undefined) {
        query = query.gte('bathrooms', filters.min_bathrooms);
      }

      if (filters.max_bathrooms !== undefined) {
        query = query.lte('bathrooms', filters.max_bathrooms);
      }
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching owner properties:', error);
      throw new Error(`Failed to fetch owner properties: ${error.message}`);
    }

    // Fetch leases for all properties
    const propertyIds = data?.map(p => p.id) || [];
    let leasesData: any[] = [];
    
    if (propertyIds.length > 0) {
      const { data: leases } = await supabase
        .from('leases')
        .select(`
          id,
          property_id,
          start_date,
          end_date,
          monthly_rent,
          status,
          tenant:profiles!tenant_id(id, full_name, email, phone)
        `)
        .in('property_id', propertyIds);
      
      leasesData = leases || [];
    }

    // Combine properties with their leases
    const propertiesWithLeases = (data || []).map(property => ({
      ...property,
      leases: leasesData.filter(lease => lease.property_id === property.id),
    }));

    return propertiesWithLeases as PropertyWithRelations[];
  },

  /**
   * Search properties with advanced filtering (for tenants)
   */
  async searchProperties(criteria: SearchCriteria): Promise<SearchResult> {
    let query = supabase
      .from('properties')
      .select(`
        *,
        owner:profiles!owner_id(id, full_name, email, phone)
      `, { count: 'exact' })
      .eq('status', 'available'); // Only show available properties

    // Free text search across multiple fields
    if (criteria.search_text) {
      const searchTerm = criteria.search_text.trim();
      query = query.or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,address.ilike.%${searchTerm}%,city.ilike.%${searchTerm}%`
      );
    }

    // Location filters
    if (criteria.city) {
      query = query.ilike('city', `%${criteria.city}%`);
    }

    if (criteria.province) {
      query = query.eq('province', criteria.province);
    }

    // Price filters
    if (criteria.min_rent !== undefined) {
      query = query.gte('rent_amount', criteria.min_rent);
    }

    if (criteria.max_rent !== undefined) {
      query = query.lte('rent_amount', criteria.max_rent);
    }

    // Bedroom filters
    if (criteria.min_bedrooms !== undefined) {
      query = query.gte('bedrooms', criteria.min_bedrooms);
    }

    if (criteria.max_bedrooms !== undefined) {
      query = query.lte('bedrooms', criteria.max_bedrooms);
    }

    // Bathroom filters
    if (criteria.min_bathrooms !== undefined) {
      query = query.gte('bathrooms', criteria.min_bathrooms);
    }

    if (criteria.max_bathrooms !== undefined) {
      query = query.lte('bathrooms', criteria.max_bathrooms);
    }

    // Property type filter
    if (criteria.property_types && criteria.property_types.length > 0) {
      query = query.in('property_type', criteria.property_types);
    }

    // Amenities filter (check if property has all requested amenities)
    if (criteria.amenities && criteria.amenities.length > 0) {
      query = query.contains('amenities', criteria.amenities);
    }

    // Parking filter
    if (criteria.parking_required) {
      query = query.gt('parking_spaces', 0);
    }

    // Sorting
    switch (criteria.sort_by) {
      case 'price_asc':
        query = query.order('rent_amount', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('rent_amount', { ascending: false });
        break;
      case 'bedrooms_asc':
        query = query.order('bedrooms', { ascending: true });
        break;
      case 'bedrooms_desc':
        query = query.order('bedrooms', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Pagination
    const limit = criteria.limit || 20;
    const offset = criteria.offset || 0;
    
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error searching properties:', error);
      throw new Error(`Failed to search properties: ${error.message}`);
    }

    const totalCount = count || 0;
    const hasMore = offset + limit < totalCount;

    return {
      properties: (data || []) as PropertyWithRelations[],
      total_count: totalCount,
      has_more: hasMore,
    };
  },

  /**
   * Get available property types for filtering
   */
  async getPropertyTypes(): Promise<string[]> {
    const { data, error } = await supabase
      .from('properties')
      .select('property_type')
      .eq('status', 'available');

    if (error) {
      console.error('Error fetching property types:', error);
      return [];
    }

    // Get unique property types
    const types = [...new Set(data?.map(p => p.property_type) || [])];
    return types.filter(Boolean);
  },

  /**
   * Get available cities for filtering
   */
  async getAvailableCities(): Promise<string[]> {
    const { data, error } = await supabase
      .from('properties')
      .select('city')
      .eq('status', 'available');

    if (error) {
      console.error('Error fetching cities:', error);
      return [];
    }

    // Get unique cities
    const cities = [...new Set(data?.map(p => p.city) || [])];
    return cities.filter(Boolean).sort();
  },

  /**
   * Get available provinces for filtering
   */
  async getAvailableProvinces(): Promise<string[]> {
    const { data, error } = await supabase
      .from('properties')
      .select('province')
      .eq('status', 'available');

    if (error) {
      console.error('Error fetching provinces:', error);
      return [];
    }

    // Get unique provinces
    const provinces = [...new Set(data?.map(p => p.province) || [])];
    return provinces.filter(Boolean).sort();
  },

  /**
   * Get rent price range for filtering
   */
  async getRentPriceRange(): Promise<{ min: number; max: number }> {
    const { data, error } = await supabase
      .from('properties')
      .select('rent_amount')
      .eq('status', 'available');

    if (error || !data || data.length === 0) {
      return { min: 0, max: 0 };
    }

    const rents = data.map(p => p.rent_amount).filter(Boolean);
    return {
      min: Math.min(...rents),
      max: Math.max(...rents),
    };
  },

  /**
   * Update property status
   */
  async updatePropertyStatus(id: string, status: PropertyStatus): Promise<Property> {
    const { data, error } = await supabase
      .from('properties')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating property status:', error);
      throw new Error(`Failed to update property status: ${error.message}`);
    }

    return data;
  },

  /**
   * Get property statistics for owner dashboard
   */
  async getPropertyStats(ownerId: string) {
    const { data: properties, error } = await supabase
      .from('properties')
      .select('id, status, rent_amount')
      .eq('owner_id', ownerId)
      .neq('status', 'vacant'); // Exclude vacant (soft-deleted) properties

    if (error) {
      console.error('Error fetching property stats:', error);
      throw new Error(`Failed to fetch property stats: ${error.message}`);
    }

    const total = properties?.length || 0;
    const available = properties?.filter(p => p.status === 'available').length || 0;
    const rented = properties?.filter(p => p.status === 'rented').length || 0;
    const maintenance = properties?.filter(p => p.status === 'maintenance').length || 0;
    const totalMonthlyIncome = properties
      ?.filter(p => p.status === 'rented')
      .reduce((sum, p) => sum + (p.rent_amount || 0), 0) || 0;

    return {
      total,
      available,
      rented,
      maintenance,
      occupancyRate: total > 0 ? (rented / total) * 100 : 0,
      totalMonthlyIncome,
    };
  },

  // ==================== PHOTO MANAGEMENT ====================

  /**
   * Upload property photos to Supabase Storage
   * @param propertyId - The property ID
   * @param files - Array of file objects (from React Native or web)
   * @returns Array of uploaded photo URLs
   */
  async uploadPropertyPhotos(
    propertyId: string,
    files: Array<{ uri: string; name: string; type: string }>
  ): Promise<string[]> {
    const uploadedUrls: string[] = [];

    try {
      for (const file of files) {
        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${propertyId}/${timestamp}-${randomString}.${fileExt}`;

        // Convert file to blob for upload
        let fileBlob: Blob;
        
        // Handle React Native file (uri-based)
        if (file.uri.startsWith('file://') || file.uri.startsWith('content://')) {
          const response = await fetch(file.uri);
          fileBlob = await response.blob();
        } 
        // Handle web file or data URI
        else if (file.uri.startsWith('data:')) {
          const response = await fetch(file.uri);
          fileBlob = await response.blob();
        }
        // Handle direct blob/file
        else {
          throw new Error('Unsupported file format');
        }

        // Upload to Supabase Storage
        const { data, error } = await supabase.storage
          .from(STORAGE_BUCKETS.PROPERTY_IMAGES)
          .upload(fileName, fileBlob, {
            contentType: file.type,
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          console.error('Error uploading photo:', error);
          throw new Error(`Failed to upload photo: ${error.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(STORAGE_BUCKETS.PROPERTY_IMAGES)
          .getPublicUrl(data.path);

        uploadedUrls.push(urlData.publicUrl);
      }

      // Update property with new image URLs
      const property = await this.getProperty(propertyId);
      const existingImages = property.images || [];
      const updatedImages = [...existingImages, ...uploadedUrls];

      await this.updateProperty(propertyId, { images: updatedImages });

      return uploadedUrls;
    } catch (error) {
      console.error('Error in uploadPropertyPhotos:', error);
      throw error;
    }
  },

  /**
   * Delete a property photo from storage and database
   * @param propertyId - The property ID
   * @param photoUrl - The URL of the photo to delete
   */
  async deletePropertyPhoto(propertyId: string, photoUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(photoUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.indexOf(STORAGE_BUCKETS.PROPERTY_IMAGES);
      
      if (bucketIndex === -1) {
        throw new Error('Invalid photo URL');
      }

      const filePath = pathParts.slice(bucketIndex + 1).join('/');

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from(STORAGE_BUCKETS.PROPERTY_IMAGES)
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting photo from storage:', storageError);
        // Continue even if storage deletion fails
      }

      // Remove URL from property images array
      const property = await this.getProperty(propertyId);
      const updatedImages = (property.images || []).filter(url => url !== photoUrl);

      await this.updateProperty(propertyId, { images: updatedImages });
    } catch (error) {
      console.error('Error in deletePropertyPhoto:', error);
      throw new Error(`Failed to delete photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Reorder property photos
   * @param propertyId - The property ID
   * @param orderedUrls - Array of photo URLs in desired order
   */
  async reorderPropertyPhotos(propertyId: string, orderedUrls: string[]): Promise<void> {
    try {
      await this.updateProperty(propertyId, { images: orderedUrls });
    } catch (error) {
      console.error('Error reordering photos:', error);
      throw new Error(`Failed to reorder photos: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  /**
   * Generate thumbnail URL from full image URL
   * Note: This is a placeholder. In production, you'd want to:
   * 1. Use Supabase Image Transformations (if available)
   * 2. Or generate thumbnails on upload using a service like Sharp
   * 3. Or use a CDN with image transformation capabilities
   * 
   * @param imageUrl - Full image URL
   * @returns Thumbnail URL (currently returns same URL)
   */
  generateThumbnailUrl(imageUrl: string): string {
    // TODO: Implement actual thumbnail generation
    // For now, return the same URL
    // In production, you might append transformation parameters:
    // return `${imageUrl}?width=300&height=300&fit=cover`;
    return imageUrl;
  },
};
