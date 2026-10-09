# Payments

## Design

- `src/lib/payments/types.ts` defines a `PaymentProvider` interface (create order, verify checkout signature, verify/parse webhooks, create refund). Order logic never talks to a provider directly.
- Adapters: `razorpay.ts` (REST API + HMAC, no SDK) and `dev.ts` (development only).
- `provider.ts` selects the adapter from `PAYMENT_PROVIDER`. It never silently falls back to the dev adapter.
- `service.ts` contains the flows: start checkout, verify a checkout callback, record failures, simulate dev checkout, execute refunds, and the service-role webhook store.
- `webhooks.ts` is the provider-agnostic, idempotent webhook processor (unit-tested with a fake store and integration-tested against Postgres).

Workido **does not hold funds, run a wallet or implement escrow.** Buyer payments are captured by the merchant account configured with the provider. Any holding, split settlement or delayed payout must use a provider-supported product (e.g. Razorpay Route) after legal and financial review.

## Money flow in the app

1. An order is created by the database (`create_service_order` / `accept_offer`) with `price_minor`, `buyer_fee_minor` (default 0), `specialist_fee_minor` (default 0) and generated `total_minor`. Fees come from `platform_settings` (`buyer_fee_bps`, `specialist_fee_bps`) and are snapshotted per order.
2. **Checkout** (`startCheckoutAction`): the server confirms the buyer owns the order and that it awaits payment, then creates (or reuses) a provider order for `total_minor` and records a `payments` row. The browser never sends an amount.
3. **Verification:** the provider's checkout response is verified server-side (`verifyCheckoutPayment`): signature check, payment ↔ order ↔ buyer match, then `apply_payment_success()` (service role only). Only then does the order move to `paid`.
4. **Webhooks** (`/api/payments/webhook/razorpay`) do the same from the provider side, so a payment is confirmed even if the browser closes. Each provider event id is stored once (`payment_webhook_events`); all transitions are idempotent.
5. **Failures** (`payment.failed` / checkout errors) mark the attempt `failed`; the order stays `pending_payment` so the buyer can retry.
6. **Refunds:** when a paid order is declined, cancelled before acceptance, or a dispute is resolved for the buyer, the database opens a `refunds` row (`pending`). An admin processes it from `/admin/payments` → the provider's refund API → `processing`; it becomes `succeeded` and the order `refunded` only when the provider confirms (API response or `refund.processed` webhook).
7. **Payouts:** on completion the order's `payout_status` becomes `pending`. Until automated settlement exists, admins settle outside Workido and record the bank/UTR reference (`admin_mark_payout`). The UI never claims money has been transferred before that.
8. **Late/duplicate payments:** money arriving for a cancelled order or a second successful attempt automatically creates a pending refund.

Security properties (all covered by tests): users cannot insert/update `payments`, cannot execute `apply_payment_success`, cannot forge a checkout signature, and cannot replay a webhook.

## Development adapter (`PAYMENT_PROVIDER=dev`)

- Checkout shows a **"Test mode — no real money"** panel with "Simulate successful/failed payment".
- The server generates an HMAC signature with `DEV_PAYMENTS_SECRET` and runs the same verification path as Razorpay; the browser never supplies a signature.
- Refunds "succeed" immediately.
- Refused when `NODE_ENV=production` unless `ALLOW_DEV_PAYMENTS=true` (private demos only). Order pages label these payments "via test mode".

## Activating Razorpay

1. Complete Razorpay KYC and get your account activated. Start in **Test Mode**.
2. Dashboard → Account & Settings → **API Keys** → generate a key. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the server.
3. Dashboard → **Webhooks** → add `https://<your-domain>/api/payments/webhook/razorpay`, choose a secret (set it as `RAZORPAY_WEBHOOK_SECRET`) and subscribe to: `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
4. Ensure payments are **auto-captured** (Dashboard → Account & Settings → Payment capture). The app treats `payment.captured`/`order.paid` and verified checkout signatures as success.
5. Set `PAYMENT_PROVIDER=razorpay` and `SUPABASE_SERVICE_ROLE_KEY`, redeploy.
6. Test end to end with Razorpay test cards/UPI, including a failure, a refund and a webhook redelivery (should be acknowledged as a duplicate).
7. Switch to live keys only after the legal/financial review below.

## Before taking real money

- Have the flow reviewed by a qualified professional: whether the platform may collect on behalf of specialists, invoicing/GST, TDS/TCS obligations for marketplaces, refund and dispute policy, and how specialists are paid (e.g. Razorpay Route linked accounts).
- If platform fees are introduced, update `platform_settings` (basis points). Prices shown at checkout already include the stored fee breakdown.
- Publish lawyer-reviewed Terms and Privacy Policy.
