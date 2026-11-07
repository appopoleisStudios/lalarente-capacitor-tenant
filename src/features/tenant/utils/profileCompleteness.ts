// Tenant profile completeness — single source of truth for "is this
// tenant's profile complete?". Currently consumed by the dashboard
// banner (TenantDashboardScreen). A future lease-sign gate (tracked
// as CT7-012) will consume the same helper to avoid drift.

import { supabase } from '@/src/lib/supabase';

export type TenantProfileCompletenessResult =
  | { status: 'ok'; complete: true; missing: [] }
  | { status: 'ok'; complete: false; missing: string[] }
  | { status: 'error'; message: string };

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
    monthly_income?: number | string | null;
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

/** Return `v` if it has meaningful content, otherwise `null`. Treats
 *  empty strings and whitespace-only strings as absent so the `??`
 *  fallback chain can reach the legacy JSON field. */
function nonBlank<T extends string | number | null | undefined>(v: T): T | null {
  if (v == null) return null;
  if (typeof v === 'string') {
    return v.trim().length > 0 ? v : null;
  }
  return v;
}

/** Positive finite number, or null. NaN / 0 / negative / strings that
 *  don't parse all collapse to null so they don't satisfy completeness. */
function positiveNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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

  // Distinguish "lookup failed" (transient DB / network error) from "row
  // genuinely missing or incomplete". Callers show NOTHING on error so a
  // flaky request doesn't nag the user to complete a profile they've
  // already completed.
  if (error) {
    return { status: 'error', message: error.message || 'Lookup failed' };
  }
  if (!data) {
    return { status: 'ok', complete: false, missing: ['Profile not found'] };
  }

  // Each FICA field can live on its dedicated column OR inside the
  // legacy fica_documents JSON blob (older accounts migrated from the
  // JSON-only schema). nonBlank() normalizes empty strings so `??`
  // correctly falls through to the legacy value.
  const idNumber = nonBlank(data.id_number) ?? nonBlank(data.fica_documents?.id_number ?? null);
  const dob = nonBlank(data.date_of_birth) ?? nonBlank(data.fica_documents?.date_of_birth ?? null);
  const incomeRaw = data.monthly_income ?? data.fica_documents?.monthly_income ?? null;
  const income = positiveNumber(incomeRaw);

  const missing: string[] = [];
  if (!nonBlank(data.full_name)) missing.push(LABEL.fullName);
  if (!nonBlank(data.phone)) missing.push(LABEL.phone);
  if (!idNumber) missing.push(LABEL.idNumber);
  if (!dob) missing.push(LABEL.dateOfBirth);
  if (income == null) missing.push(LABEL.monthlyIncome);
  if (!nonBlank(data.proof_of_address_url)) missing.push(LABEL.proofOfAddress);

  return missing.length === 0
    ? { status: 'ok', complete: true, missing: [] }
    : { status: 'ok', complete: false, missing };
}
