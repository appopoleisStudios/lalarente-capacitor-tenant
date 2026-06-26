/**
 * Consolidated Supabase client.
 *
 * This file now re-exports from the single source of truth at `src/lib/supabase`.
 * Previously it created a second Supabase client, which caused duplicate instances
 * and inconsistency. All consumers should import from `@/src/lib/supabase` directly.
 */
export {
  supabase,
  STORAGE_BUCKETS,
  isAuthenticated,
  getCurrentUser,
  getCurrentUserProfile,
  uploadFile,
  getPublicUrl,
  deleteFile,
} from '../../lib/supabase';

export type {
  Tables,
  InsertTables,
  UpdateTables,
  Enums,
  Property,
  PropertyInsert,
  PropertyUpdate,
  Lease,
  LeaseInsert,
  LeaseUpdate,
  Payment,
  PaymentInsert,
  RentalApplication,
  RentalApplicationInsert,
  Inspection,
  InspectionInsert,
  Message,
  MessageThread,
  Document,
  DocumentInsert,
  PropertyStatus,
  UserRole,
} from '../../lib/supabase';
