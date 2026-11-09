import { supabase } from '@/src/lib/supabase';

export type TaxCategory =
  | 'municipal_rates'
  | 'municipal_levies'
  | 'sectional_title_levy'
  | 'bond_interest'
  | 'insurance'
  | 'other';

export type Deductibility = 'allowable' | 'capital' | 'mixed_use' | 'private' | 'uncertain';

export interface PropertyTaxPayment {
  id: string;
  property_id: string;
  owner_id: string;
  category: TaxCategory;
  description: string | null;
  amount: number;
  paid_on: string;
  deductibility: Deductibility;
  apportionment_pct: number | null;
  document_url: string | null;
  created_at: string;
}

export interface CreateTaxPaymentInput {
  property_id: string;
  category: TaxCategory;
  description?: string;
  amount: number;
  paid_on: string;
  deductibility: Deductibility;
  apportionment_pct?: number | null;
  document_url?: string | null;
}

export interface TaxExpensesByCategory {
  category: TaxCategory;
  total: number;
  deductible: number;
}

export const CATEGORY_LABELS: Record<TaxCategory, string> = {
  municipal_rates: 'Municipal Rates',
  municipal_levies: 'Municipal Levies',
  sectional_title_levy: 'Sectional Title Levy',
  bond_interest: 'Bond Interest',
  insurance: 'Insurance',
  other: 'Other',
};

export const DEDUCTIBILITY_LABELS: Record<Deductibility, string> = {
  allowable: 'Fully deductible against rental income',
  capital: 'Capital expenditure (not deductible)',
  mixed_use: "Shared with personal use — I'll apportion",
  private: 'Private / non-rental',
  uncertain: "Not sure yet — I'll classify later",
};

export async function getTaxPayments(propertyId: string): Promise<PropertyTaxPayment[]> {
  const { data, error } = await (supabase as any)
    .from('property_tax_payments')
    .select('*')
    .eq('property_id', propertyId)
    .order('paid_on', { ascending: false });
  if (error) throw error;
  return (data || []) as PropertyTaxPayment[];
}

export async function createTaxPayment(input: CreateTaxPaymentInput): Promise<PropertyTaxPayment> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await (supabase as any)
    .from('property_tax_payments')
    .insert({
      property_id: input.property_id,
      owner_id: user.id,
      category: input.category,
      description: input.description || null,
      amount: input.amount,
      paid_on: input.paid_on,
      deductibility: input.deductibility,
      apportionment_pct:
        input.deductibility === 'mixed_use' ? (input.apportionment_pct ?? null) : null,
      document_url: input.document_url || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PropertyTaxPayment;
}

export async function updateTaxPayment(
  id: string,
  input: Partial<CreateTaxPaymentInput>
): Promise<void> {
  const update: Record<string, unknown> = { ...input };
  if ('deductibility' in update && update.deductibility !== 'mixed_use') {
    update.apportionment_pct = null;
  }
  const { error } = await (supabase as any)
    .from('property_tax_payments')
    .update(update)
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTaxPayment(id: string): Promise<void> {
  const { error } = await (supabase as any).from('property_tax_payments').delete().eq('id', id);
  if (error) throw error;
}

export async function getTaxExpensesByYear(
  ownerId: string,
  taxYearStart: string,
  taxYearEnd: string
): Promise<PropertyTaxPayment[]> {
  // Half-open range: paid_on >= start AND paid_on < end+1day
  // so Feb 29 in leap years is included. taxYearEnd = 'YYYY-03-01' (exclusive).
  const { data, error } = await (supabase as any)
    .from('property_tax_payments')
    .select('*')
    .eq('owner_id', ownerId)
    .gte('paid_on', taxYearStart)
    .lt('paid_on', taxYearEnd);
  if (error) throw error;
  return (data || []) as PropertyTaxPayment[];
}

export function paymentDeductible(p: PropertyTaxPayment): number {
  if (p.deductibility === 'allowable') return p.amount;
  if (p.deductibility === 'mixed_use' && p.apportionment_pct != null)
    return p.amount * (p.apportionment_pct / 100);
  return 0;
}

export function summariseByCategory(payments: PropertyTaxPayment[]): TaxExpensesByCategory[] {
  const map: Record<string, { total: number; deductible: number }> = {};
  for (const p of payments) {
    if (!map[p.category]) map[p.category] = { total: 0, deductible: 0 };
    map[p.category].total += p.amount;
    map[p.category].deductible += paymentDeductible(p);
  }
  return Object.entries(map).map(([category, vals]) => ({
    category: category as TaxCategory,
    ...vals,
  }));
}

export function totalDeductible(payments: PropertyTaxPayment[]): number {
  return payments.reduce((sum, p) => sum + paymentDeductible(p), 0);
}
