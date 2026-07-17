// ============================================================================
// SUPABASE EDGE FUNCTION: vendor-payment-redirect
// ============================================================================
// Serves a simple HTML page that PayFast redirects to after payment.
// The return_url and cancel_url in PayFast must be HTTP(S) URLs — this
// function renders a branded page telling the user to close the browser
// and go back to the Lalarente app (which is polling get-vendor-payment-status).
//
// Called by: PayFast hosted payment page (return_url / cancel_url)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const HTML_TEMPLATE = (status: 'success' | 'cancelled') => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${status === 'success' ? 'Payment Complete' : 'Payment Cancelled'} — Lalarente</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f0fdf4;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 24px;
      padding: 48px 32px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.08);
    }
    .icon {
      width: 80px;
      height: 80px;
      border-radius: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 40px;
    }
    .icon-success { background: #007A4D; }
    .icon-cancelled { background: #DE3831; }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 12px;
    }
    p {
      font-size: 15px;
      color: #6b7280;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .app-name {
      color: #007A4D;
      font-weight: 600;
    }
    .btn {
      display: inline-block;
      background: #007A4D;
      color: #ffffff;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      transition: background 0.2s;
    }
    .btn:hover { background: #005f3a; }
    .btn-cancelled { background: #6b7280; }
    .btn-cancelled:hover { background: #4b5563; }
    .footer {
      margin-top: 24px;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${status === 'success' ? 'icon-success' : 'icon-cancelled'}">
      ${status === 'success' ? '✓' : '✕'}
    </div>
    <h1>${status === 'success' ? 'Payment Complete!' : 'Payment Cancelled'}</h1>
    <p>
      ${status === 'success'
        ? 'Your payment was successful. You can close this page and return to the <span class="app-name">Lalarente</span> app to see your receipt.'
        : 'The payment was cancelled. You can close this page and try again from the <span class="app-name">Lalarente</span> app.'
      }
    </p>
    <p style="margin-bottom: 0;">
      <strong style="color: #111827;">Already seeing the app?</strong><br>
      <span style="font-size: 14px;">The app will update automatically once payment is confirmed.</span>
    </p>
    <div class="footer">
      Lalarente — Smart Property Management
    </div>
  </div>
</body>
</html>`;

serve(async (req) => {
  // Parse query params to determine status
  const url = new URL(req.url);
  const status = url.searchParams.get('status') === 'cancelled' ? 'cancelled' : 'success';

  const html = HTML_TEMPLATE(status);

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
});
