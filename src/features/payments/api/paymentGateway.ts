/**
 * Payment Gateway Integration
 *
 * This file provides the structure for integrating with South African payment gateways:
 * - PayFast (https://www.payfast.co.za)
 * - Yoco (https://www.yoco.com)
 *
 * Setup Requirements:
 * 1. Create merchant accounts with PayFast and/or Yoco
 * 2. Add API keys to environment variables
 * 3. Set up webhook endpoints for payment notifications
 * 4. Configure return URLs for payment completion
 */

import { supabase } from '../../../lib/supabase';
import { env } from '../../../core/config/env';
import CryptoJS from 'crypto-js';

export interface PaymentGatewayConfig {
  gateway: 'payfast' | 'yoco';
  sandbox: boolean;
  merchantId?: string;
  merchantKey?: string;
  passphrase?: string;
  publicKey?: string;
  secretKey?: string;
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
 * PayFast Configuration
 * Documentation: https://developers.payfast.co.za/docs
 * Uses centralized env config (EXPO_PUBLIC_* vars available at runtime).
 */
export const payfastConfig: PaymentGatewayConfig = {
  gateway: 'payfast',
  sandbox: env.payfast.sandbox,
  merchantId: env.payfast.merchantId,
  merchantKey: env.payfast.merchantKey,
  passphrase: env.payfast.passphrase,
};

/**
 * Yoco Configuration
 * Documentation: https://developer.yoco.com/online/
 */
export const yocoConfig: PaymentGatewayConfig = {
  gateway: 'yoco',
  sandbox: env.yoco.sandbox,
  publicKey: env.yoco.publicKey,
  secretKey: env.yoco.secretKey,
};

/**
 * Generate PayFast payment URL
 * This creates a redirect URL for PayFast hosted payment page
 */
export function generatePayFastPaymentUrl(
  config: PaymentGatewayConfig,
  request: PaymentRequest
): string {
  const baseUrl = config.sandbox
    ? 'https://sandbox.payfast.co.za/eng/process'
    : 'https://www.payfast.co.za/eng/process';

  const params = new URLSearchParams({
    merchant_id: config.merchantId || '',
    merchant_key: config.merchantKey || '',
    return_url: request.returnUrl,
    cancel_url: request.cancelUrl,
    notify_url: request.notifyUrl,
    m_payment_id: request.paymentId,
    amount: request.amount.toFixed(2),
    item_name: request.itemName,
    item_description: request.itemDescription || '',
    email_address: request.buyerEmail,
    name_first: request.buyerFirstName || '',
    name_last: request.buyerLastName || '',
  });

  // Generate MD5 signature (required for PayFast security)
  const signature = generatePayFastSignature(params, config.passphrase);
  if (signature) {
    params.append('signature', signature);
  }

  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate PayFast MD5 signature
 * Required for payment verification.
 * Sorts all params alphabetically, joins as key=value pairs,
 * appends passphrase, and computes MD5 hash.
 */
export function generatePayFastSignature(
  params: URLSearchParams,
  passphrase: string = ''
): string {
  // Sort parameters alphabetically and create string
  const sortedParams = Array.from(params.entries())
    .filter(([key]) => key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  // Add passphrase if set
  const stringToHash = passphrase
    ? `${sortedParams}&passphrase=${encodeURIComponent(passphrase)}`
    : sortedParams;

  const hash = CryptoJS.MD5(stringToHash).toString();
  return hash;
}

/**
 * Verify PayFast webhook signature
 * Reconstructs the expected signature from the payload and compares it
 * with the provided signature, preventing forged webhook notifications.
 */
export function verifyPayFastSignature(
  payload: Record<string, string>,
  signature: string,
  passphrase: string = ''
): boolean {
  if (!signature) return false;

  // Reconstruct the param string from webhook payload (exclude 'signature' key)
  const sortedParams = Object.entries(payload)
    .filter(([key]) => key !== 'signature')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const stringToHash = passphrase
    ? `${sortedParams}&passphrase=${encodeURIComponent(passphrase)}`
    : sortedParams;

  const expectedSig = CryptoJS.MD5(stringToHash).toString();
  return expectedSig === signature;
}

/**
 * Create Yoco checkout session
 * Documentation: https://developer.yoco.com/online/checkout
 */
export async function createYocoCheckout(
  config: PaymentGatewayConfig,
  request: PaymentRequest
): Promise<PaymentResponse> {
  try {
    const response = await fetch('https://payments.yoco.com/api/checkouts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.secretKey}`,
      },
      body: JSON.stringify({
        amount: Math.round(request.amount * 100), // Yoco uses cents
        currency: 'ZAR',
        metadata: {
          payment_id: request.paymentId,
        },
        successUrl: request.returnUrl,
        cancelUrl: request.cancelUrl,
        failureUrl: request.cancelUrl,
      }),
    });

    const data = await response.json();

    if (response.ok && data.redirectUrl) {
      return {
        success: true,
        redirectUrl: data.redirectUrl,
        transactionId: data.id,
      };
    }

    return {
      success: false,
      error: data.message || 'Failed to create checkout session',
    };
  } catch (error: any) {
    console.error('Error creating Yoco checkout:', error);
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

/**
 * Process payment webhook
 * Called by webhook endpoint when payment status changes
 */
export async function processPaymentWebhook(
  payload: WebhookPayload
): Promise<void> {
  try {
    const { paymentId, transactionId, status, gateway } = payload;

    // Update payment record
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
      updateData.status = 'pending'; // Reset to pending for retry
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

    // TODO: Send notifications
    // - Email confirmation to tenant
    // - Push notification
    // - Email to owner for completed payment

    console.log(`Payment ${paymentId} updated: ${status}`);
  } catch (error) {
    console.error('Error processing payment webhook:', error);
    throw error;
  }
}

/**
 * Initiate a payment
 * Main entry point for starting a payment flow
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
      return {
        success: false,
        error: 'Payment not found',
      };
    }

    // Construct payment request
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
      .update({
        status: 'processing',
        payment_gateway: gateway,
      })
      .eq('id', paymentId);

    // Generate payment URL based on gateway
    if (gateway === 'payfast') {
      const redirectUrl = generatePayFastPaymentUrl(payfastConfig, request);
      return {
        success: true,
        redirectUrl,
      };
    } else if (gateway === 'yoco') {
      return await createYocoCheckout(yocoConfig, request);
    }

    return {
      success: false,
      error: 'Invalid payment gateway',
    };
  } catch (error: any) {
    console.error('Error initiating payment:', error);
    return {
      success: false,
      error: error.message || 'Failed to initiate payment',
    };
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
      // Max retries reached, mark as overdue
      await supabase
        .from('payments')
        .update({
          status: 'pending',
          failure_reason: 'Maximum retry attempts exhausted',
        })
        .eq('id', paymentId);

      // TODO: Send notification about failed payment
      return false;
    }

    // Calculate next retry time
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

    // TODO: Schedule background job for retry
    // This would typically be done with a job queue or cron job

    return true;
  } catch (error) {
    console.error('Error scheduling payment retry:', error);
    return false;
  }
}
