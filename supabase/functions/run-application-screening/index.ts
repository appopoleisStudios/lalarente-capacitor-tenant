// ============================================================================
// SUPABASE EDGE FUNCTION: run-application-screening
// ============================================================================
// LAL-121 — Owner-triggered screening for a rental application.
// Always: RSA ID checksum + ID document + affordability (rent ≤ 30% income)
//         + reference documents.
// Optional: Onfido identity when ONFIDO_API_TOKEN is set (never fake a bureau).
// Auth: JWT must be the application's owner_id.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Official DHA / SARS 13-digit ID checksum (not vanilla Luhn). */
function isValidSouthAfricanId(raw: unknown): boolean {
  const s = String(raw || '').replace(/\s/g, '');
  if (!/^\d{13}$/.test(s)) return false;
  const mm = parseInt(s.slice(2, 4), 10);
  const dd = parseInt(s.slice(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  if (s[10] !== '0' && s[10] !== '1') return false;
  let odd = 0;
  for (let i = 0; i < 12; i += 2) odd += Number(s[i]);
  let evenStr = '';
  for (let i = 1; i < 12; i += 2) evenStr += s[i];
  const evenDoubled = String(Number(evenStr) * 2);
  let evenSum = 0;
  for (const c of evenDoubled) evenSum += Number(c);
  const check = (10 - ((odd + evenSum) % 10)) % 10;
  return check === Number(s[12]);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return json(401, { error: 'Unauthorized' });
    }

    const body = await req.json().catch(() => ({}));
    const applicationId = String(body.application_id || body.applicationId || '').trim();
    if (!applicationId) {
      return json(400, { error: 'application_id is required' });
    }

    const { data: app, error: appErr } = await supabase
      .from('rental_applications')
      .select(
        'id, owner_id, id_number, id_document_url, monthly_income, proof_of_income_urls, reference_urls, property_id, full_name, date_of_birth'
      )
      .eq('id', applicationId)
      .single();
    if (appErr || !app) {
      return json(404, { error: 'Application not found' });
    }
    if (app.owner_id !== user.id) {
      return json(403, { error: 'Only the property owner can run screening.' });
    }

    const { data: property } = await supabase
      .from('properties')
      .select('id, rent_amount, title')
      .eq('id', app.property_id)
      .single();

    const rent = Number(property?.rent_amount || 0);
    const income = Number(app.monthly_income || 0);
    const ratio = income > 0 ? rent / income : 1;
    const affordable = income > 0 && ratio <= 0.3;
    const idValid = isValidSouthAfricanId(app.id_number);
    const hasIdDoc = Boolean(app.id_document_url);
    const hasIncomeProof =
      Array.isArray(app.proof_of_income_urls) && app.proof_of_income_urls.length > 0;
    const hasReferences = Array.isArray(app.reference_urls) && app.reference_urls.length > 0;

    const onfidoToken = Deno.env.get('ONFIDO_API_TOKEN') || '';
    let onfido: Record<string, unknown> | null = null;
    if (onfidoToken) {
      try {
        const createRes = await fetch('https://api.eu.onfido.com/v3.6/applicants', {
          method: 'POST',
          headers: {
            Authorization: `Token token=${onfidoToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            first_name: String(app.full_name || 'Applicant').split(/\s+/)[0] || 'Applicant',
            last_name:
              String(app.full_name || 'Applicant')
                .split(/\s+/)
                .slice(1)
                .join(' ') || 'Unknown',
            dob: app.date_of_birth || undefined,
          }),
        });
        const createBody = await createRes.json().catch(() => ({}));
        onfido = {
          attempted: true,
          http_status: createRes.status,
          applicant_id: createBody.id || null,
          error: createRes.ok ? null : createBody.error || createBody.message || 'Onfido rejected',
        };
      } catch (e) {
        onfido = {
          attempted: true,
          error: e instanceof Error ? e.message : 'Onfido request failed',
        };
      }
    }

    const identityPass = idValid && hasIdDoc && (!onfido || !onfido.error);
    const creditPass = affordable && hasIncomeProof;
    const backgroundPass = hasReferences;

    const identityStatus = identityPass ? 'verified' : 'failed';
    const creditStatus = creditPass ? 'completed' : 'failed';
    const backgroundStatus = backgroundPass ? 'completed' : 'failed';

    const identityReasons: string[] = [];
    if (!idValid) identityReasons.push('RSA ID number failed checksum / format');
    if (!hasIdDoc) identityReasons.push('No ID document uploaded');
    if (onfido?.error) identityReasons.push(`Onfido: ${onfido.error}`);

    const creditReasons: string[] = [];
    if (!hasIncomeProof) creditReasons.push('No proof of income uploaded');
    if (income <= 0) creditReasons.push('Declared monthly income missing');
    else if (!affordable) {
      creditReasons.push(
        `Rent-to-income ${(ratio * 100).toFixed(1)}% exceeds 30% threshold (rent R${rent.toFixed(0)} / income R${income.toFixed(0)})`
      );
    }

    const backgroundReasons: string[] = [];
    if (!hasReferences) backgroundReasons.push('No reference documents uploaded');

    const now = new Date().toISOString();
    const creditResult = {
      source: onfidoToken ? 'lalarente_screening+onfido' : 'lalarente_screening',
      ran_at: now,
      rent,
      income,
      affordability_ratio: ratio,
      threshold: 0.3,
      pass: creditPass,
      reasons: creditReasons,
      bureau: 'none',
    };
    const backgroundResult = {
      source: 'lalarente_screening',
      ran_at: now,
      references_count: Array.isArray(app.reference_urls) ? app.reference_urls.length : 0,
      pass: backgroundPass,
      reasons: backgroundReasons,
      bureau: 'none',
    };

    const { error: updErr } = await supabase
      .from('rental_applications')
      .update({
        identity_verification_status: identityStatus,
        credit_check_status: creditStatus,
        background_check_status: backgroundStatus,
        credit_check_at: now,
        credit_check_result: creditResult,
        background_check_result: backgroundResult,
        affordability_ratio: ratio,
        risk_level: identityPass && creditPass && backgroundPass ? 'low' : 'high',
        reviewed_at: now,
      })
      .eq('id', applicationId);
    if (updErr) {
      return json(500, { error: updErr.message || 'Failed to save screening results' });
    }

    const summary = [
      identityPass
        ? 'Identity: verified (RSA ID + document)'
        : `Identity: failed (${identityReasons.join('; ')})`,
      creditPass
        ? `Affordability: pass (${(ratio * 100).toFixed(1)}% rent-to-income)`
        : `Affordability: failed (${creditReasons.join('; ')})`,
      backgroundPass
        ? 'Background: references on file'
        : `Background: failed (${backgroundReasons.join('; ')})`,
      onfidoToken
        ? onfido?.error
          ? 'Onfido: error'
          : 'Onfido: applicant created'
        : 'Onfido: not configured',
    ].join(' · ');

    return json(200, {
      success: true,
      application_id: applicationId,
      identity_status: identityStatus,
      credit_status: creditStatus,
      background_status: backgroundStatus,
      identity_reasons: identityReasons,
      credit_reasons: creditReasons,
      background_reasons: backgroundReasons,
      onfido,
      summary,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'Internal error' });
  }
});
