// FICA document field persistence (CT7-014). Extracted from
// TenantProfileScreen so the read-modify-write sequence can be unit
// tested in isolation — SA review on PR #195 flagged a P1 bug where a
// read error was silently absorbed and the subsequent update erased
// the rest of the fica_documents JSON blob.
//
// Known limitation: concurrent writes can still race (two uploads in
// flight can read the same snapshot and overwrite each other). Realistic
// exposure is low — only one tenant edits their own profile, no
// background processes touch fica_documents. If this grows further
// we'll move to a Postgres RPC that does `jsonb_set` atomically.
//
// Security: the storage buckets used for these documents (id-documents,
// proof-of-income) MUST be configured as private in Supabase with RLS
// policies that allow authenticated users to read ONLY their own folder.
// This helper writes URLs/paths; it does not alter bucket policy.

import { supabase } from '@/src/lib/supabase';

export type FicaDocField = 'id_document_url' | 'salary_certificate_urls';

export async function persistFicaDocField(
  userId: string,
  field: FicaDocField,
  value: string | string[]
): Promise<void> {
  // Read current blob. If this fails we MUST NOT proceed to the update:
  // defaulting currentFica to {} would wipe every other field in the
  // fica_documents JSON (id_number, dob, monthly_income, etc.).
  const { data, error: readError } = await supabase
    .from('profiles')
    .select('fica_documents')
    .eq('id', userId)
    .single();

  if (readError) {
    throw new Error(
      `Could not load your profile to save ${field}. Please try again. (${readError.message})`
    );
  }

  const currentFica = ((data as { fica_documents?: unknown } | null)?.fica_documents ||
    {}) as Record<string, unknown>;

  const { error: writeError } = await supabase
    .from('profiles')
    // The generated DB types mark fica_documents as `Json | undefined`; our
    // merged value is a plain object literal that satisfies Json structurally
    // but TypeScript can't prove it, hence the cast.
    .update({ fica_documents: { ...currentFica, [field]: value } as never })
    .eq('id', userId);

  if (writeError) {
    throw new Error(`Could not save ${field}: ${writeError.message}`);
  }
}
