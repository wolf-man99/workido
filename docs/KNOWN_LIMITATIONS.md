# Known limitations and external dependencies

What the MVP deliberately does not do yet, and what has to be configured outside the code before a public launch. Nothing below is hidden behind a fake success state in the UI: missing configuration shows an explicit "not available yet" message.

## External configuration required

| Dependency | Needed for | Without it | How |
| --- | --- | --- | --- |
| Migrations applied to the hosted Supabase project | Everything | Done for `bquiwujcuynajxrxequh` (SQL editor); future migration files must be applied too | [DEPLOYMENT.md](DEPLOYMENT.md) §1 |
| `SUPABASE_SERVICE_ROLE_KEY` (server only) | Payments, refunds, webhooks, email dispatch | Checkout says payments aren't available; emails aren't sent | Hosting secret settings — never in chat or code |
| Razorpay account, KYC, API keys, webhook secret | Real payments and refunds | Use `PAYMENT_PROVIDER=dev` (test mode, clearly labelled) or leave payments disabled | [PAYMENTS.md](PAYMENTS.md) |
| Custom SMTP in Supabase Auth | Reliable sign-up confirmation and password-reset emails | Supabase's built-in sender is rate-limited and for testing only | Supabase → Authentication → SMTP |
| Resend (`RESEND_API_KEY`, `EMAIL_FROM`) and a scheduler with `CRON_SECRET` | Transactional notification emails | In-app notifications still work | [ENVIRONMENT.md](ENVIRONMENT.md), [DEPLOYMENT.md](DEPLOYMENT.md) |
| First admin account | Admin panel | No one can moderate | SQL in [DEPLOYMENT.md](DEPLOYMENT.md) |
| Legal review | Terms, Privacy Policy, payment flow, payouts, tax (GST/TDS/TCS) | `/terms` and `/privacy` are clearly marked drafts | A qualified professional |
| Approved tagline, support email, social profiles | Branding | Nothing is shown (no placeholders) | `NEXT_PUBLIC_BRAND_TAGLINE`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SOCIAL_*` |

## Payments and money

- **No escrow, wallet or split settlement.** Payments are captured by the merchant account. Holding funds or paying specialists automatically requires a provider product such as Razorpay Route plus legal review.
- **Payouts are manual.** Completed orders get `payout_status = pending`; an admin settles outside Workido and records the reference. The UI never claims a transfer happened before that.
- **Refunds are admin-initiated.** The database opens a pending refund automatically; an admin sends it to the provider from `/admin/payments`.
- **No invoices or tax documents** are generated.
- **Platform fees default to 0.** Basis-point settings exist (`platform_settings`) but have no admin UI.
- **The Razorpay adapter is tested against mocked HTTP only.** Run a full test-mode pass (success, failure, refund, webhook redelivery) before going live.
- **INR-first.** Every amount stores its currency and the money helpers support INR/USD/EUR/GBP, but listings and checkout default to INR and there is no currency switcher or conversion.

## Order lifecycle

- **No automatic timers.** Auto-approval after a review period, auto-cancellation of long-unpaid orders, reminders for overdue deliveries and offer expiry are not implemented; the delivery due date is shown but nothing acts on it automatically. These need a scheduled job.
- **Accepted and in-progress are one state; approved and completed are one state** (see [ORDERS.md](ORDERS.md)).
- **Order changes after creation** (scope or price amendments, tips, extensions) are not supported; a new order is required.
- **Dispute evidence** is the dispute description plus the order's messages and files; there is no separate evidence upload or appeal flow.

## Matching and discovery

- **Rules-based matching only** (documented in [MATCHING.md](MATCHING.md)); weights are code constants, not admin-configurable. Matching runs when a requirement is posted or edited, or on demand — not when new specialists join later.
- **Search uses case-insensitive substring matching** (`ILIKE`) on titles, descriptions, names and headlines. There is no typo tolerance, relevance ranking or full-text index; fine for MVP volumes, worth revisiting with growth.
- **No public requirement board**: specialists see a requirement only when invited.

## Accounts and trust

- **Email + password only.** No social login, phone OTP or two-factor authentication.
- **Self-serve account deletion and data export are not implemented.** Handle requests via the support inbox; admins can suspend accounts.
- **Verification is a manual admin review** of the specialist's profile and portfolio. No ID or document checks are integrated.
- **Messages are not automatically moderated.** Users can report messages, listings and profiles; admins review reports.
- **Rate limiting** relies on Supabase Auth's built-in limits for sign-up/login/recovery plus a database limit on the contact form. Other write paths are protected by authorisation, not throttling; add edge rate limiting (e.g. your host's firewall) before a public launch.

## Notifications

- **Email is sent from an outbox on a schedule**, so delivery is delayed by up to the schedule interval.
- **WhatsApp is an integration point only** (`src/lib/notifications/channels.ts`); it is not connected and no flow depends on it.
- No notification preferences beyond email on/off per account.

## Files

- Upload limits follow the bucket configuration (largest 50 MB, the Supabase Free plan maximum). Files are type-checked by extension, MIME and magic bytes, but **not virus-scanned**.
- No image resizing pipeline; avatars and portfolio images are served at their uploaded size.

## Technical notes

- **404 status codes on streamed dashboard pages:** routes under `/dashboard` and `/admin` have `loading.tsx`, so a missing or forbidden order renders the not-found page with HTTP 200 (the content is correct and no data is exposed). Public pages return a real 404: the gig and specialist list pages keep their loading states in `(browse)` route groups so detail pages aren't streamed.
- **Cache Components / Partial Prerendering are disabled.** Pages render dynamically per request; enable and add caching boundaries once traffic justifies it.
- **Password-reset and confirmation links use the PKCE `code` flow by default**, which must be opened in the same browser that requested them. For cross-device links, switch the Supabase email templates to the `token_hash` form, which `/auth/callback` already supports (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- **Analytics events are stored in `public.analytics_events`** only. No third-party analytics or consent banner is included.
- **English only**, no localisation framework.
- **No error-monitoring SDK** is bundled; use your host's logs or add one (e.g. Sentry) at deployment.
