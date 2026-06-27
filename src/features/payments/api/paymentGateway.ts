/**
 * Payment Gateway Integration
 *
 * This file provides client-side payment gateway integration for South
 * African payment gateways:
 * - PayFast (https://www.payfast.co.za)
 * - Yoco (https://www.yoco.com)
 *
 * ⚠️ SECURITY: All secret keys (PayFast passphrase, Yoco secretKey) are
 * handled server-side by the `payment-gateway` Supabase Edge Function.
 * The client only holds public identifiers (sandbox flag, Yoco publicKey).
 *
 * Setup Requirements:
 * 1. Create merchant accounts with PayFast and/or Yoco
 * 2. Set secrets as Supabase Edge Function env vars:
 *    - PAYFAST_MERCHANT_ID, PAYFAST_MERCHANT_KEY, PAYFAST_PASSPHRASE
 *    - YOCO_SECRET_KEY
 * 3. Deploy: npx supabase functions deploy payment-gateway
 * 4. Add public keys to .env (EXPO_PUBLIC_YOCO_PUBLIC_KEY, EXPO_PUBLIC_PAYFAST_SANDBOX)
 */

import { supabase } from '../../../lib/supabase';
import { env } from '../../../core/config/env';

export interface PaymentGatewayConfig {
  gateway: 'payfast' | 'yoco';
  sandbox: boolean;
}

export interface PaymentRequest {
  paymentId: string;
  amount: number;
  itemName: string;
  itemDescription?: string;
  buyerEmail: string;
  buyerFirstName?: string;
  buyerLastName?: string;
  returnUrl: string;
  cancelUrl: string;
  notifyUrl: string;
}

export interface PaymentResponse {
  success: boolean;
  redirectUrl?: string;
  transactionId?: string;
  error?: string;
}

export interface WebhookPayload {
  gateway: 'payfast' | 'yoco';
  paymentId: string;
  transactionId: string;
  status: 'completed' | 'failed' | 'cancelled';
  amount: number;
  timestamp: string;
  signature?: string;
  rawPayload: any;
}

/**
 * PayFast Configuration (public fields only — passphrase is server-side)
 * Documentation: https://developers.payfast.co.za/docs
 */
export const payfastConfig: PaymentGatewayConfig = {
  gateway: 'payfast',
  sandbox: env.payfast.sandbox,
};

/**
 * Yoco Configuration (public fields only — secretKey is server-side)
 * Documentation: https://developer.yoco.com/online/
 */
export const yocoConfig: PaymentGatewayConfig = {
  gateway: 'yoco',
  sandbox: env.yoco.sandbox,
};

/**
 * Generate PayFast payment URL via server-side Edge Function.
 * The passphrase and merchant_key are managed server-side to avoid
 * exposing them in the client APK bundle.
 */
async function generatePayFastPaymentUrlViaEdge(
  request: PaymentRequest
): Promise<PaymentResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('payment-gateway', {
      body: {
        action: 'generate-payfast-url',
        paymentId: request.paymentId,
        amount: request.amount,
        itemName: request.itemName,
        itemDescription: request.itemDescription,
        buyerEmail: request.buyerEmail,
        buyerFirstName: request.buyerFirstName,
        buyerLastName: request.buyerLastName,
        returnUrl: request.returnUrl,
        cancelUrl: request.cancelUrl,
        notifyUrl: request.notifyUrl,
      },
    });

    if (error) {
      console.error('payment-gateway edge function error:', error);
      return { success: false, error: 'Payment gateway unavailable' };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to generate payment URL' };
    }

    return { success: true, redirectUrl: data.redirectUrl };
  } catch (err) {
    console.error('Error calling payment-gateway edge function:', err);
    return { success: false, error: 'Payment gateway unavailable' };
  }
}

/**
 * Create Yoco checkout session via server-side Edge Function.
 * The secretKey is managed server-side to avoid exposing it in the client APK.
 */
async function createYocoCheckoutViaEdge(
  request: PaymentRequest
): Promise<PaymentResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('payment-gateway', {
      body: {
        action: 'create-yoco-checkout',
        amount: request.amount,
        paymentId: request.paymentId,
        returnUrl: request.returnUrl,
        cancelUrl: request.cancelUrl,
      },
    });

    if (error) {
      console.error('payment-gateway edge function error:', error);
      return { success: false, error: 'Payment gateway unavailable' };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Failed to create checkout' };
    }

    return {
      success: true,
      redirectUrl: data.redirectUrl,
      transactionId: data.transactionId,
    };
  } catch (err) {
    console.error('Error calling payment-gateway edge function:', err);
    return { success: false, error: 'Payment gateway unavailable' };
  }
}

/**
 * Process payment webhook
 * Called by the backend webhook endpoint when payment status changes.
 * Webhook signature verification is performed server-side.
 */
export async function processPaymentWebhook(
  payload: WebhookPayload
): Promise<void> {
  try {
    const { paymentId, transactionId, status, gateway } = payload;

    const updateData: any = {
      payment_gateway: gateway,
      transaction_id: transactionId,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed') {
      updateData.status = 'completed';
      updateData.paid_date = new Date().toISOString();
    } else if (status === 'failed') {
      updateData.status = 'failed';
      updateData.failure_reason = 'Payment declined by gateway';
    } else if (status === 'cancelled') {
      updateData.status = 'pending';
      updateData.failure_reason = 'Payment cancelled by user';
    }

    const { error } = await supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId);

    if (error) {
      console.error('Error updating payment from webhook:', error);
      throw error;
    }

    console.log(`Payment ${paymentId} updated: ${status}`);
  } catch (error) {
    console.error('Error processing payment webhook:', error);
    throw error;
  }
}

/**
 * Initiate a payment
 * Main entry point for starting a payment flow.
 * Calls the Edge Function for signed URLs or checkout sessions.
 */
export async function initiatePayment(
  paymentId: string,
  gateway: 'payfast' | 'yoco' = 'payfast'
): Promise<PaymentResponse> {
  try {
    // Get payment details
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select(`
        *,
        tenant:profiles!tenant_id(email, full_name),
        property:properties!property_id(title)
      `)
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return { success: false, error: 'Payment not found' };
    }

    const tenant = payment.tenant as any;
    const property = payment.property as any;
    const names = (tenant?.full_name || '').split(' ');

    const request: PaymentRequest = {
      paymentId: payment.id,
      amount: payment.amount,
      itemName: `Rent Payment - ${property?.title || 'Property'}`,
      itemDescription: `${payment.type} payment for ${property?.title}`,
      buyerEmail: tenant?.email || '',
      buyerFirstName: names[0] || '',
      buyerLastName: names.slice(1).join(' ') || '',
      returnUrl: 'https://yourapp.com/payments/success',
      cancelUrl: 'https://yourapp.com/payments/cancel',
      notifyUrl: 'https://yourapp.com/api/webhooks/payments',
    };

    // Update payment status to processing
    await supabase
      .from('payments')
      .update({ status: 'processing', payment_gateway: gateway })
      .eq('id', paymentId);

    // Generate payment URL/session via Edge Function
    if (gateway === 'payfast') {
      return await generatePayFastPaymentUrlViaEdge(request);
    } else if (gateway === 'yoco') {
      return await createYocoCheckoutViaEdge(request);
    }

    return { success: false, error: 'Invalid payment gateway' };
  } catch (error: any) {
    console.error('Error initiating payment:', error);
    return { success: false, error: error.message || 'Failed to initiate payment' };
  }
}

/**
 * Payment retry logic
 * Implements exponential backoff for failed payments
 */
export const RETRY_SCHEDULE = {
  maxRetries: 3,
  delays: [24, 48, 72], // Hours between retries
};

export async function schedulePaymentRetry(paymentId: string): Promise<boolean> {
  try {
    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('retry_count, max_retry_count')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return false;
    }

    const currentRetry = payment.retry_count || 0;
    const maxRetries = payment.max_retry_count || RETRY_SCHEDULE.maxRetries;

    if (currentRetry >= maxRetries) {
      await supabase
        .from('payments')
        .update({
          status: 'pending',
          failure_reason: 'Maximum retry attempts exhausted',
        })
        .eq('id', paymentId);

      return false;
    }

    const delayHours = RETRY_SCHEDULE.delays[currentRetry] || 72;
    const nextRetryAt = new Date();
    nextRetryAt.setHours(nextRetryAt.getHours() + delayHours);

    await supabase
      .from('payments')
      .update({
        next_retry_at: nextRetryAt.toISOString(),
        retry_count: currentRetry + 1,
        last_retry_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    return true;
  } catch (error) {
    console.error('Error scheduling payment retry:', error);
    return false;
  }
}
