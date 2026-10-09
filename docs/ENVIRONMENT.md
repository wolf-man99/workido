# Environment variables

Copy `.env.example` to `.env.local` for local development. In hosting (e.g. Vercel) set the same variables in the project settings. Never commit `.env*` files with real values (`.gitignore` excludes them, except `.env.example`).

Variables prefixed `NEXT_PUBLIC_` are embedded in browser bundles: **never put secrets in them.** Public configuration is validated in `src/lib/config/public-env.ts`; server configuration in `src/lib/config/server-env.ts` (importing it from client code fails the build).

## Required

| Variable | Where to find it | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | Your site URL | Used for auth email redirects and metadata. Must match the Supabase Auth Site URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | e.g. `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys | Legacy `anon` key **or** new `sb_publishable_…` key. Public by design; protected by RLS. |

## Server-only

| Variable | Required for | Notes |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Payments (checkout, verification, webhooks, refunds) and email dispatch | Legacy `service_role` key or new `sb_secret_…` key. **Bypasses RLS** — server only. Without it, checkout shows "Payments aren't available yet". |
| `PAYMENT_PROVIDER` | Checkout | `razorpay`, `dev`, or empty (disabled). |
| `DEV_PAYMENTS_SECRET` | `PAYMENT_PROVIDER=dev` | ≥16 random characters; signs simulated payment confirmations. |
| `ALLOW_DEV_PAYMENTS` | Dev adapter in production builds | Must be `true` to use the dev adapter when `NODE_ENV=production` (private test deployments only). A test-mode banner is always shown. |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | `PAYMENT_PROVIDER=razorpay` | Razorpay → Account & Settings → API Keys. Key id is shown to the browser checkout; the secret never leaves the server. |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhooks | Set when creating the webhook in Razorpay. Without it all Razorpay webhooks are rejected. |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email notifications | Optional. Without them, development logs emails and production skips them (in-app notifications always work). |
| `CRON_SECRET` | `/api/notifications/dispatch` | Callers must send `Authorization: Bearer <CRON_SECRET>`. Vercel Cron does this automatically when the variable is set. |
| `APP_TIMEZONE` | Deadlines | IANA timezone used to turn a chosen deadline date into end-of-day. Default `Asia/Kolkata`. |

## Optional public branding

| Variable | Notes |
| --- | --- |
| `NEXT_PUBLIC_BRAND_TAGLINE` | Leave empty until a tagline is approved. |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Shown on the contact page. |
| `NEXT_PUBLIC_SOCIAL_INSTAGRAM` / `_LINKEDIN` / `_X` | Footer links render only when set. |

## Scripts only

| Variable | Notes |
| --- | --- |
| `ALLOW_REMOTE_DEV_SEED` | `true` lets `npm run seed:dev` target a non-local Supabase project (use only for a dedicated development project). |
| `SEED_SAMPLE_PASSWORD` | Password for seeded sample accounts (default `Workido-sample-2026`). |
| `E2E_PORT` | Port for Playwright's dev server (default 3000). |
