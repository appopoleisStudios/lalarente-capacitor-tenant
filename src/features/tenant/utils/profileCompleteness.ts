// Tenant profile completeness — single source of truth for "is this
// tenant's profile complete enough?". The dashboard "Complete Your Profile"
// banner and the future lease-sign gate (CT7-012) both consume this helper
// so they can't drift from each other.

import { supabase } from '@/src/lib/supabase';

export interface TenantProfileCompletenessResult {
  complete: boolean;
  missing: string[];
}

interface TenantProfileRow {
  full_name: string | null;
  phone: string | null;
  id_number: string | null;
  date_of_birth: string | null;
  proof_of_address_url: string | null;
  monthly_income: number | null;
  fica_documents: {
    id_number?: string | null;
    date_of_birth?: string | null;
    monthly_income?: number | null;
  } | null;
}

const LABEL = {
  fullName: 'Full name',
  phone: 'Phone number',
  idNumber: 'SA ID number',
  dateOfBirth: 'Date of birth',
  monthlyIncome: 'Monthly income',
  proofOfAddress: 'Proof of address',
} as const;

export async function checkTenantProfileCompleteness(
  userId: string
): Promise<TenantProfileCompletenessResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'full_name, phone, id_number, date_of_birth, proof_of_address_url, monthly_income, fica_documents'
    )
    .eq('id', userId)
    .maybeSingle<TenantProfileRow>();

  if (error || !data) {
    return { complete: false, missing: ['Profile not found — complete your profile'] };
  }

  const missing: string[] = [];

  // Each FICA field can live on its dedicated column OR inside the legacy
  // fica_documents JSON blob (older accounts migrated from the JSON-only
  // schema). Treat the merged view as authoritative so a user who saves
  // via either code path shows as complete.
  const idNumber = data.id_number ?? data.fica_documents?.id_number ?? null;
  const dob = data.date_of_birth ?? data.fica_documents?.date_of_birth ?? null;
  const income = data.monthly_income ?? data.fica_documents?.monthly_income ?? null;

  if (!data.full_name?.trim()) missing.push(LABEL.fullName);
  if (!data.phone?.trim()) missing.push(LABEL.phone);
  if (!idNumber?.toString().trim()) missing.push(LABEL.idNumber);
  if (!dob) missing.push(LABEL.dateOfBirth);
  if (income == null || Number(income) <= 0) missing.push(LABEL.monthlyIncome);
  if (!data.proof_of_address_url?.trim()) missing.push(LABEL.proofOfAddress);

  return { complete: missing.length === 0, missing };
}
