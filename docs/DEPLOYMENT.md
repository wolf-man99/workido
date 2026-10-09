# Deployment

Target setup: **Supabase** (database, auth, storage, realtime) + **Vercel** (Next.js hosting). Any Node.js 22 host that runs `next build && next start` also works.

## 1. Supabase project

The project for this repository is `bquiwujcuynajxrxequh` (`https://bquiwujcuynajxrxequh.supabase.co`). All migrations up to `20261009001200` were applied through the SQL editor; a read-only check on 2026-10-09 confirmed the tables, reference data (13 categories, 44 skills), storage buckets and function permissions.

### Apply the migrations

Option A — Supabase CLI (recommended, keeps migration history):

```bash
npx supabase login                                     # opens a browser for an access token
npx supabase link --project-ref bquiwujcuynajxrxequh   # asks for the database password
npx supabase db push                                   # applies supabase/migrations/* in order
```

Option B — SQL editor: open each file in `supabase/migrations/` in filename order and run it in Supabase → SQL Editor. (Option A is safer; it records what has been applied.)

**If you used the SQL editor** (as was done for this project), the CLI has no record of what's applied, and `db push` would try to run every file again and fail. To switch to the CLI later, mark the existing files as applied once:

```bash
npx supabase migration repair --status applied 20261009000100 20261009000200 20261009000300 20261009000400 20261009000500 20261009000600 20261009000700 20261009000800 20261009000900 20261009001000 20261009001100 20261009001200
```

From then on, `npx supabase db push` applies only new files. If you keep using the SQL editor instead, run **only the new migration files**, in filename order — never re-run old ones.

Migrations include the initial categories and skills. They do **not** include sample data. Do not run `npm run seed:dev` against production.

### Auth settings (Supabase → Authentication)

- **Site URL:** your production URL, e.g. `https://workido.example.com`.
- **Redirect URLs:** add `https://<your-domain>/auth/callback` (and `http://localhost:3000/**` if you'll develop against this project).
- **Email confirmations:** keep enabled (default).
- **Minimum password length:** 8 (the app enforces 8+ with a letter and a number).
- **SMTP:** configure a custom SMTP provider before launch. Supabase's built-in email sender is heavily rate-limited and meant for testing.
- The default email templates work: confirmation and recovery links return to `/auth/callback`, which exchanges the code for a session.
- **Recommended:** the default links use the PKCE `code` flow, which only works in the browser that made the request. To let people open links on another device, edit the templates (Authentication → Emails) to use the token hash, which `/auth/callback` verifies server-side:
  - Confirm signup: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email&next=/dashboard`
  - Reset password: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`

### Keys

Supabase → Project Settings → API Keys:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the publishable (`sb_publishable_…`) or legacy `anon` key.
- `SUPABASE_SERVICE_ROLE_KEY`: the secret (`sb_secret_…`) or legacy `service_role` key. **Server-side only.** Paste it directly into your hosting provider's secret settings — never into chat, code or `NEXT_PUBLIC_` variables.

### Storage & realtime

Buckets (`avatars`, `portfolio`, `requirement-files`, `order-files`) and their policies are created by the migrations. Realtime for `messages` and `notifications` is enabled by the migrations. On the Free plan the maximum upload size is 50 MB, matching the largest bucket limit.

### First administrator

Admin can never be requested at sign-up. After signing up normally, grant it with SQL (Supabase → SQL Editor):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@yourcompany.com'
on conflict do nothing;
```

## 2. Vercel

1. Import the GitHub repository in Vercel (framework: Next.js, Node 22).
2. Add environment variables (Production and Preview) from [ENVIRONMENT.md](ENVIRONMENT.md). Minimum: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Add `SUPABASE_SERVICE_ROLE_KEY` and a payment provider to enable checkout.
3. Deploy. Update the Supabase Site URL / Redirect URLs to the deployed domain.

### Scheduled email dispatch

Emails are sent from an outbox by `GET /api/notifications/dispatch` with `Authorization: Bearer $CRON_SECRET`. Options:

- **Vercel Cron** (Pro plan for sub-daily schedules): add a `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/notifications/dispatch", "schedule": "*/10 * * * *" }] }
  ```
  Vercel sends the `CRON_SECRET` bearer token automatically when that variable is set.
- **Any external scheduler** (e.g. GitHub Actions `schedule`, cron-job.org) calling the URL with the header.

Without a scheduler, in-app notifications still work; only emails are not sent.

## 3. Payments

Follow [PAYMENTS.md](PAYMENTS.md). Until Razorpay is approved and configured, either leave `PAYMENT_PROVIDER` empty (checkout shows a clear "not available yet" message) or, for a private test deployment only, use `PAYMENT_PROVIDER=dev` with `ALLOW_DEV_PAYMENTS=true`.

## 4. Go-live checklist

- [ ] Migrations applied; `npm run db:lint` clean against the project.
- [ ] Custom SMTP configured; auth URLs point at the production domain.
- [ ] First admin granted; admin can open `/admin`.
- [ ] Razorpay live keys + webhook secret configured; webhook URL `https://<domain>/api/payments/webhook/razorpay` subscribed to `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
- [ ] Payment flow, refunds and payouts reviewed by a qualified professional (see PAYMENTS.md).
- [ ] Terms of Service and Privacy Policy replaced with lawyer-reviewed versions (`/terms`, `/privacy`).
- [ ] `NEXT_PUBLIC_SUPPORT_EMAIL` set; social links only if real.
- [ ] Email dispatch scheduled with `CRON_SECRET`.
- [ ] No sample data in production (`select count(*) from profiles where is_sample` returns 0).
- [ ] Error monitoring and log retention configured in your host.
