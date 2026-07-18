// ============================================================================
// SUPABASE EDGE FUNCTION: get-vendor-earnings
// ============================================================================
// Returns earnings summary and transaction history for a vendor.
//
// This function is the vendor-facing API for the earnings dashboard.
// It aggregates data from vendor_payments and vendor_payment_ledger.
//
// Environment variables:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected by Supabase)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// ─── Shared encryption helpers (mirrors save-vendor-payout-preferences) ────

async function getEncryptionKey(): Promise<CryptoKey> {
  const rawHex = Deno.env.get('PAYOUT_ENCRYPTION_KEY');
  if (!rawHex) {
    throw new Error('PAYOUT_ENCRYPTION_KEY is not configured');
  }
  const hexBytes = rawHex.match(/.{1,2}/g)!.map(b => parseInt(b, 16));
  if (hexBytes.length !== 32) {
    throw new Error('PAYOUT_ENCRYPTION_KEY must be exactly 32 bytes (64 hex chars)');
  }
  const keyBytes = new Uint8Array(32);
  keyBytes.set(hexBytes.slice(0, 32));
  return await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']
  );
}

async function decryptAccountNumber(encrypted: string): Promise<string | null> {
  try {
    const key = await getEncryptionKey();
    const parts = encrypted.split(':');
    if (parts.length < 2) return null;
    const iv = Uint8Array.from(atob(parts[0]), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, ciphertext
    );
    return new TextDecoder().decode(plaintext);
  } catch { return null; }
}

function maskAccountNumber(accountNumber: string): string {
  const cleaned = accountNumber.replace(/\s/g, '');
  if (cleaned.length <= 4) return `****${cleaned}`;
  return `****${cleaned.slice(-4)}`;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VendorEarningsResponse {
  summary: {
    total_earned_all_time: number;
    total_platform_fees: number;
    total_payout_fees: number;
    net_earnings: number;
    pending_payout_count: number;
    pending_payout_total: number;
    next_scheduled_payout_date: string | null;
    payout_schedule: string;
  };
  recent_transactions: Array<{
    id: string;
    invoice_number: string | null;
    maintenance_title: string | null;
    total_amount: number;
    vendor_payout: number;
    platform_fee: number;
    gateway_fee: number;
    payout_fee: number;
    payment_status: string;
    payout_status: string;
    paid_at: string | null;
    created_at: string;
  }>;
  preferences: {
    schedule: string;
    bank_account_name: string | null;
    bank_name: string | null;
    branch_code: string | null;
    account_type: string | null;
    account_number_masked: string | null;
  } | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT and extract user ID
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vendorId = user.id;

    // ── Verifiy vendor role ─────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', vendorId)
      .single();

    if (!profile || (profile as any).role !== 'vendor') {
      return new Response(JSON.stringify({ error: 'Forbidden: vendor access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Fetch ALL payments for accurate summary (no row limit) ──────────
    // recent_transactions will slice the first 50 from this set.
    const { data: allPayments } = await supabase
      .from('vendor_payments')
      .select(`
        id, total_amount, platform_fee, gateway_fee, payout_fee, vendor_payout,
        payment_status, payout_status, paid_at, created_at,
        invoice:invoice_id(invoice_number),
        maintenance_request:maintenance_request_id(title)
      `)
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    const allRows = (allPayments || []) as any[];

    // Summary from all rows (no limit)
    const completedRows = allRows.filter(p => p.payment_status === 'completed');
    const totalEarnedAllTime = completedRows.reduce((s, p) => s + parseFloat(p.vendor_payout || 0), 0);
    const totalPlatformFees = completedRows.reduce((s, p) => s + parseFloat(p.platform_fee || 0), 0);
    const totalPayoutFees = completedRows.reduce((s, p) => s + parseFloat(p.payout_fee || 0), 0);

    // Pending payouts (completed payment but payout not yet sent)
    const pendingPayouts = allRows.filter(
      p => p.payment_status === 'completed' && p.payout_status === 'pending'
    );
    const pendingPayoutTotal = pendingPayouts.reduce((s, p) => s + parseFloat(p.vendor_payout || 0), 0);

    // ── Recent 50 transactions (for display) ────────────────────────────
    const recentPayments = allRows.slice(0, 50);

    // ── Fetch payout preferences ────────────────────────────────────────
    const { data: prefs } = await supabase
      .from('vendor_payout_preferences')
      .select('schedule, bank_account_name, bank_name, branch_code, account_type, account_number_encrypted')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    // ── Decrypt & mask account number for display ──────────────────────
    let accountNumberMasked: string | null = null;
    if (prefs) {
      const enc = (prefs as any).account_number_encrypted;
      if (enc) {
        const decrypted = await decryptAccountNumber(enc);
        if (decrypted) {
          accountNumberMasked = maskAccountNumber(decrypted);
        }
      }
    }

    const preferences = prefs ? {
      schedule: (prefs as any).schedule || 'weekly',
      bank_account_name: (prefs as any).bank_account_name || null,
      bank_name: (prefs as any).bank_name || null,
      branch_code: (prefs as any).branch_code || null,
      account_type: (prefs as any).account_type || null,
      account_number_masked: accountNumberMasked,
    } : null;

    // ── Calculate next payout date ──────────────────────────────────────
    const schedule = (prefs as any)?.schedule || 'weekly';
    let nextPayoutDate: string | null = null;

    if (pendingPayouts.length > 0) {
      const now = new Date();
      switch (schedule) {
        case 'weekly': {
          // Next Monday
          const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
          const nextMon = new Date(now);
          nextMon.setDate(now.getDate() + daysUntilMonday);
          nextMon.setHours(9, 0, 0, 0); // 9 AM
          nextPayoutDate = nextMon.toISOString();
          break;
        }
        case 'daily': {
          // Next business day (skip weekends for simplicity)
          const tomorrow = new Date(now);
          tomorrow.setDate(now.getDate() + 1);
          if (tomorrow.getDay() === 0) tomorrow.setDate(tomorrow.getDate() + 1); // Skip Sunday
          if (tomorrow.getDay() === 6) tomorrow.setDate(tomorrow.getDate() + 2); // Skip Saturday
          tomorrow.setHours(9, 0, 0, 0);
          nextPayoutDate = tomorrow.toISOString();
          break;
        }
        case 'instant': {
          // Same business day if before cutoff
          const cutoffHour = 14; // 2 PM cutoff
          if (now.getHours() < cutoffHour && now.getDay() !== 0 && now.getDay() !== 6) {
            nextPayoutDate = now.toISOString();
          } else {
            const nextBusinessDay = new Date(now);
            nextBusinessDay.setDate(now.getDate() + 1);
            if (nextBusinessDay.getDay() === 0) nextBusinessDay.setDate(nextBusinessDay.getDate() + 1);
            if (nextBusinessDay.getDay() === 6) nextBusinessDay.setDate(nextBusinessDay.getDate() + 2);
            nextBusinessDay.setHours(9, 0, 0, 0);
            nextPayoutDate = nextBusinessDay.toISOString();
          }
          break;
        }
      }
    }

    // ── Build response ──────────────────────────────────────────────────
    const response: VendorEarningsResponse = {
      summary: {
        total_earned_all_time: Math.round(totalEarnedAllTime * 100) / 100,
        total_platform_fees: Math.round(totalPlatformFees * 100) / 100,
        total_payout_fees: Math.round(totalPayoutFees * 100) / 100,
        // vendor_payout already nets out platform_fee and payout_fee,
        // so totalEarnedAllTime (= sum of vendor_payout) is the true net
        net_earnings: Math.round(totalEarnedAllTime * 100) / 100,
        pending_payout_count: pendingPayouts.length,
        pending_payout_total: Math.round(pendingPayoutTotal * 100) / 100,
        next_scheduled_payout_date: nextPayoutDate,
        payout_schedule: schedule,
      },
      recent_transactions: recentPayments.map(p => ({
        id: p.id,
        invoice_number: p.invoice?.invoice_number || null,
        maintenance_title: p.maintenance_request?.title || null,
        total_amount: parseFloat(p.total_amount),
        vendor_payout: parseFloat(p.vendor_payout),
        platform_fee: parseFloat(p.platform_fee),
        gateway_fee: parseFloat(p.gateway_fee || 0),
        payout_fee: parseFloat(p.payout_fee || 0),
        payment_status: p.payment_status,
        payout_status: p.payout_status,
        paid_at: p.paid_at,
        created_at: p.created_at,
      })),
      preferences,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ get-vendor-earnings error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
