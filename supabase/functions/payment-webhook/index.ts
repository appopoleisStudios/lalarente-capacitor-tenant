// ============================================================================
// SUPABASE EDGE FUNCTION: payment-webhook
// ============================================================================
// Handles incoming payment notifications from PayFast (ITN) and Yoco webhooks.
// Updates payment statuses in the database and sends notifications.
//
// PayFast ITN: POST with form-encoded data + signature verification
// Yoco Webhook: POST with JSON payload + signature verification
//
// Environment variables required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (set automatically by Supabase)
//   PAYFAST_PASSPHRASE (your PayFast passphrase for signature verification)
//   YOCO_WEBHOOK_SECRET (your Yoco webhook signing secret)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import md5 from 'npm:blueimp-md5@2.19.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Signature Verification ──────────────────────────────────────────────────
// ⚠️ MUST use phpUrlEncode to match the checkout function's encoding.
// The checkout signs with phpUrlEncode (matching PHP's urlencode), and
// PayFast's server verifies against the same encoding. If the webhook
// uses a different encoding (e.g. encodeURIComponent), valid COMPLETE
// ITNs will produce mismatched signatures → 403 → money stuck pending.
//
// PHP's urlencode() vs JS's encodeURIComponent:
//   Space: JS=%20, PHP=+  → convert %20 to +
//   Asterisk: JS=%2A, PHP=*  → convert %2A to *
//   Tilde: JS=~, PHP=%7E  → omitted (rare in PayFast params)

function phpUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/%2A/g, '*');
}

function verifyPayFastSignature(
  params: Record<string, string>,
  passphrase: string
): boolean {
  const receivedSig = params.signature;
  if (!receivedSig) return false;

  // Build param string: sort alphabetically, exclude signature key
  // Use phpUrlEncode to match PHP's urlencode (same as checkout function)
  const sortedString = Object.entries(params)
    .filter(([key]) => key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${phpUrlEncode(value)}`)
    .join('&');

  const stringToHash = passphrase
    ? `${sortedString}&passphrase=${phpUrlEncode(passphrase)}`
    : sortedString;

  // Compute MD5 using blueimp-md5 (works in Deno Edge Functions)
  const expectedSig = md5(stringToHash);
  return expectedSig.toLowerCase() === receivedSig.toLowerCase();
}

// ─── PayFast ITN Handler ────────────────────────────────────────────────────

async function handlePayFastItn(
  supabase: ReturnType<typeof createClient>,
  formData: Record<string, string>
): Promise<Response> {
  const passphrase = Deno.env.get('PAYFAST_PASSPHRASE')?.trim() || '';
  const sandbox = Deno.env.get('PAYFAST_SANDBOX')?.trim() !== 'false';

  // Always verify when passphrase is configured (including sandbox).
  // Skipping signature checks lets anyone forge COMPLETE ITNs.
  if (passphrase) {
    const valid = verifyPayFastSignature(formData, passphrase);
    if (!valid) {
      console.error('❌ PayFast ITN: Invalid signature');
      return new Response('INVALID SIGNATURE', { status: 403 });
    }
  } else if (!sandbox) {
    console.error('❌ PayFast ITN: PAYFAST_PASSPHRASE not set in production');
    return new Response('MISCONFIGURED', { status: 500 });
  } else {
    console.warn('⚠️ PayFast ITN: no passphrase — signature not verified (sandbox only)');
  }

  const paymentId = formData.m_payment_id;
  const transactionId = formData.pf_payment_id;
  const paymentStatus = formData.payment_status?.toLowerCase();
  const amount = parseFloat(formData.amount_gross || '0');
  const fee = parseFloat(formData.fee || '0');

  if (!paymentId) {
    console.error('❌ PayFast ITN: Missing payment ID');
    return new Response('MISSING PAYMENT ID', { status: 400 });
  }

  console.log(`📥 PayFast ITN: payment=${paymentId}, status=${paymentStatus}, tx=${transactionId}`);

  // ── Route: try vendor_payments first, fall through to payments ───────
  const vendorResult = await handleVendorPayFastItn(supabase, formData, paymentId);
  // Must re-body: Response.text() consumes the stream — returning vendorResult
  // after .text() would send an empty body to PayFast and break ITN ack.
  const vendorBody = await vendorResult.text();

  if (vendorBody !== 'NOT_FOUND') {
    return new Response(vendorBody, { status: vendorResult.status });
  }

  // ── Existing payment flow (payments table) ────────────────────────────
  // Map PayFast status to internal status
  let newStatus: string;
  let failureReason: string | null = null;
  switch (paymentStatus) {
    case 'complete':
    case 'completed':
      newStatus = 'completed';
      break;
    case 'failed':
      newStatus = 'failed';
      failureReason = 'Payment declined by gateway';
      break;
    case 'cancelled':
      newStatus = 'pending';
      failureReason = 'Payment cancelled by user';
      break;
    case 'pending':
      newStatus = 'processing';
      break;
    default:
      console.warn(`⚠️ PayFast ITN: Unknown status "${paymentStatus}", keeping as processing`);
      newStatus = 'processing';
  }

  // Update payment record
  const updateData: Record<string, unknown> = {
    payment_gateway: 'payfast',
    transaction_id: transactionId || null,
    gateway_fee: isNaN(fee) ? null : fee,
    updated_at: new Date().toISOString(),
  };

  if (newStatus === 'completed') {
    updateData.status = 'completed';
    updateData.paid_date = new Date().toISOString();
  } else if (newStatus === 'failed') {
    updateData.status = 'failed';
    updateData.failure_reason = failureReason;
  } else {
    updateData.status = newStatus;
    if (failureReason) updateData.failure_reason = failureReason;
  }

  const { error: updateError } = await supabase
    .from('payments')
    .update(updateData)
    .eq('id', paymentId);

  if (updateError) {
    console.error('❌ PayFast ITN: DB update error:', updateError);
    return new Response('DB ERROR', { status: 500 });
  }

  // Send notification for completed/failed payments
  if (newStatus === 'completed') {
    await sendPaymentNotification(supabase, paymentId, 'completed');
  } else if (newStatus === 'failed') {
    await sendPaymentNotification(supabase, paymentId, 'failed');
  }

  // PayFast expects "OK" response for successful ITN processing
  return new Response('OK', { status: 200 });
}

// ─── Yoco Webhook Handler ───────────────────────────────────────────────────

async function handleYocoWebhook(
  supabase: ReturnType<typeof createClient>,
  body: Record<string, unknown>
): Promise<Response> {
  const webhookSecret = Deno.env.get('YOCO_WEBHOOK_SECRET')?.trim();
  if (!webhookSecret) {
    console.warn('⚠️ Yoco webhook: YOCO_WEBHOOK_SECRET not configured, skipping verification');
  }

  const eventType = body.type as string;
  const eventData = body.data as Record<string, unknown> | undefined;

  console.log(`📥 Yoco webhook: event=${eventType}`);

  if (!eventData) {
    return new Response('MISSING DATA', { status: 400 });
  }

  // Yoco sends different event types
  switch (eventType) {
    case 'charge.completed': {
      const metadata = eventData.metadata as Record<string, unknown> | undefined;
      const paymentId = metadata?.payment_id as string;
      const transactionId = eventData.id as string;
      const amountCents = eventData.amount as number;

      if (!paymentId) {
        console.error('❌ Yoco: Missing payment_id in metadata');
        return new Response('MISSING PAYMENT ID', { status: 400 });
      }

      await supabase
        .from('payments')
        .update({
          status: 'completed',
          payment_gateway: 'yoco',
          transaction_id: transactionId || null,
          paid_date: new Date().toISOString(),
          amount: amountCents ? amountCents / 100 : undefined, // Yoco sends cents
          updated_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', paymentId);

      await sendPaymentNotification(supabase, paymentId, 'completed');
      break;
    }
    case 'charge.failed': {
      const metadata = eventData.metadata as Record<string, unknown> | undefined;
      const paymentId = metadata?.payment_id as string;
      const failureMessage = (eventData.failure_message as string) || 'Payment failed';

      if (paymentId) {
        await supabase
          .from('payments')
          .update({
            status: 'failed',
            failure_reason: failureMessage,
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq('id', paymentId);

        await sendPaymentNotification(supabase, paymentId, 'failed');
      }
      break;
    }
    case 'charge.refunded': {
      const metadata = eventData.metadata as Record<string, unknown> | undefined;
      const paymentId = metadata?.payment_id as string;

      if (paymentId) {
        await supabase
          .from('payments')
          .update({
            status: 'refunded',
            updated_at: new Date().toISOString(),
          } as Record<string, unknown>)
          .eq('id', paymentId);
      }
      break;
    }
    default:
      console.log(`ℹ️ Yoco: Unhandled event type "${eventType}"`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

// ─── Notification Helpers ──────────────────────────────────────────────────

async function sendPaymentNotification(
  supabase: ReturnType<typeof createClient>,
  paymentId: string,
  status: 'completed' | 'failed'
): Promise<void> {
  try {
    // Fetch payment details for notification
    const { data: payment } = await supabase
      .from('payments')
      .select(`
        id, amount, type,
        tenant_id, owner_id,
        leases!inner(
          properties!property_id(title)
        )
      `)
      .eq('id', paymentId)
      .single();

    if (!payment) return;

    const property = (payment as any).leases?.properties as { title?: string } | undefined;
    const propertyTitle = property?.title || 'Property';
    const amountFormatted = `R ${((payment as any).amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
    const type = (payment as any).type || 'Payment';

    // Notify owner
    if ((payment as any).owner_id) {
      await supabase.from('notifications').insert({
        user_id: (payment as any).owner_id,
        type: status === 'completed' ? 'payment_received' : 'payment_failed',
        title: status === 'completed' ? 'Payment Received' : 'Payment Failed',
        body: status === 'completed'
          ? `${type} of ${amountFormatted} received for ${propertyTitle}`
          : `${type} of ${amountFormatted} failed for ${propertyTitle}`,
        data: { payment_id: paymentId, property_title: propertyTitle },
      } as any);
    }

    // Notify tenant
    if ((payment as any).tenant_id) {
      await supabase.from('notifications').insert({
        user_id: (payment as any).tenant_id,
        type: status === 'completed' ? 'payment_confirmed' : 'payment_failed',
        title: status === 'completed' ? 'Payment Confirmed' : 'Payment Failed',
        body: status === 'completed'
          ? `Your ${type} of ${amountFormatted} has been received.`
          : `Your ${type} of ${amountFormatted} was not successful. Please try again.`,
        data: { payment_id: paymentId, property_title: propertyTitle },
      } as any);
    }

    console.log(`✅ Notification sent for payment ${paymentId}: ${status}`);
  } catch (err) {
    console.error(`⚠️ Failed to send notification for payment ${paymentId}:`, err);
    // Non-critical — don't fail the webhook
  }
}

// ─── Vendor Payment Helpers ──────────────────────────────────────────────────

/** Write an entry to the vendor_payment_ledger journal */
async function writeVendorLedgerEntry(
  supabase: ReturnType<typeof createClient>,
  vendorPaymentId: string,
  entryType: string,
  amount: number,
  runningBalance: number,
  description: string
): Promise<void> {
  try {
    await supabase.from('vendor_payment_ledger').insert({
      vendor_payment_id: vendorPaymentId,
      entry_type: entryType,
      amount: amount,
      running_balance: runningBalance,
      description: description,
    } as any);
  } catch (err) {
    console.error(`⚠️ Failed to write ledger entry for ${vendorPaymentId}:`, err);
    // Non-critical — don't fail the webhook
  }
}

/** Send notification for vendor payment status changes */
async function sendVendorPaymentNotification(
  supabase: ReturnType<typeof createClient>,
  vendorPayment: any
): Promise<void> {
  try {
    const amountFormatted = `R ${(vendorPayment.total_amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
    const paymentId = vendorPayment.id;

    // Notify vendor
    if (vendorPayment.vendor_id) {
      await supabase.from('notifications').insert({
        user_id: vendorPayment.vendor_id,
        type: 'vendor_payment_received',
        title: 'Payment Received for Maintenance Job',
        body: `Payment of ${amountFormatted} received. Payout will be processed according to your schedule.`,
        data: { vendor_payment_id: paymentId },
      } as any);
    }

    // Notify owner
    if (vendorPayment.owner_id) {
      await supabase.from('notifications').insert({
        user_id: vendorPayment.owner_id,
        type: 'vendor_payment_completed',
        title: 'Vendor Payment Completed',
        body: `Payment of ${amountFormatted} has been completed for maintenance job.`,
        data: { vendor_payment_id: paymentId },
      } as any);
    }

    // Notify tenant
    if (vendorPayment.tenant_id) {
      await supabase.from('notifications').insert({
        user_id: vendorPayment.tenant_id,
        type: 'payment_confirmed',
        title: 'Payment Successful',
        body: `Your payment of ${amountFormatted} has been processed successfully.`,
        data: { vendor_payment_id: paymentId },
      } as any);
    }

    console.log(`✅ Vendor payment notification sent for ${paymentId}`);
  } catch (err) {
    console.error(`⚠️ Failed to send vendor payment notification:`, err);
  }
}

/** Handle PayFast ITN specifically for vendor_payments */
async function handleVendorPayFastItn(
  supabase: ReturnType<typeof createClient>,
  formData: Record<string, string>,
  paymentId: string
): Promise<Response> {
  const transactionId = formData.pf_payment_id;
  const paymentStatus = formData.payment_status?.toLowerCase();
  const amount = parseFloat(formData.amount_gross || '0');
  const fee = parseFloat(formData.fee || '0');

  console.log(`📥 Vendor PayFast ITN: vp=${paymentId}, status=${paymentStatus}, tx=${transactionId}`);

  // Fetch the vendor payment to verify it exists and get current state
  const { data: vp, error: vpError } = await supabase
    .from('vendor_payments')
    .select('*')
    .eq('id', paymentId)
    .single();

  if (vpError || !vp) {
    // Not a vendor payment — return null so caller falls through to existing logic
    return new Response('NOT_FOUND', { status: 200 });
  }

  const vendorPayment = vp as any;

  // ── Idempotency: already completed, or same pf_payment_id already stored ──
  if (vendorPayment.payment_status === 'completed') {
    console.log(`ℹ️ Vendor payment ${paymentId} already completed — skipping duplicate ITN`);
    return new Response('OK', { status: 200 });
  }
  if (
    transactionId &&
    vendorPayment.gateway_transaction_id &&
    vendorPayment.gateway_transaction_id === transactionId
  ) {
    console.log(`ℹ️ Vendor payment ${paymentId} already has tx ${transactionId} — skipping`);
    return new Response('OK', { status: 200 });
  }

  // ── Amount verification ──────────────────────────────────────────────
  if (Math.abs(amount - vendorPayment.total_amount) > 0.01) {
    console.error(`❌ Amount mismatch: ITN says ${amount}, vendor_payment says ${vendorPayment.total_amount}`);
    // Fail the payment so admin can investigate
    await supabase
      .from('vendor_payments')
      .update({
        payment_status: 'failed',
        gateway_response: { error: 'Amount mismatch', itn_amount: amount, expected: vendorPayment.total_amount },
        gateway_transaction_id: transactionId || null,
        gateway_fee: isNaN(fee) ? 0 : fee,
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', paymentId)
      .in('payment_status', ['pending', 'processing']);
    return new Response('AMOUNT_MISMATCH', { status: 200 });
  }

  // ── Map PayFast status to vendor payment status ───────────────────────
  let newPaymentStatus: string;
  switch (paymentStatus) {
    case 'complete':
    case 'completed':
      newPaymentStatus = 'completed';
      break;
    case 'failed':
      newPaymentStatus = 'failed';
      break;
    case 'cancelled':
      newPaymentStatus = 'cancelled';
      break;
    default:
      newPaymentStatus = 'processing';
  }

  // ── Only transition from pending|processing ──────────────────────────
  const allowedPrevStates = ['pending', 'processing'];
  if (!allowedPrevStates.includes(vendorPayment.payment_status)) {
    console.log(`ℹ️ Vendor payment ${paymentId} status is ${vendorPayment.payment_status} — not transitioning`);
    return new Response('OK', { status: 200 });
  }

  // ── Update with status guard (mitigates concurrent ITN race) ──────────
  const updateData: Record<string, unknown> = {
    payment_status: newPaymentStatus,
    gateway_transaction_id: transactionId || null,
    gateway_fee: isNaN(fee) ? 0 : fee,
    gateway_response: {
      itn_received_at: new Date().toISOString(),
      payment_status: paymentStatus,
    },
    updated_at: new Date().toISOString(),
  };

  if (newPaymentStatus === 'completed') {
    updateData.paid_at = new Date().toISOString();
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('vendor_payments')
    .update(updateData)
    .eq('id', paymentId)
    .in('payment_status', ['pending', 'processing'])
    .select('id');

  if (updateError) {
    console.error('❌ Vendor payment ITN: DB update error:', updateError);
    return new Response('DB_ERROR', { status: 500 });
  }

  if (!updatedRows?.length) {
    console.log(`ℹ️ Vendor payment ${paymentId} was already transitioned by another ITN — skipping side effects`);
    return new Response('OK', { status: 200 });
  }

  // ── Notify on failure ─────────────────────────────────────────────────
  if (newPaymentStatus === 'failed' || newPaymentStatus === 'cancelled') {
    try {
      await supabase.from('notifications').insert({
        user_id: vendorPayment.tenant_id,
        type: 'payment_failed',
        title: 'Payment Failed',
        body: `Your payment of R ${vendorPayment.total_amount.toLocaleString('en-ZA', { minimumFractionDigits: 2 })} was not successful. Please try again.`,
        data: { vendor_payment_id: paymentId },
      } as any);
      console.log(`✅ Failure notification sent for vendor payment ${paymentId}`);
    } catch (err) {
      console.error(`⚠️ Failed to send failure notification:`, err);
    }
  }    // ── On completion: write ledger entries + update invoice + notify ─────
  if (newPaymentStatus === 'completed') {
    const gatewayFee = isNaN(fee) ? 0 : fee;

    // ── Atomically update invoice to paid (status-guarded) ────────────
    // Using .eq('status', 'approved') ensures we don't overwrite a
    // concurrent change. This prevents double-paid and race conditions
    // where the invoice was already paid by another ITN or admin action.
    const { error: invoiceUpdateError } = await supabase
      .from('maintenance_invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        payment_reference: transactionId || null,
      } as any)
      .eq('id', vendorPayment.invoice_id)
      .eq('status', 'approved');  // Atomic guard: only update if approved

    if (invoiceUpdateError) {
      console.error(`⚠️ Failed to update invoice ${vendorPayment.invoice_id} to paid:`, invoiceUpdateError);
      // Non-fatal — payment is still completed, invoice can be reconciled manually
    } else {
      console.log(`✅ Invoice ${vendorPayment.invoice_id} marked as paid`);
    }

    // Ledger: payment received
    await writeVendorLedgerEntry(
      supabase, paymentId, 'payment_received',
      vendorPayment.total_amount, vendorPayment.total_amount,
      'PayFast payment received'
    );

    // Ledger: platform fee
    const runningAfterFee = vendorPayment.total_amount - vendorPayment.platform_fee;
    await writeVendorLedgerEntry(
      supabase, paymentId, 'platform_fee',
      -vendorPayment.platform_fee, runningAfterFee,
      `Platform fee (${vendorPayment.platform_fee_percent}%)`
    );

    // Ledger: gateway fee
    const runningAfterGateway = runningAfterFee - gatewayFee;
    await writeVendorLedgerEntry(
      supabase, paymentId, 'gateway_fee',
      -gatewayFee, runningAfterGateway,
      'PayFast transaction fee'
    );

    // Send notifications
    await sendVendorPaymentNotification(supabase, vendorPayment);
  }

  return new Response('OK', { status: 200 });
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Determine gateway by content type
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      // PayFast ITN — form-encoded POST
      const text = await req.text();
      const params = new URLSearchParams(text);
      const formData: Record<string, string> = {};
      params.forEach((value, key) => { formData[key] = value; });
      return await handlePayFastItn(supabase, formData);
    } else {
      // Yoco webhook — JSON POST
      const body = await req.json();
      return await handleYocoWebhook(supabase, body);
    }

  } catch (error) {
    console.error('❌ Payment webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(error) }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

// ============================================================================
// DEPLOYMENT INSTRUCTIONS
// ============================================================================
/*
1. Deploy the function:
   npx supabase functions deploy payment-webhook

2. Set environment variables in Supabase Dashboard:
   - Go to Edge Functions → payment-webhook → Settings → Environment Variables
   - Add:
     * PAYFAST_PASSPHRASE (your PayFast passphrase)
     * YOCO_WEBHOOK_SECRET (your Yoco webhook secret)
     * (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set automatically)

3. Configure PayFast ITN URL:
   - Log into your PayFast dashboard
   - Set ITN URL to: https://[project-ref].supabase.co/functions/v1/payment-webhook
   - Ensure "Real-time Transaction Notification" is enabled

4. Configure Yoco webhook:
   - Log into your Yoco dashboard
   - Add webhook endpoint: https://[project-ref].supabase.co/functions/v1/payment-webhook
   - Subscribe to events: charge.completed, charge.failed, charge.refunded

5. Test manually:
   # Simulate PayFast ITN
   curl -X POST https://[project-ref].supabase.co/functions/v1/payment-webhook \\
     -H "Content-Type: application/x-www-form-urlencoded" \\
     -d "m_payment_id=test-123&payment_status=complete&pf_payment_id=tx-456&amount_gross=1500.00"

   # Simulate Yoco webhook
   curl -X POST https://[project-ref].supabase.co/functions/v1/payment-webhook \\
     -H "Content-Type: application/json" \\
     -d '{"type":"charge.completed","data":{"id":"ch_test_123","amount":150000,"metadata":{"payment_id":"test-456"}}}'
*/
