# Production testing sign-off — PayFast SANDBOX (LAL-119)

This is the **client testing** release: production-quality app, **sandbox money**.
Live PayFast merchant is switched **after** Navin walks the flows. Do not take real cards until that switch.

## What testers are signing off

- Tenant / owner / vendor maintenance money path (approve → Pay via PayFast → in-app checkout).
- Owner-billed invoices: owner pays; tenant is not told they paid.
- Invite-by-email (needs `RESEND_API_KEY`). Quote accept remains **owner**.
- Screening/FICA is owner document review, not a bureau.
- Vendor payout is **EFT after admin**, not instant PayFast disbursement.

Checkout shows an amber **Sandbox payments** banner while the gateway host is `sandbox.payfast.co.za`.

## APK

Use EAS profile **`preview`** (internal APK). Do not change the default profile.

```bash
gh workflow run "APK Build" --field profile=preview
```

Builds: https://expo.dev/accounts/arsalanahmed82/projects/lalarente-app/builds

## Gateway (edge)

`create-vendor-payment-checkout` and `payment-webhook` use **sandbox unless** secret `PAYFAST_SANDBOX` is exactly `false`.

Checkout JSON includes `"sandbox": true|false`. The WebView URL is `https://sandbox.payfast.co.za/eng/process` in this phase.

## Switch to live (ops — after Navin)

1. Put **live** `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE` in Supabase secrets.
2. Set `PAYFAST_SANDBOX=false`.
3. Redeploy `create-vendor-payment-checkout` and `payment-webhook` (`payment-webhook` keeps `--no-verify-jwt` for ITN).
4. Confirm a checkout URL is `https://www.payfast.co.za/eng/process` and the sandbox banner is gone.
5. First live payment: small amount, then confirm `vendor_payments.payment_status=completed` via webhook.

Do **not** put live merchant keys in `EXPO_PUBLIC_*` or the APK. Vendor collect is edge-signed.

## Not in this sign-off

- App Store / Play production listing.
- TransUnion / Onfido.
- Automated PayFast vendor payout (still `manual_eft`).
- Filling PayFast’s card WebView in Maestro (use signed ITN e2e + a human sandbox card once).
