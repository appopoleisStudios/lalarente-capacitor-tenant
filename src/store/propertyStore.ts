import { create } from 'zustand'
import { supabase, type Property, type PropertyStatus } from '@/lib/supabase'

interface PropertyState {
  properties: Property[]
  selectedProperty: Property | null
  isLoading: boolean
  error: string | null
  filters: {
    city: string
    minRent: number
    maxRent: number
    status: PropertyStatus | 'all'
    propertyType: string
  }
  setProperties: (properties: Property[]) => void
  setSelectedProperty: (property: Property | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  updateFilters: (filters: Partial<PropertyState['filters']>) => void
  fetchProperties: (ownerId?: string) => Promise<void>
  fetchAvailableProperties: () => Promise<void>
  searchProperties: (query: string) => Promise<void>
}

export const usePropertyStore = create<PropertyState>((set) => ({
  properties: [],
  selectedProperty: null,
  isLoading: false,
  error: null,
  filters: {
    city: '',
    minRent: 0,
    maxRent: 100000,
    status: 'all',
    propertyType: ''
  },

  setProperties: (properties) => set({ properties }),
  setSelectedProperty: (property) => set({ selectedProperty: property }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  updateFilters: (newFilters) => set(state => ({ 
    filters: { ...state.filters, ...newFilters } 
  })),

  fetchProperties: async (ownerId?: string) => {
    set({ isLoading: true, error: null })
    try {
      let query = supabase.from('properties').select('*')
      
      if (ownerId) {
        query = query.eq('owner_id', ownerId)
      }
      
      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error
      set({ properties: data || [], isLoading: false })
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'An error occurred', isLoading: false })
    }
  },

  fetchAvailableProperties: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('status', 'available')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      set({ properties: data || [], isLoading: false })
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'An error occurred', isLoading: false })
    }
  },

  searchProperties: async (query: string) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .or(`title.ilike.%${query}%,address.ilike.%${query}%,city.ilike.%${query}%`)
        .eq('status', 'available')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      set({ properties: data || [], isLoading: false })
    } catch (err: unknown) {
      set({ error: err instanceof Error ? err.message : 'An error occurred', isLoading: false })
    }
  }
}))
